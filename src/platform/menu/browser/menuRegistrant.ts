import { Disposable, IDisposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { Arrays } from "src/base/common/utilities/array";
import { IContextService } from "src/platform/context/common/contextService";
import { IServiceProvider } from "src/platform/instantiation/common/instantiation";
import { menuTitleApplicationRegister, menuTitleBarRegister, menuTitleEditRegister, menuTitleFileRegister, menuTitleFormatRegister, menuTitleHelpRegister, menuTitleInsertRegister, menuTitleSelectionRegister, menuTitleViewRegister } from "src/platform/menu/common/menu.register";
import { IRegistrant, RegistrantType } from "src/platform/registrant/common/registrant";
import { menuFileTreeContextRegister } from "src/workbench/services/fileTree/menu.register";
import { MenuTypes, IMenuItemRegistration, IMenuItemRegistrationResolved } from "src/platform/menu/common/menu";
import { menuRecentOpenRegister } from "src/platform/app/common/menu.register";

/**
 * An interface only for {@link MenuRegistrant}.
 */
export interface IMenuRegistrant extends IRegistrant<RegistrantType.Menu> {
    
    /**
     * Fires when the content of the menu changes.
     */
    readonly onDidMenuChange: Register<MenuTypes>;
    
    /**
     * @description Register a menu item into the given menu.
     * @return Return a disposable that will un-register the item.
     */
    registerMenuItem(menu: MenuTypes, item: IMenuItemRegistration): IDisposable;

    /**
     * @description Returns an array of items of the given menu.
     */
    getMenuitems(menu: MenuTypes): IMenuItemRegistration[];

    /**
     * @description Resolves and returns menu items for the specified menu type.
     * Converts context-based conditions (`when` and `toggled`) to boolean values 
     * and recursively resolves submenu items.
     */
    getMenuItemsResolved(menu: MenuTypes): IMenuItemRegistrationResolved[];

    /**
     * @description Returns an array of all the registered menu items.
     */
    getAllMenus(): [MenuTypes, IMenuItemRegistration[]][];

    /**
     * @description Removes all menu items registered under the specified menu type.
     * @param The menu type for which all registered items will be removed.
     */
    clearMenuItems(menu: MenuTypes): void;
}

export class MenuRegistrant extends Disposable implements IMenuRegistrant {

    // [fields]

    public readonly type = RegistrantType.Menu;
    private readonly menus: Map<MenuTypes, IMenuItemRegistration[]> = new Map();

    // [event]

    private readonly _onDidMenuChange = this.__register(new Emitter<MenuTypes>());
    public readonly onDidMenuChange = this._onDidMenuChange.registerListener;
    
    // [constructor]

    constructor(
        @IContextService private readonly contextService: IContextService
    ) {
        super();
    }

    // [public methods]

    public initRegistrations(provider: IServiceProvider): void {
        [
            // title
            menuTitleBarRegister,
            menuTitleApplicationRegister,
            menuTitleFileRegister,
            menuTitleEditRegister,
            menuTitleSelectionRegister,
            menuTitleInsertRegister,
            menuTitleFormatRegister,
            menuTitleViewRegister,
            menuTitleHelpRegister,

            menuRecentOpenRegister,
            menuFileTreeContextRegister,
        ]
        .forEach(register => register(provider));
    }

    public registerMenuItem(menu: MenuTypes, item: IMenuItemRegistration): IDisposable {
        let items = this.menus.get(menu);
        if (!items) {
            items = [];
            this.menus.set(menu, items);
        }

        items.push(item);
        this._onDidMenuChange.fire(menu);

        return {
            dispose: () => {
                Arrays.remove(items, item);
                this._onDidMenuChange.fire(menu);
            }
        };
    }

    public getMenuitems(menu: MenuTypes): IMenuItemRegistration[] {
        const result = this.menus.get(menu) || [];
        return result.filter(item => {
                    return this.contextService.contextMatchExpr(item.when ?? null);
                });
    }

    public getMenuItemsResolved(menu: MenuTypes): IMenuItemRegistrationResolved[] {
        const items = this.menus.get(menu) || [];
        return items.map(item => this.__resolveMenuItem(item));
    }

    public getAllMenus(): [MenuTypes, IMenuItemRegistration[]][] {
        const result: [MenuTypes, IMenuItemRegistration[]][] = [];
        for (const [type, registrations] of this.menus) {
            result.push([type, registrations]);
        }
        return result;
    }

    public clearMenuItems(menu: MenuTypes): void {
        if (this.menus.has(menu)) {
            this.menus.delete(menu);
            this._onDidMenuChange.fire(menu);
        }
    }

    // [private helper methods]

    private __resolveMenuItem(item: IMenuItemRegistration): IMenuItemRegistrationResolved {
        
        // resolve conditions from `ContextKeyExpr` to actual `boolean`
        const whenResolved = this.contextService.contextMatchExpr(item.when ?? null);
        const toggledResolved = item.command.checked
            ? this.contextService.contextMatchExpr(item.command.checked)
            : undefined;
    
        // resolve submenu recursively
        const resolvedSubmenu = item.submenu
            ? this.getMenuItemsResolved(item.submenu)
            : undefined;
    
        return {
            ...item,
            command: {
                ...item.command,
                when: whenResolved,
                checked: toggledResolved
            },
            when: whenResolved,
            submenu: resolvedSubmenu
        };
    }
}