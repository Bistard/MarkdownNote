import "src/base/browser/basic/contextMenu/contextMenu.scss";
import { DomUtility } from "src/base/browser/basic/dom";
import { FastElement } from "src/base/browser/basic/fastElement";
import { AnchorAbstractPosition, AnchorMode, calcViewPositionAlongAxis, IAnchorBox } from "src/base/browser/basic/view";
import { Disposable, LooseDisposableBucket, IDisposable } from "src/base/common/dispose";
import { Range } from "src/base/common/structures/range";
import { IDomBox, IPosition } from "src/base/common/utilities/size";

// region - interface

export interface IAnchor {
    readonly x: number;
    readonly y: number;

    // we can specify the anchor to have dimension
    readonly width?: number;
    readonly height?: number;
}

/**
 * Determines the primary axis of positioning (either vertical or horizontal) 
 * when calculating the view's position.
 * 
 * For an example, when sets to horizontal, the program will first to decide 
 * either place the view on the left or right relative to the anchor（based on 
 * {@link AnchorHorizontalPosition}. If the view intersects with the anchor, the 
 * secondary positioning strategy (vertical) is applied to the vertical axis to 
 * avoid overlapping (based on {@link AnchorVerticalPosition}).
 */
export const enum AnchorPrimaryAxisAlignment {
    Horizontal,
    Vertical,
}

export const enum AnchorHorizontalPosition {
    Left,
    Right,
}

export const enum AnchorVerticalPosition {
    Above,
    Below,
}

export interface IContextMenuDelegateBase {
    /**
     * @description The delegate returns an anchor for the context menu to build
     * the coordinates when rendering.
     */
    getAnchor(): HTMLElement | IAnchor;

    /**
     * Determines the primary axis of positioning (either vertical or horizontal) 
     * when calculating the view's position.
     * 
     * For an example, when sets to horizontal, the program will first to decide 
     * either place the view on the left or right relative to the anchor（based 
     * on {@link AnchorHorizontalPosition}. If the view intersects with the 
     * anchor, the secondary positioning strategy (vertical) is applied to the 
     * vertical axis to avoid overlapping (based on {@link AnchorVerticalPosition}).
     * 
     * @default AnchorPrimaryAxisAlignment.Vertical
     */
    readonly primaryAlignment?: AnchorPrimaryAxisAlignment;

    /**
     * When determining the position in horizontal axis, place either on the 
     * left or right relative to the anchor.
     * @default AnchorHorizontalPosition.Right
     */
    readonly horizontalPosition?: AnchorHorizontalPosition;
    
    /**
     * When determining the position in vertical axis, place either on the 
     * above or below relative to the anchor.
     * @default AnchorHorizontalPosition.Below
     */
    readonly verticalPosition?: AnchorVerticalPosition;
}

/**
 * A delegate to provide external data and functionalities to help to show the
 * context menu.
 */
export interface IContextMenuDelegate extends IContextMenuDelegateBase {
    
    /**
     * @description The delegate decides how to render the content of the 
     * context menu.
     * @param container The container contains all the rendered results by the
     *                  delegate.
     * @returns Returns a disposable to be disposed when destroyed.
     */
    render(container: HTMLElement): IDisposable | undefined;

    /**
     * @description Invokes before the context menu gets destroyed (hidden).
     * @param container The container contains all the rendered results by the
     *                  delegate.
     */
    onBeforeDestroy(container: HTMLElement): void;

    /**
     * @description Invokes when the context menu is focused.
     */
    onFocus?(): void;
}

/**
 * An interface only for {@link ContextMenuView}.
 */
export interface IContextMenu extends IDisposable {
    
    /**
     * @description Place the context menu under the given container.
     * @param container The container that contains the context menu.
     */
    setContainer(container: HTMLElement): void;
    
    /**
     * @description Show up a context menu by the given delegate under the 
     * current container.
     * @param delegate A delegate that provides external data and functionalities.
     * 
     * @note If not under any container, this will not show up.
     */
    show(delegate: IContextMenuDelegate): void;

    /**
     * @description Destroys the current context menu if presented.
     */
    destroy(): void;

    /**
     * @description Is the context menu is visible (un-destroyed).
     */
    visible(): boolean;
}

// region - ContextMenuView

/**
 * @class A {@link ContextMenuView} can be placed under a given container for 
 * later rendering. The rendering implementation of a {@link ContextMenuView} is 
 * entirely abstracted out as a {@link IContextMenuDelegate}. Usually is 
 * rendered based on {@link IMenu}.
 * 
 * @note A {@link ContextMenuView} encapsulates how to calculate the position of
 *       such a view.
 * @note When showing a {@link ContextMenuView}, the position of the view will 
 *       be adjusted due to the anchor position and the viewport size to ensure 
 *       the view is properly fit in and overlap avoided.
 * @note The default position type is 'absolute'.
 */
export class ContextMenuView extends Disposable implements IContextMenu {

    // [constants]

    public static readonly CLASS_NAME = 'context-menu';

    // [fields]

    /** The HTMLElement that contains the whole context menu view */
    private readonly _element: FastElement<HTMLElement>;
    
    /** The container which contains the context menu */
    private _currContainer?: HTMLElement;

    /** The delegate that handles external business logics */
    private _currDelegate?: IContextMenuDelegate;
    private readonly _currRenderContentLifecycle: LooseDisposableBucket;

    // [constructor]

    constructor(container: HTMLElement) {
        super();
        this._element = this.__register(new FastElement(document.createElement('div')));
        this._element.setClassName(ContextMenuView.CLASS_NAME);
        this._element.setPosition('absolute');

        this._currRenderContentLifecycle = this.__register(new LooseDisposableBucket());

        DomUtility.Modifiers.hide(this._element.raw);
        this.setContainer(container);
    }

    // [public methods]

    public setContainer(newContainer: HTMLElement): void {
        
        // remove the context menu from the old container
        if (this._currContainer) {
            this._currContainer.removeChild(this._element.raw);
            this._currContainer = undefined;
        }

        // set the new container
        this._currContainer = newContainer;
        this._currContainer.appendChild(this._element.raw);
    }

    public show(delegate: IContextMenuDelegate): void {
        
        // the view is not placed under any container
        if (!this._currContainer) {
            return;
        }

        // destroy the current context menu if already visible
        if (this.visible()) {
            this.destroy();
        }

        // cleans the previous rendered result
        this.__resetViewAttrs();

        // enable show-up 
        DomUtility.Modifiers.show(this._element.raw);

        // render the content of the context menu
        this._currDelegate = delegate;
        this._currRenderContentLifecycle.register(
            this._currDelegate.render(this._element.raw) || Disposable.NONE
        );

        // layout the context menu
        this.__layout(this._currDelegate);

        // focus the context menu after created
        this._currDelegate.onFocus?.();
    }

    public destroy(): void {
        const oldDelegate = this._currDelegate;
        this._currDelegate = undefined;

        // tells the delegate before actual hidden
        if (oldDelegate?.onBeforeDestroy) {
            oldDelegate.onBeforeDestroy(this._element.raw);
        }

        // unrender
        this._currRenderContentLifecycle.dispose();

        // hide the context menu
        DomUtility.Modifiers.hide(this._element.raw);
    }

    public visible(): boolean {
        return !!this._currDelegate;
    }

    // [private methods]

    private __resetViewAttrs(): void {
        DomUtility.Modifiers.clearChildrenNodes(this._element.raw);
        this._element.setClassName(ContextMenuView.CLASS_NAME);
        this._element.setTop(0);
		this._element.setLeft(0);
    }

    private __layout(delegate: IContextMenuDelegate): void {
        
        if (!this.visible()) {
            return;
        }

        if (!this._currContainer) {
            return;
        }
        
        const { top, left } = this.__calculateViewPosition(delegate);

        const containerPos = DomUtility.Positions.getNodePagePosition(this._currContainer);
        this._element.setTop(top - containerPos.top);
        this._element.setLeft(left - containerPos.left);
    }

    private __calculateViewPosition(delegate: IContextMenuDelegate): IPosition {
        let top: number;
        let left: number;

        const anchorBox = this.__getAnchorBox(delegate);
        const computed = getComputedStyle(this._element.raw);
        const elementHeight = DomUtility.Attrs.getTotalHeight(this._element.raw, computed);
        const elementWidth = DomUtility.Attrs.getTotalWidth(this._element.raw, computed);

        const primaryAxisAlignment = delegate.primaryAlignment ?? AnchorPrimaryAxisAlignment.Vertical;
        const horizontalPos = delegate?.horizontalPosition ?? AnchorHorizontalPosition.Right;
        const verticalPos = delegate?.verticalPosition ?? AnchorVerticalPosition.Below;

        // consider the vertical placement first
        if (primaryAxisAlignment === AnchorPrimaryAxisAlignment.Vertical) {
            let currMode: AnchorMode = AnchorMode.Avoid;

            // place vertical first
            const verticalAnchor: IAnchorBox = {
                offset: anchorBox.top - window.scrollY,
                size: anchorBox.height,
                direction: verticalPos === AnchorVerticalPosition.Below ? AnchorAbstractPosition.Before : AnchorAbstractPosition.After,
                mode: currMode,
            };
            top = window.scrollY + calcViewPositionAlongAxis(window.innerHeight, elementHeight, verticalAnchor);

            /**
             * If the element intersects vertically with anchor, we must 
             * avoid the anchor.
             */
            if (Range.intersection(
                { 
                    start: top, 
                    end: top + elementHeight 
                }, 
                { 
                    start: verticalAnchor.offset, 
                    end: verticalAnchor.offset + verticalAnchor.size 
                })
            ) {
                currMode = AnchorMode.Avoid;
            } else {
                currMode = AnchorMode.Align;
            }

            // place horizontal second
            const horizontalAnchor: IAnchorBox = {
                offset: anchorBox.left,
                size: anchorBox.width,
                direction: horizontalPos === AnchorHorizontalPosition.Left ? AnchorAbstractPosition.Before : AnchorAbstractPosition.After,
                mode: currMode,
            };
            left = calcViewPositionAlongAxis(window.innerWidth, elementWidth, horizontalAnchor);
        }

        // consider the horizontal placement first
        else {
            let currMode: AnchorMode = AnchorMode.Avoid;

            // place horizontal first
            const horizontalAnchor: IAnchorBox = {
                offset: anchorBox.left,
                size: anchorBox.width,
                direction: horizontalPos === AnchorHorizontalPosition.Left ? AnchorAbstractPosition.Before : AnchorAbstractPosition.After,
                mode: currMode,
            };
            left = calcViewPositionAlongAxis(window.innerWidth, elementWidth, horizontalAnchor);
            
            /**
             * If the element intersects horizontally with anchor, we must 
             * avoid the anchor.
             */
            if (Range.intersection(
                { 
                    start: left, 
                    end: left + elementWidth
                }, 
                { 
                    start: horizontalAnchor.offset, 
                    end: horizontalAnchor.offset + horizontalAnchor.size 
                }
            )) {
                currMode = AnchorMode.Avoid;
            } else {
                currMode = AnchorMode.Align;
            }

            // place vertical second
            const verticalAnchor: IAnchorBox = {
                offset: anchorBox.top,
                size: anchorBox.height,
                direction: verticalPos === AnchorVerticalPosition.Below ? AnchorAbstractPosition.Before : AnchorAbstractPosition.After,
                mode: currMode,
            };
            top = window.pageYOffset + calcViewPositionAlongAxis(window.innerHeight, elementHeight, verticalAnchor);
        }

        return { top, left };
    }

    private __getAnchorBox(delegate: IContextMenuDelegate): IDomBox {
        
        let box: IDomBox;
        const anchor = delegate.getAnchor();

        // if the anchor is an node, we find the dimension of it.
        if (DomUtility.Elements.isHTMLElement(anchor)) {
            const anchorDimension = DomUtility.Positions.getNodePagePosition(anchor);
            box = {
                top: anchorDimension.top,
                left: anchorDimension.left,
                width: anchorDimension.width,
                height: anchorDimension.height,
            };
        } 
        // if the anchor is just a point,
        else {
            box = {
                top: anchor.y,
                left: anchor.x,
                width: anchor.width || 2,
                height: anchor.height || 2
            };
        }

        return box;
    }
}
