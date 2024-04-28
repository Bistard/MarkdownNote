import { IComponentService } from "src/workbench/services/component/componentService";
import { Component, IAssembleComponentOpts, IComponent } from "src/workbench/services/component/component";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { IThemeService } from "src/workbench/services/theme/themeService";
import { Orientation } from "src/base/browser/basic/dom";
import { INavigationViewService, NavView} from "src/workbench/parts/navigationPanel/navigationView/navigationView";
import { INavigationBarService, NavigationBar } from "src/workbench/parts/navigationPanel/navigationBar/navigationBar";
import { FunctionBar, IFunctionBarService } from "src/workbench/parts/navigationPanel/functionBar/functionBar";
import { ILogService } from "src/base/common/logger";
import { IActionBarService } from "src/workbench/parts/navigationPanel/navigationBar/toolBar/actionBar";
import { IContextMenuService } from "src/workbench/services/contextMenu/contextMenuService";
import { Icons } from "src/base/browser/icon/icons";
import { CheckMenuAction, MenuSeparatorAction, SimpleMenuAction, SubmenuAction } from "src/base/browser/basic/menu/menuItem";
import { KeyCode, Shortcut } from "src/base/common/keyboard";
import { panic } from "src/base/common/utilities/panic";

export const INavigationPanelService = createService<INavigationPanelService>('navigation-panel-service');

export interface INavigationPanelService extends IComponent, IService {

}

export class NavigationPanel extends Component implements INavigationPanelService {

    // [fields]
    declare _serviceMarker: undefined;
    public static readonly WIDTH = 300;

    // [constructor]

    constructor(
        @IComponentService componentService: IComponentService,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @INavigationViewService protected readonly navigationViewService: INavigationViewService,
        @INavigationBarService protected readonly navigationBarService: INavigationBarService,
        @IFunctionBarService protected readonly functionBarService: IFunctionBarService,
        @IThemeService themeService: IThemeService,
        @ILogService logService: ILogService,
    ) {
        super('navigation-panel', null, themeService, componentService, logService);
    }

    // [protected override methods]

    protected override _createContent(): void {
        this.__assemblyParts();
    }

    protected override _registerListeners(): void {
        // Register any listeners needed for the navigation panel
    }

    private __assemblyParts(): void {

        const partConfigurations: IAssembleComponentOpts[] = [
            { 
                component: this.navigationBarService,
                fixed: true,
                fixedSize: NavigationBar.HEIGHT,
            },
            { 
                component: this.navigationViewService,
                minimumSize: NavView.HEIGHT,
                initSize: NavView.HEIGHT,
                maximumSize: null,
            },
            { 
                component: this.functionBarService,
                fixed: true,
                fixedSize: FunctionBar.HEIGHT,
            },
        ];
        this.assembleComponents(Orientation.Vertical, partConfigurations);
    } 
}

export class NavigationBarBuilder {

    constructor(
        private readonly actionBarService: IActionBarService,
    ) {
    }

    public registerButtons(): void {

        /**
         * primary button configurations
         */
        [
            {
                id: 'folder-open',
                icon: Icons.FolderOpen,
            },
            {
                id: 'add-new',
                icon: Icons.AddNew,
            },
        ]
            .forEach(({ id, icon}) => {
                this.actionBarService.registerPrimaryButton({
                    id: id,
                    icon: icon,
                    isPrimary: true,
                });
            });
    }
}