import { DomEventHandler, DomUtility } from "src/base/browser/basic/dom";
import { FastElement } from "src/base/browser/basic/fastElement";
import { createIcon } from "src/base/browser/icon/iconRegistry";
import { Icons } from "src/base/browser/icon/icons";
import { Action, ActionListItem, IAction, IActionListItem, IActionOptions } from "src/base/common/action";
import { IDisposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { KeyCode, Shortcut, createStandardKeyboardEvent } from "src/base/common/keyboard";
import { noop } from "src/base/common/performance";
import { IS_MAC } from "src/base/common/platform";
import { UnbufferedScheduler } from "src/base/common/util/async";

export type MenuAction = SimpleMenuAction | SubmenuAction | MenuSeperatorAction | CheckMenuAction;

export const enum MenuItemType {
    General,
    Seperator,
    Submenu,
    Check,
}

export interface IMenuAction extends IAction {

    /**
     * The type of the action.
     */
    readonly type: MenuItemType;

    /**
     * A class name to customize the style of the corresponding item in the menu.
     */
    readonly extraClassName?: string;

    /**
     * If the action is checked.
     */
    checked?: boolean;

    /**
     * The shortcut of the action.
     */
    shortcut?: Shortcut;
}

export interface IMenuActionOptions extends IActionOptions {
    
    /**
     * If the menu action has a shortcut.
     */
    readonly shortcut?: Shortcut;

    /**
     * A optional class name to customize the style of the corresponding item in
     * the menu.
     */
    readonly extraClassName?: string;
}

export interface ICheckMenuActionOptions extends Omit<IMenuActionOptions, 'callback'> {
    
    /**
     * If the menu is checked.
     */
    readonly checked: boolean;

    /**
     * Invokes whenever the menu action is checked or not.
     */
    readonly onChecked: (checked: boolean) => void;
}

export interface ISubmenuActionOptions extends Omit<IActionOptions, 'callback'> {
    
    /**
     * A optional class name to customize the style of the corresponding item in
     * the menu.
     */
    readonly extraClassName?: string;
}

class __BaseMenuAction<TType extends MenuItemType> extends Action implements IMenuAction {

    // [fields]

    public readonly type: TType;
    public shortcut?: Shortcut;

    public readonly extraClassName?: string;

    // [constructor]

    constructor(type: TType, opts: IMenuActionOptions) {
        super(opts);
        this.type = type;
        this.shortcut = opts.shortcut;
        this.extraClassName = opts.extraClassName;
    }
}

export class SimpleMenuAction extends __BaseMenuAction<MenuItemType.General> {

    constructor(opts: IMenuActionOptions) {
        super(MenuItemType.General, opts);
    }
}

export class MenuSeperatorAction extends __BaseMenuAction<MenuItemType.Seperator> {
    
    // [fields]

    public static readonly instance = new MenuSeperatorAction();
    
    // [constructor]

    private constructor() {
        super(MenuItemType.Seperator, {
            callback: noop,
            enabled: false,
            id: 'seperator',
        });
    }
}

export class CheckMenuAction extends __BaseMenuAction<MenuItemType.Check> {

    // [fields]

    public checked: boolean;

    // [constructor]

    constructor(opts: ICheckMenuActionOptions) {
        super(MenuItemType.Check, {
            ...opts,
            callback: () => {
                this.checked = !this.checked;
                opts.onChecked(this.checked);
            },
        });
        this.checked = opts.checked;
    }
}

export class SubmenuAction extends __BaseMenuAction<MenuItemType.Submenu> {

    // [fields]

    public readonly actions: IMenuAction[];
    private _onRun?: () => void;

    // [constructor]

    constructor(actions: IMenuAction[], opts: ISubmenuActionOptions) {
        super(
            MenuItemType.Submenu, 
            { ...opts, callback: () => this._onRun?.(), },
        );
        this.actions = actions;
    }

    // [public methods]

    set onRun(fn: () => void) {
        this._onRun = fn;
    }
}

/**
 * Interface for {@link AbstractMenuItem} and its inheritance.
 */
export interface IMenuItem extends IActionListItem, IDisposable {
    
    /**
     * The corresponding element of the item.
     */
    readonly element: FastElement<HTMLElement>;

    /**
     * Fires when the {@link IMenuItem} is mouse-hovered or not.
     */
    readonly onDidHover: Register<boolean>;

    /**
     * The callback function when the item is about to run. Should be set by the
     * externals.
     */
    actionRunner?: (action: IMenuAction) => void;

    /**
     * @description Renders the item into the parent.
     * @param parent The parent HTMLElement.
     * 
     * @note For addtional rendering purpose, please override `__render()` 
     * instead.
     */
    render(parent: HTMLElement): void;
    
    /**
     * @description Focus the current item in the DOM tree.
     */
    focus(): void;

    /**
     * @description Unfocus (blur) the current item in the DOM tree.
     */
    blur(): void;
}

type RenderObject = {
    readonly leftPart: HTMLElement;
    readonly content: HTMLElement;
    readonly rightPart: HTMLElement;
}

/**
 * @class The {@link AbstractMenuItem} pre-defines a series of event listeners 
 * on the HTMLElement.
 */
export abstract class AbstractMenuItem extends ActionListItem implements IMenuItem {

    // [fields]

    declare public readonly action: IMenuAction;
    private _actionRunner?: (action: IMenuAction) => void;

    public readonly element: FastElement<HTMLElement>;
    
    protected _mouseover: boolean;

    // [event]

    private readonly _onDidHover = this.__register(new Emitter<boolean>());
    public readonly onDidHover = this._onDidHover.registerListener;

    // [internal event]

    private readonly _onMouseover = this.__register(new Emitter<void>());
    protected readonly onMouseover = this._onMouseover.registerListener;

    private readonly _onMouseleave = this.__register(new Emitter<void>());
    protected readonly onMouseleave = this._onMouseleave.registerListener;

    // [constructor]

    constructor(action: IMenuAction) {
        super(action);
        this.element = this.__register(new FastElement(document.createElement('div')));
        this._mouseover = false;

        /**
         * Rendering and event registrations should be done in `__render` and
         * `__registerListeners` respectively.
         */
    }

    // [setter]

    get actionRunner(): ((action: IMenuAction) => void) | undefined {
        return this._actionRunner;
    }

    set actionRunner(runner: ((action: IMenuAction) => void) | undefined) {
        this._actionRunner = runner;
    }

    // [public methods]

    public render(parent: HTMLElement): void {
        this.__render();
        if (this.action.enabled) {
            this.__registerListeners();
        }
        parent.appendChild(this.element.element);
    }

    public onClick(event: MouseEvent): void {
        DomEventHandler.stop(event, true);
        this._actionRunner?.(this.action);
    }

    public focus(): void {
        this.element.setTabIndex(0);
        this.element.setFocus();
        this.element.addClassList('focused');
    }

    public blur(): void {
        this.element.setTabIndex(1);
        this.element.setBlur();
        this.element.removeClassList('focused');
    }

    public override dispose(): void {
        super.dispose();
    }
    
    // [private helper methods]

    /**
     * @description Override for additional rendering purpose.
     */
    protected __render(): RenderObject {
        this.element.addClassList('base-item');
        if (this.action.extraClassName) {
            this.element.addClassList(this.action.extraClassName);
        }
        this.element.toggleClassName('disabled', !this.action.enabled);

        // left-part
        const leftPart = document.createElement('div');
        leftPart.className = 'left-part';

        // content-part
        const content = document.createElement('div');
        content.className = 'content';
        
        // right-part
        const rightPart = document.createElement('div');
        rightPart.className = 'right-part';

        this.element.appendChild(leftPart);
        this.element.appendChild(content);
        this.element.appendChild(rightPart);

        return { leftPart, content, rightPart };
    }

    /**
     * @description Override for additional listeners.
     */
    protected __registerListeners(): void {

        // prevent default context menu event on each menu item
        this.element.onContextmenu(e => {
            DomEventHandler.stop(e, true);
        });

        // hovering effect
        this.element.onMouseover(() => {
            if (!this._mouseover) {
                this._onMouseover.fire();
                this._mouseover = true;
            }
        });

        this.onMouseover(() => {
            this._onDidHover.fire(true);
        });

        // hovering effect
        this.element.onMouseleave(() => {
            this._mouseover = false;
            this._onMouseleave.fire();
        });

        this.onMouseleave(() => {
            this._onDidHover.fire(false);
        });

        // add 'active' properly
        this.element.onMousedown(e => {
            DomEventHandler.stop(e, true);
            if (DomEventHandler.isLeftClick(e)) {
                this.element.addClassList('active');
            }
        });

        // handle click event
        this.element.onClick(e => {
            DomEventHandler.stop(e, true);            
            this.onClick(e);
        });

        // prevent double click
        this.element.onDoubleclick(e => {
            DomEventHandler.stop(e, true);
        });

        // remove 'active' properly
        [this.element.onMouseup, this.element.onMouseout].forEach(onEvent => {
			onEvent.call(this.element, (e) => {
                DomEventHandler.stop(e, true);
                this.element.removeClassList('active');
            });
		});

        /**
         * macOS: allow to trigger the button when holding Ctrl+key and 
         * pressing the main mouse button. This is for scenarios where e.g. 
         * some interaction forces the Ctrl+key to be pressed and hold but 
         * the user still wants to interact with the actions (for example 
         * quick access in quick navigation mode).
         */
        if (IS_MAC) {
			this.element.onContextmenu(e => {
				if (DomEventHandler.isLeftClick(e) && e.ctrlKey === true) {
					this.onClick(e);
				}
			});
		}
    }
}

/**
 * @class The {@link MenuSeperatorItem} overrides the pre-defined event 
 * listeners since the seperator suppose to have no interactions from the user.
 */
export class MenuSeperatorItem extends AbstractMenuItem {
    
    constructor(action: IMenuAction) {
        super(action);
    }

    public override onClick(event: MouseEvent): void {
        // noop
    }

    protected override __render(): RenderObject {
        const container = super.__render();
        this.element.addClassList('seperator');
        return container;
    }

    protected override __registerListeners(): void {
        // noop
    }
}

/**
 * @class {@link SimpleMenuItem} provides a general functionality as a menu item
 * that can response to user click.
 */
export class SimpleMenuItem extends AbstractMenuItem {
    
    constructor(action: IMenuAction) {
        super(action);
    }

    protected override __render(): RenderObject {
        const container = super.__render();

        this.element.addClassList('menu-item');

        const name = document.createElement('span');
        name.className = 'menu-item-name';
        name.textContent = this.action.id;

        let shortcut: HTMLElement | undefined;
        if (this.action.shortcut) {
            shortcut = document.createElement('span');
            shortcut.className = 'menu-item-shortcut';
            shortcut.textContent = this.action.shortcut.toString();
        }

        container.content.appendChild(name);
        if (shortcut) {
            container.content.appendChild(shortcut);
        }

        return container;
    }

    protected override __registerListeners(): void {
        super.__registerListeners();
    }
}

export class CheckMenuItem extends SimpleMenuItem {

    // [fields]

    // [constructor]

    constructor(action: CheckMenuAction) {
        super(action);
    }

    // [public methods]

    protected override __render(): RenderObject {
        const container = super.__render();

        if (!this.action.checked) {
            return container;
        }

        const checkIcon = createIcon(Icons.Check, ['submenu-item-check']);
        container.leftPart.appendChild(checkIcon);

        return container;
    }

    protected override __registerListeners(): void {
        super.__registerListeners();
    }
}

export interface ISubmenuDelegate {
    closeCurrSubmenu(): void;
    openNewSubmenu(anchor: HTMLElement, actions: IMenuAction[]): void;
    isSubmenuActive(): boolean;
    focusParentMenu(): void;
}

/**
 * @class A {@link SubmenuItem} provides no action functionality, instead, 
 * displays a list of actions in a submenu.
 */
export class SubmenuItem extends AbstractMenuItem {

    // [constants]

    public static readonly SHOW_DEPLAY = 250;
    public static readonly HIDE_DEPLAY = 750;

    // [field]

    declare public readonly action: SubmenuAction;

    private readonly _showScheduler: UnbufferedScheduler<void>;
    private readonly _hideScheduler: UnbufferedScheduler<void>;
    private readonly _delegate: ISubmenuDelegate;

    // [constructor]

    constructor(action: SubmenuAction, delegate: ISubmenuDelegate) {
        super(action);
        this._delegate = delegate;
        
        // scheduling initialization
        {
            this._showScheduler = new UnbufferedScheduler(SubmenuItem.SHOW_DEPLAY, () => {
                this._delegate.closeCurrSubmenu();
                this._delegate.openNewSubmenu(this.element.element, this.action.actions);
            });

            this._hideScheduler = new UnbufferedScheduler(SubmenuItem.HIDE_DEPLAY, () => {
                const active = DomUtility.Elements.getActiveElement();
                if (this._delegate.isSubmenuActive() || !DomUtility.Elements.isAncestor(this.element.element, active)) {
                    this._delegate.closeCurrSubmenu();
                    this._delegate.focusParentMenu();
                    this._mouseover = false;
                }
            });

            this.__register(this._showScheduler);
            this.__register(this._hideScheduler);
        }
    }

    // [public methods]

    public override run(context?: unknown): void {
        this._showScheduler.schedule(undefined, 0);
    }

    /**
     * @description Instead of running an action, open a submenu instead.
     */
    public override onClick(event: MouseEvent): void {
        DomEventHandler.stop(event, true);
        this._showScheduler.schedule(undefined, 0);
    }

    public override dispose(): void {
        super.dispose();
        this.element.dispose();
    }

    // [protected override methods]

    protected override __render(): RenderObject {
        const container = super.__render();
        
        this.element.addClassList('menu-item');

        const name = document.createElement('span');
        name.className = 'menu-item-name';
        name.textContent = this.action.id;

        // TODO: wrong icon, switch to AngleRight.
        const arrow = createIcon(Icons.AngleRight, ['submenu-item-arrow']);
        
        container.content.appendChild(name);
        container.rightPart.appendChild(arrow);

        return container;
    }

    protected override __registerListeners(): void {
        
        // keep the default behaviours too
        super.__registerListeners();

        this.onMouseover(() => {
            if (!this._mouseover || !this._delegate.isSubmenuActive()) {
                this._hideScheduler.cancel();
                this._showScheduler.schedule();
            }
        });

        this.onMouseleave(() => {
            this._showScheduler.cancel();
            this._hideScheduler.schedule();
        });

        // capture right arrow to open the submenu
        this.element.onKeydown(e => {
            const event = createStandardKeyboardEvent(e);
            if (event.key === KeyCode.RightArrow) {
				DomEventHandler.stop(event, true);
			}
        });

        // try to open the submenu when right arrowing
        this.element.onKeyup(e => {
            const event = createStandardKeyboardEvent(e);
            if (event.key === KeyCode.RightArrow) {
				DomEventHandler.stop(event, true);
                // prevent double openning
                if (!this._delegate.isSubmenuActive()) {
                    this._showScheduler.schedule(undefined, 0);
                }
			}
        });
    }

    // [private helper methods]

}
