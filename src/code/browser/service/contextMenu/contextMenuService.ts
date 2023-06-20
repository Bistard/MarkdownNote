import { ContextMenuView, IAnchor, IContextMenu, IContextMenuDelegate, IContextMenuDelegateBase } from "src/base/browser/basic/contextMenu/contextMenu";
import { addDisposableListener, DomEmitter, DomEventHandler, DomUtility, EventType } from "src/base/browser/basic/dom";
import { IMenu, IMenuActionRunEvent, Menu, MenuWithSubmenu } from "src/base/browser/basic/menu/menu";
import { IMenuAction, MenuItemType } from "src/base/browser/basic/menu/menuItem";
import { Disposable, DisposableManager, IDisposable } from "src/base/common/dispose";
import { ILayoutService } from "src/code/browser/service/layout/layoutService";
import { IMicroService, createService } from "src/code/platform/instantiation/common/decorator";
import { isCancellationError } from "src/base/common/error";
import { INotificationService } from "src/code/browser/service/notification/notificationService";

export const IContextMenuService = createService<IContextMenuService>('context-menu-service');

/**
 * @test Enable this setting to prevent any external actions from closing the 
 * context menu.
 */
const DEBUG_MODE: boolean = false;

/**
 * A delegate to provide external data dn functionalities to help to show a 
 * context menu.
 */
export interface IContextMenuServiceDelegate extends IContextMenuDelegateBase {
    
    /**
     * @description A list of actions for each context menu item.
     */
    getActions(): IMenuAction[];

    /**
     * @description Returns the running context for all the actions.
     */
    getContext(): unknown;

    /**
     * @description Allow the client to customize the style of the context menu.
     */
    getContextMenuClassName?(): string;
}

/**
 * An interface only for {@link ContextMenuService}.
 */
export interface IContextMenuService extends IMicroService {
    
    /**
     * @description Shows up a context menu.
     * @param delegate The delegate to provide external functionalities.
     * @param container The container that contains the context menu. If not
     *                  provided, it will be positioned under the workbench.
     */
    showContextMenu(delegate: IContextMenuServiceDelegate, container?: HTMLElement): void;

    /**
     * @description Destroy the current context menu if existed.
     */
    destroyContextMenu(): void;
}

/**
 * @class A context menu service provides functionality to pop up a context menu 
 * by providing a {@link IContextMenuServiceDelegate} to define how the context 
 * menu should be constructed and rendered.
 */
export class ContextMenuService extends Disposable implements IContextMenuService {

    _microserviceIdentifier: undefined;

    // [fields]

    // singleton
    private readonly _contextMenu: IContextMenu;
    
    // The current container of the context menu.
    private _currContainer?: HTMLElement;
    private readonly _defaultContainer: HTMLElement;

    // [constructor]

    constructor(
        @ILayoutService private readonly layoutService: ILayoutService,
        @INotificationService private readonly notificationService: INotificationService,
    ) {
        super();
        this._defaultContainer = this.layoutService.parentContainer;
        this._currContainer = this._defaultContainer;
        this._contextMenu = new ContextMenuView(this._currContainer);
    }

    // [public methods]

    public showContextMenu(delegate: IContextMenuServiceDelegate, container?: HTMLElement): void {
        
        // since the delegate provies no actions, we render nothing.
        if (delegate.getActions().length === 0) {
            return;
        }

        const focusElement = <HTMLElement | undefined>(
            container ?? DomUtility.Elements.getActiveElement()
        );

        // have to render first (add into a container)
        if (!focusElement) {
            this._contextMenu.setContainer(this._defaultContainer);
        } else {
            this._contextMenu.setContainer(focusElement);
        }

        // show up a context menu
        this._contextMenu.show(
            new __ContextMenuDelegate(
                delegate, 
                this._contextMenu, 
                this.__onBeforeActionRun.bind(this), 
                this.__onDidActionRun.bind(this)
            ),
        );
    }

    public destroyContextMenu(): void {
        this._contextMenu.destroy();
    }

    // [private methods]

    private __onBeforeActionRun(event: IMenuActionRunEvent): void {
        if (event.action.type !== MenuItemType.Submenu) {
            this._contextMenu.destroy();
        }
    }

    private __onDidActionRun(event: IMenuActionRunEvent): void {
        if (event.error && !isCancellationError(event.error)) {
            this.notificationService.error(event.error);
        }
    }
}

class __ContextMenuDelegate implements IContextMenuDelegate {

    // [fields]

    private _menu?: IMenu;
    private readonly _delegate: IContextMenuServiceDelegate;
    private readonly _contextMenu: IContextMenu;
    private _onBeforeActionRun: (event: IMenuActionRunEvent) => void;
    private _onDidActionRun: (event: IMenuActionRunEvent) => void;

    // [constructor]

    constructor(
        delegate: IContextMenuServiceDelegate,
        contextMenu: IContextMenu,
        onBeforeActionRun: (event: IMenuActionRunEvent) => void,
        onDidActionRun: (event: IMenuActionRunEvent) => void,
        ) {
        this._menu = undefined;
        this._delegate = delegate;
        this._contextMenu = contextMenu;
        this._onBeforeActionRun = onBeforeActionRun;
        this._onDidActionRun = onDidActionRun;
    }

    // [public methods]

    public getAnchor(): HTMLElement | IAnchor {
        return this._delegate.getAnchor();
    }

    public render(container: HTMLElement): IDisposable {
        const menuDisposables = new DisposableManager();
        const delegate = this._delegate;
        const contextMenu = this._contextMenu;

        const menuClassName = delegate.getContextMenuClassName?.() ?? '';
        if (menuClassName) {
            container.classList.add(menuClassName);
        }

        // menu construction
        this._menu = menuDisposables.register(
            new MenuWithSubmenu(
                new Menu(container, {
                    contextProvider: () => delegate.getContext(),
                }),
            )
        );
        const menu = this._menu;

        // build menu
        menu.build(delegate.getActions());

        /**
         * If on debug mode, we do not wish to destroy the context menu 
         * automatically.
         */
        if (DEBUG_MODE) {
            return menuDisposables;
        }

        // context menu destroy event
        [
            menu.onDidBlur,
            menu.onDidClose,
            new DomEmitter(window, EventType.blur).registerListener,
        ]
        .forEach(onEvent => {
            menuDisposables.register(
                onEvent.call(menu, () => contextMenu.destroy())
            );
        });

        // mousedown destroy event
        menuDisposables.register(addDisposableListener(window, EventType.mousedown, (e) => {
            if (e.defaultPrevented) {
                return;
            }

            /**
             * We are likely creating a context menu, let the context 
             * menu service to destroy it.
             */
            if (DomEventHandler.isRightClick(e)) {
                return;
            }

            // clicking the child element will not destroy the view.
            if (DomUtility.Elements.isAncestor(container, <HTMLElement | undefined>e.target)) {
                return;
            }

            contextMenu.destroy();
        }));

        // running action events
        menuDisposables.register(menu.onBeforeRun(this._onBeforeActionRun, undefined, this));
        menuDisposables.register(menu.onDidRun(this._onDidActionRun, undefined, this));

        return menuDisposables;
    }

    public onFocus(): void {
        // only focus the entire menu
        this._menu?.focus(-1);
    }

    public onBeforeDestroy(): void {
        // TEST
        console.log('delegate: on before destroy');
    }
}
