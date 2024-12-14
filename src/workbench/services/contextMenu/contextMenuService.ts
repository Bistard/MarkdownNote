import { ContextMenuView, IAnchor, IContextMenu, IContextMenuDelegate, IContextMenuDelegateBase } from "src/base/browser/basic/contextMenu/contextMenu";
import { addDisposableListener, DomEmitter, DomEventHandler, DomUtility, EventType } from "src/base/browser/basic/dom";
import { IMenu, IMenuActionRunEvent, Menu, MenuWithSubmenu } from "src/base/browser/basic/menu/menu";
import { CheckMenuAction, IMenuAction, MenuItemType, MenuSeparatorAction, SimpleMenuAction, SubmenuAction } from "src/base/browser/basic/menu/menuItem";
import { Disposable, DisposableManager, IDisposable } from "src/base/common/dispose";
import { ILayoutService } from "src/workbench/services/layout/layoutService";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { isCancellationError } from "src/base/common/error";
import { INotificationService } from "src/workbench/services/notification/notificationService";
import { isDefined } from "src/base/common/utilities/type";
import { MenuTypes } from "src/platform/menu/common/menu";
import { RegistrantType } from "src/platform/registrant/common/registrant";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { ICommandService } from "src/platform/command/common/commandService";
import { IRegistrantService } from "src/platform/registrant/common/registrantService";
import { ITreeContextmenuEvent } from "src/base/browser/secondary/tree/tree";
import { IContextService } from "src/platform/context/common/contextService";

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
interface IShowContextMenuDelegateBase extends IContextMenuDelegateBase {

    /**
     * @description Returns the running context for all the actions.
     */
    getContext(): unknown;

    /**
     * @description Allow the client to customize the style of the context menu.
     * If the function is not defined, the context menu will only have a class
     * named 'context-menu'.
     */
    getExtraContextMenuClassName?(): string;
}

export interface IShowContextMenuDelegate extends IShowContextMenuDelegateBase {

    /**
     * @description Defines the content of the context menu.
     */
    readonly menu: MenuTypes;
}

export interface IShowContextMenuCustomDelegate extends IShowContextMenuDelegateBase {

    /**
     * @description Defines the content of the context menu. A list of customizable
     * actions for each context menu item.
     */
    getActions(): IMenuAction[];
}

/**
 * An interface only for {@link ContextMenuService}.
 */
export interface IContextMenuService extends IService {

    /**
     * @description Shows up a context menu. the content will be filled with
     * existing menu.
     * @param delegate The delegate to provide external functionalities.
     * @param container The container that contains the context menu. If not
     *                  provided, it will be positioned under the current active
     *                  element.
     */
    showContextMenu(delegate: IShowContextMenuDelegate, container?: HTMLElement): void;

    /**
     * @description Shows up a context menu. The content is customizable.
     * @param delegate The delegate to provide external functionalities.
     * @param container The container that contains the context menu. If not
     *                  provided, it will be positioned under the current active
     *                  element.
     */
    showContextMenuCustom(delegate: IShowContextMenuCustomDelegate, container?: HTMLElement): void;

    /**
     * @description Destroy the current context menu if existed.
     */
    destroyContextMenu(): void;
}

/**
 * @class A context menu service provides functionality to pop up a context menu
 * by providing a {@link IShowContextMenuDelegate} to define how the context
 * menu should be constructed and rendered.
 */
export class ContextMenuService extends Disposable implements IContextMenuService {

    declare _serviceMarker: undefined;

    // [fields]

    // singleton
    private readonly _contextMenu: IContextMenu;

    // The current container of the context menu.
    private readonly _currContainer?: HTMLElement;
    private readonly _defaultContainer: HTMLElement;

    // [constructor]

    constructor(
        @ILayoutService private readonly layoutService: ILayoutService,
        @INotificationService private readonly notificationService: INotificationService,
        @ICommandService private readonly commandService: ICommandService,
        @IContextService private readonly contextService: IContextService,
        @IRegistrantService private readonly registrantService: IRegistrantService
    ) {
        super();
        this._defaultContainer = this.layoutService.parentContainer;
        this._currContainer = this._defaultContainer;
        this._contextMenu = new ContextMenuView(this._currContainer);
    }

    // [public methods]

    public showContextMenu(delegate: IShowContextMenuDelegate, container?: HTMLElement): void {
        this.showContextMenuCustom({
            ...delegate,
            getActions: () => this.__getActionsByMenuType(delegate.menu),
        }, container);
    }

    public showContextMenuCustom(delegate: IShowContextMenuCustomDelegate, container?: HTMLElement): void {
        if (delegate.getActions().length === 0) {
            return;
        }

        const focusElement = <HTMLElement | undefined>(
            container ?? DomUtility.Elements.getActiveElement()
        );

        if (!focusElement) {
            this._contextMenu.setContainer(this._defaultContainer);
        } else {
            this._contextMenu.setContainer(focusElement);
        }

        // show context menu
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
            this.notificationService.error(event.error, { actions: [{ label: 'Close', run: 'noop' }] });
        }
    }

    private __getActionsByMenuType(menuType: MenuTypes): IMenuAction[] {
        const registrant = this.registrantService.getRegistrant(RegistrantType.Menu);
        const menuItems = registrant.getMenuitems(menuType);

        const actions: IMenuAction[] = menuItems.map((item) => {
            // check box
            if (item.command.checked !== undefined) {
                return new CheckMenuAction({
                    id: item.title,
                    enabled: this.contextService.contextMatchExpr(item.command.when ?? null),
                    checked: this.contextService.contextMatchExpr(item.command.checked),
                    key: item.command.keybinding,
                    mac: item.command.mac,
                    extraClassName: 'toggle-item',
                    onChecked: (checked) => {
                        this.commandService.executeCommand(item.command.commandID, { checked });
                    },
                });
            }

            // submenu
            if (item.submenu !== undefined) {
                const submenuActions = this.__getActionsByMenuType(item.submenu);
                return new SubmenuAction(submenuActions, {
                    id: item.title,
                    enabled: this.contextService.contextMatchExpr(item.when ?? null),
                    extraClassName: 'submenu-item',
                });
            }

            // default
            return new SimpleMenuAction({
                enabled: this.contextService.contextMatchExpr(item.command.when ?? null),
                id: item.title,
                key: item.command.keybinding,
                mac: item.command.mac,
                callback: (ctx: ITreeContextmenuEvent<FileItem>) => {
                    this.commandService.executeCommand(item.command.commandID, ctx.data?.uri);
                },
            });
        });

        // group up actions
        const groupedActions = new Map<string, IMenuAction[]>();
        for (const action of actions) {
            const group = menuItems.find((item) => item.title === action.id)?.group || '';
            let groupActions = groupedActions.get(group);
            if (!groupActions) {
                groupActions = [];
                groupedActions.set(group, groupActions);
            }
            groupActions.push(action);
        }

        const finalActions: IMenuAction[] = [];

        // Add separators between groups
        let i = 0;
        for (const [groupName, groups] of groupedActions) {
            finalActions.push(...groups);
            if (i < groupedActions.size - 1) {
                finalActions.push(MenuSeparatorAction.instance);
            }
            i++;
        }

        return finalActions;
    }
}

class __ContextMenuDelegate implements IContextMenuDelegate {

    // [fields]

    private _menu?: IMenu;
    private readonly _delegate: IShowContextMenuCustomDelegate;
    private readonly _contextMenu: IContextMenu;
    private readonly _onBeforeActionRun: (event: IMenuActionRunEvent) => void;
    private readonly _onDidActionRun: (event: IMenuActionRunEvent) => void;

    // [constructor]

    constructor(
        delegate: IShowContextMenuCustomDelegate,
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

        const menuClassName = delegate.getExtraContextMenuClassName?.() ?? null;
        if (isDefined(menuClassName)) {
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
