import { app, Menu, MenuItemConstructorOptions } from "electron";
import { Event } from "src/base/common/event";
import { ILogService } from "src/base/common/logger";
import { IpcChannel } from "src/platform/ipc/common/channel";
import { SafeIpcMain } from "src/platform/ipc/electron/safeIpcMain";
import { IMenuItemRegistrationResolved, mainMenuTypes, MenuTypes } from "src/platform/menu/common/menu";
import { IMenuService } from "src/platform/menu/common/menu";
import { IMainWindowService } from "src/platform/window/electron/mainWindowService";

/**
 * @description A macOS-specific service responsible for managing the menu bar in the 
 * main process. This service handles the construction, updating, and event handling 
 * of the application menu located in the top-left corner of the macOS interface.
 */
export class MainMenuService implements IMenuService {

    declare _serviceMarker: undefined;
    private readonly menuItemsMap: Map<MenuTypes, IMenuItemRegistrationResolved[]> = new Map();

    constructor(
        @ILogService private readonly logService: ILogService,
        @IMainWindowService private readonly mainWindowService: IMainWindowService
    ) {
        this.registerListener();
    }

    private registerListener() {
        Event.onceSafe(this.mainWindowService.onDidOpenWindow)(window => {
            Event.onceSafe(window.onRendererReady)(() => {
                window.sendIPCMessage(IpcChannel.Menu);
                
                /**
                 * Whenever receive data at the channel from the renderer process, 
                 * we refresh the content of the menu.
                 */
                SafeIpcMain.instance.on(IpcChannel.Menu, (_, menuItems: [MenuTypes, IMenuItemRegistrationResolved[]][]) => {
                    clearTimeout(maxDelay);
                    for (const [menuType, items] of menuItems) {
                        this.menuItemsMap.set(menuType, items);
                    }
                    this.buildMenu();
                });

                const maxDelay = setTimeout(() => {
                    this.logService.error('MainMenuService', `Loading menu items failed: Cannot receive response from the renderer process (${window.id}). Reaching maximum loading time.`);
                }, 5000);
            });
        });
    }

    // Builds and sets the application menu
    private buildMenu() {
        const menu = Menu.buildFromTemplate(this.getMenuTemplate());
        
        // set application menu for the entire app
        Menu.setApplicationMenu(menu);

        /**
         * Set the context menu for the macOS dock icon, shown when 
         * right-clicking the app icon in the dock.
         */
        app.dock.setMenu(menu);
        this.logService.debug('MainMenuService', 'Application menu has been set.');
    }

    private getMenuTemplate(): MenuItemConstructorOptions[] {

        // Build the menu template
        const menuTemplate: MenuItemConstructorOptions[] = mainMenuTypes.map((menu) => {
            const menuItems = this.menuItemsMap.get(menu.type) || [];
            const submenu = this.buildSubmenu(menuItems);

            return {
                label: menu.label,
                submenu: submenu.length > 0 ? submenu : undefined,
            };
        });

        return menuTemplate;
    }

    private buildSubmenu(menuItems: IMenuItemRegistrationResolved[]): MenuItemConstructorOptions[] {
        const electronSubmenuItems: MenuItemConstructorOptions[] = [];

        // group the menu items by 'group' and sort them
        const groupedItems = new Map<string, IMenuItemRegistrationResolved[]>();
        for (const item of menuItems) {
            const groupName = item.group || 'no_groups';

            let group = groupedItems.get(groupName);
            if (!group) {
                group = [];
                groupedItems.set(groupName, group);
            }
            group.push(item);
        }

        // Sort groups
        const groupNames = Array.from(groupedItems.keys()).sort();

        groupNames.forEach((groupName, index) => {
            const eachGroup = groupedItems.get(groupName)!;
            eachGroup.forEach((item) => {
                const accelerator = item.command.mac || item.command.keybinding;
                const hasSubmenu = item.submenu && item.submenu.length > 0;

                const electronMenuItem: MenuItemConstructorOptions = {
                    label: item.title,
                    accelerator,
                    click: () => this.onMenuItemClick(item.command.commandID, item.command.args),
                    enabled: item.when ?? true,
                    type: item.command.checked ? 'checkbox' : undefined,
                    checked: item.command.checked,
                    submenu: hasSubmenu ? this.buildSubmenu(item.submenu) : undefined
                };

                electronSubmenuItems.push(electronMenuItem);
            });

            // Add separator between groups if not the last group
            if (index < groupNames.length - 1 && eachGroup.length > 0) {
                electronSubmenuItems.push({ type: 'separator' });
            }
        });

        return electronSubmenuItems;
    }

    private onMenuItemClick(commandID: string, args?: any[]): void {
        let window = this.mainWindowService.getFocusedWindow();

        if (!window) {
			const lastActiveWindow = this.mainWindowService.getPrevFocusedWindow();
            if (lastActiveWindow?.browserWindow.isMinimized()) {
                // make sure to run commands when the last active window is minimized
				window = lastActiveWindow;
			}
		}

        if (window) {
            window.sendIPCMessage(IpcChannel.rendererRunCommand, {
                commandID: commandID,
                args: args || []
            });
            this.logService.debug('MainMenuService', `Executing CommandID '${commandID}' to renderer process`);
        }
    }
}

