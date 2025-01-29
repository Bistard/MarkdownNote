    import "src/base/browser/basic/hoverBox/hoverBox.scss";
    import {  DirectionY, type Direction, DomUtility, addDisposableListener, EventType, DirectionX } from "src/base/browser/basic/dom";
    import { IWidget, Widget } from "src/base/browser/basic/widget";
    import { Coordinate, IRect, ISize } from "src/base/common/utilities/size";
    import { IKeyboardService } from "src/workbench/services/keyboard/keyboardService";
    import { KeyCode } from "src/base/common/keyboard";
    import { mixin } from "src/base/common/utilities/object";


    /**
     * A construction option for {@link HoverBox}.
     */
    export interface IHoverBoxOptions {

        /**
         * The full text for displaying in the hover box.
         */
        readonly text: string;

        /**
         * A target of the {@link IHoverBox} for hovering. This determines the 
         * position of the hover and it will only be hidden when the mouse leaves 
         * both the hover and the target. 
         *      - A HTMLElement can be used for simple cases and 
         *      - a {@link IHoverTarget} for more complex cases where multiple 
         *          elements are required.
         */
        readonly target: HTMLElement | IHoverTarget;

        /**
         * Options that defines where the hover is positioned.
         */
        readonly position?: IHoverPositionOptions;

        /**
         * Options that defines how long the hover is shown and when it hides.
         */
        readonly persistence?: IHoverPersistenceOptions;

        /**
         * Options that define how the hover looks.
         */
        readonly appearance?: IHoverAppearanceOptions;
    }


    /**
     * A target for a hover.
     */
    export interface IHoverTarget {
        /**
         * A set of target elements used to position the hover. If multiple elements are used the hover
         * will try to not overlap any target element. An example use case for this is show a hover for
         * wrapped text.
         */
        readonly targetElements: readonly HTMLElement[];
    }

    export interface IHoverPositionOptions {

        /**
         * Position of the hover. 
         * @default DirectionY.Above
         * 
         * The default is to show above the `target`. This option will be ignored
         * if there is not enough room to layout the hover in the specified position, 
         * unless the forcePosition option is set.
         * 
         * If {@link Coordinate} is provided, the position will be entirely decided
         * by the coordinate, instead of relative to the `target`.
         */
        readonly hoverPosition?: Direction | Coordinate;

        /**
         * Force the hover position.
         */
        readonly forcePosition?: boolean;

        readonly offest?: {
            x: number,
            y: number,
        };
    }

    export interface IHoverPersistenceOptions {


        /**
         * Whether to hide the hover when a key is pressed.
         * @default true
         */
        readonly hideOnKeyDown?: boolean;

        /**
         * Indicates if the {@link IHoverBox} should be locked initially. If false
         * provided. User have to press the 'alt/option' key to lock the hover box.
         * @default false
         * 
         * Lock means the hover box will never hidden in any cases.
         */
        readonly locked?: boolean;
    }

    export interface IHoverAppearanceOptions {
        
        /**
         * An optional array of classes to add to the hover element.
         */
        readonly additionalClasses?: string[];

        /**
         * Whether to skip the fade in animation.
         * @default false
         * 
         * This should be used when hovering from one hover to another in the same 
         * group so it looks like the hover is moving from one element to the other.
         */
        readonly skipFadeInAnimation?: boolean;
    }

    /**
     * An interface only for {@link HoverBox}.
     */
    export interface IHoverBox extends IWidget {

        layout(): void;
        toggleLock(): void;
    }

    function isHoverTarget(x: HTMLElement | IHoverTarget): x is IHoverTarget {
        return !!(x as IHoverTarget).targetElements;
    }

    /**
     * Get the viewport size using the window's inner dimensions.
     */
    function getViewportSize(): ISize {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    function isCoordinate(pos: Direction | Coordinate | undefined): pos is Coordinate {
        return !!pos && typeof (pos as Coordinate).x === 'number' && typeof (pos as Coordinate).y === 'number';
    }

    function computeRect(target: HTMLElement): { top: number, left: number, width: number, height: number } {
        const top = DomUtility.Attrs.getViewportTop(target);
        const left = DomUtility.Attrs.getViewportLeft(target);
        const width = DomUtility.Attrs.getTotalWidth(target);
        const height = DomUtility.Attrs.getTotalHeight(target);
        return { top, left, width, height };
    }

    /**
     * Compute a combined rect for multiple elements (used if target is IHoverTarget).
     */
    function computeCombinedRect(elements: HTMLElement[]): { top: number; left: number; width: number; height: number } {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        for (const e of elements) {
            const r = computeRect(e);
            if (r.left < left) left = r.left;
            if (r.top < top) top = r.top;
            if ((r.left + r.width) > right) right = r.left + r.width;
            if ((r.top + r.height) > bottom) bottom = r.top + r.height;
        }

        return {
            top,
            left,
            width: right - left,
            height: bottom - top
        };
    }

    function getTargetRect(target: HTMLElement | IHoverTarget): IRect {
        if (isHoverTarget(target)) {
            return computeCombinedRect(target.targetElements as HTMLElement[]);
        } else {
            return computeRect(target);
        }
    }

    export class HoverBox extends Widget implements IHoverBox {

        // [fields]
        private readonly text: string;
        private readonly target: HTMLElement | IHoverTarget;
        private readonly positionOpts: IHoverPositionOptions;
        private readonly persistenceOpts: IHoverPersistenceOptions;
        private readonly appearanceOpts: IHoverAppearanceOptions;

        private locked: boolean;

        // Set to 1 when the mouse enters the target
        private mouseInTargetCounter: number = 1;
        private onAltkDown: boolean = false;

        // [constructor]
        
        constructor(opts: IHoverBoxOptions,
                    @IKeyboardService private readonly keyboardService: IKeyboardService
        ) {
            super();
            this.text = opts.text;
            this.target = opts.target;
            this.positionOpts = opts.position ?? {};
            
            this.persistenceOpts = mixin(
                opts.persistence, 
                { hideOnKeyDown: true },
                false,
            );
            this.appearanceOpts = opts.appearance ?? {};

            this.locked = !!this.persistenceOpts.locked;

        }

        // [public methods]

        // [private methods]

        public layout(): void {

            if (!this.rendered) return;
            const element = this.element;
            const viewSize = getViewportSize();

            // Measure the hover itself
            const hoverSize = this.__getHoverSize();
            
            // x, y coordinate
            const untailoredHoverXY = this.__determineHoverXY(hoverSize, viewSize);

            const offset = this.positionOpts.offest ?? {x: 0, y: 0};
            
            let x = untailoredHoverXY.x + offset.x;
            let y = untailoredHoverXY.y + offset.y;
            
            // Adjust if out of viewport
            const maxX = viewSize.width - hoverSize.width;
            const maxY = viewSize.height - hoverSize.height;

            x = Math.max(0, x);
            y = Math.max(0, y);

            x = Math.min(x , maxX);
            y = Math.min(y , maxY);

            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        }

        public toggleLock(): void {
            this.locked = !this.locked;
            if (!this.locked && this.mouseInTargetCounter <= 0) {
                this.dispose();
            }
        }

        protected override __render(element: HTMLElement): void {
            element.classList.add('monaco-hover', 'hover-box');

            if (!this.appearanceOpts.skipFadeInAnimation) {
                element.classList.add('fade-in');
            }

            if (this.appearanceOpts.additionalClasses) {
                this.appearanceOpts.additionalClasses.forEach(cls => element.classList.add(cls));
            }

            const textDiv = document.createElement('div');
            textDiv.classList.add('hover-content');
            textDiv.textContent = this.text;
            element.appendChild(textDiv);

            this.layout();
        }

        protected override __applyStyle(element: HTMLElement): void {
            // Basic styling handled in SCSS
            element.style.position = 'absolute';
            element.style.zIndex = '9999';
        }

        protected override __registerListeners(element: HTMLElement): void {
            
            const targetElements = isHoverTarget(this.target) ? this.target.targetElements : [this.target];
            for (const t of targetElements) {
                this.__register(addDisposableListener(t, EventType.mouseenter, () => {
                    
                    this.mouseInTargetCounter += 1;
                }));
                this.__register(addDisposableListener(t, EventType.mouseleave, () => {

                    this.mouseInTargetCounter -= 1;
                    this.__tryHideOnMouseOut();
                }));
            }

            this.__register(this.keyboardService.onKeydown(event => {

                if (this.onAltkDown) {
                    return;
                }
                if (event.key === KeyCode.Alt) {
                    this.onAltkDown = true;
                    this.toggleLock();
                } else {
                    if (this.persistenceOpts.hideOnKeyDown && !this.locked) {
                        this.dispose();
                    }
                }
            }));

            this.__register(this.keyboardService.onKeyup(event => {

                if (event.key === KeyCode.Alt) {
                    this.onAltkDown = false;
                    this.toggleLock();
                }
            }));
        }

        private __tryHideOnMouseOut(): void {
            if (this.locked) return;
            if (this.mouseInTargetCounter <= 0) {
                this.dispose();
            }
        }
        
        private __getHoverSize(): ISize {
            const width: number = DomUtility.Attrs.getTotalWidth(this.element);
            const height: number = DomUtility.Attrs.getTotalHeight(this.element); 
            return {width, height};
        }
        
        private __determineHoverXY(hoverSize: ISize, viewSize: ISize): Coordinate {
            let x, y: number = 0;

            // Position relative to target
            const targetRect = getTargetRect(this.target);

            if (isCoordinate(this.positionOpts.hoverPosition)) {
                x = this.positionOpts.hoverPosition.x;
                y = this.positionOpts.hoverPosition.y;
                return new Coordinate(x, y);
            }

            const direction = this.__determineHoverDirection(targetRect, hoverSize, viewSize);
            console.log('direction:', direction);

            if (direction === DirectionY.Top) {
                y = targetRect.top - hoverSize.height;
                x = targetRect.left + (targetRect.width - hoverSize.width) / 2;
            } else if (direction === DirectionY.Bottom) {
                y = targetRect.top + targetRect.height;
                x = targetRect.left + (targetRect.width - hoverSize.width) / 2;
            } else if (direction === DirectionX.Left) {
                y = targetRect.top + (targetRect.height - hoverSize.height) / 2;
                x = targetRect.left - hoverSize.width;
            } else if (direction === DirectionX.Right) {
                y = targetRect.top + (targetRect.height - hoverSize.height) / 2;
                x = targetRect.left + targetRect.width;
            } else {
                // fallback
                y = targetRect.top - hoverSize.height;
                x = targetRect.left;
            }
            
            return new Coordinate(x, y);
        }

        private __determineHoverDirection(targetRect: IRect, hoverSize: ISize, viewSize: ISize): Direction {
            
            // default Direction is Top(above the target)
            const desiredPosition = this.positionOpts.hoverPosition ?? DirectionY.Top;
            
            const force = !!this.positionOpts.forcePosition;
            let finalPos = desiredPosition as Direction;

            if (force) {
                return finalPos as Direction;
            }
            
            // No force determine fits
            const fitsAbove = (targetRect.top - hoverSize.height) >= 0;
            const fitsBelow = (targetRect.top + targetRect.height + hoverSize.height) <= viewSize.height;
            const fitsLeft =  (targetRect.left - hoverSize.width) >= 0;
            const fitsRight = (targetRect.left + targetRect.width + hoverSize.width) <= viewSize.width;

            // Default order: top, bottom, left, right
            const fits: Record<Direction, boolean> = {
                [DirectionY.Top]: fitsAbove,
                [DirectionY.Bottom]: fitsBelow,
                [DirectionX.Left]: fitsLeft,
                [DirectionX.Right]: fitsRight,
            };
            
            if (!fits[finalPos]) {
                for (const [direction, fit] of Object.entries(fits)) {
                    if (fit) {
                        finalPos = direction as Direction;
                    }
                }
            }
            return finalPos;
        }
    }