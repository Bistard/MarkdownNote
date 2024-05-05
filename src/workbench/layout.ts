import { CollapseState, DirectionX, DomUtility, EventType, Orientation, addDisposableListener } from "src/base/browser/basic/dom";
import { IComponentService } from "src/workbench/services/component/componentService";
import { Component } from "src/workbench/services/component/component";
import { IWorkspaceService } from "src/workbench/parts/workspace/workspace";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { ExplorerView } from "src/workbench/contrib/explorer/explorer";
import { IContextMenuService } from "src/workbench/services/contextMenu/contextMenuService";
import { ILayoutService } from "src/workbench/services/layout/layoutService";
import { IThemeService } from "src/workbench/services/theme/themeService";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { ILogService } from "src/base/common/logger";
import { INavigationBarService } from "src/workbench/parts/navigationPanel/navigationBar/navigationBar";
import { INavigationViewService} from "src/workbench/parts/navigationPanel/navigationView/navigationView";
import { INavigationPanelService, NavigationPanel} from "src/workbench/parts/navigationPanel/navigationPanel";
import { IFunctionBarService } from "src/workbench/parts/navigationPanel/functionBar/functionBar";
import { IDimension } from "src/base/common/utilities/size";
import { IToolBarService } from "src/workbench/parts/navigationPanel/navigationBar/toolBar/toolBar";
import { ISash, Sash } from "src/base/browser/basic/sash/sash";
import { assert } from "src/base/common/utilities/panic";
import { SimpleSashController } from "src/base/browser/basic/sash/sashController";
import { Numbers } from "src/base/common/utilities/number";
import { Disposable } from "src/base/common/dispose";
import { ToggleCollapseButton } from "src/base/browser/secondary/toggleCollapseButton/toggleCollapseButton";

/**
 * @description A base class for Workbench to create and manage the behavior of
 * each sub-component.
 */
export abstract class WorkbenchLayout extends Component {

    // [fields]

    private readonly _collapseController: CollapseAnimationController;

    // [event]

    get onDidCollapseStateChange() { return this._collapseController.onDidCollapseStateChange; }

    // [constructor]

    constructor(
        protected readonly instantiationService: IInstantiationService,
        @ILogService logService: ILogService,
        @ILayoutService protected readonly layoutService: ILayoutService,
        @IComponentService componentService: IComponentService,
        @IThemeService themeService: IThemeService,
        @INavigationBarService protected readonly navigationBarService: INavigationBarService,
        @IToolBarService protected readonly toolBarService: IToolBarService,
        @IFunctionBarService protected readonly functionBarService: IFunctionBarService,
        @INavigationViewService protected readonly navigationViewService: INavigationViewService,
        @INavigationPanelService protected readonly navigationPanelService: INavigationPanelService,
        @IWorkspaceService protected readonly workspaceService: IWorkspaceService,
        @IConfigurationService protected readonly configurationService: IConfigurationService,
        @IContextMenuService protected readonly contextMenuService: IContextMenuService,
    ) {
        super('workbench', layoutService.parentContainer, themeService, componentService, logService);
        this._collapseController = new CollapseAnimationController(navigationPanelService, workspaceService);
    }

    // [protected methods]

    public override layout(): IDimension {
        /**
         * This line of code make sure the workbench will fit the whole window 
         * during window resizing.
         */
        DomUtility.Modifiers.setFastPosition(this.element, 0, 0, 0, 0, 'relative');
        return super.layout(undefined, undefined);
    }

    // [protected helper methods]

    protected __createLayout(): void {
        this.__registerNavigationViews();

        /**
         * Utilize `this.assembleComponents()` is very hard to achieve collapse/
         * expand animation for navigation panel since the internal rendering
         * is entirely handled by {@link SplitView}.
         * 
         * We choose to render by hand in this special case.
         */
        {
            this.navigationPanelService.create(this);
            this.navigationPanelService.element.setWidth(NavigationPanel.WIDTH);
            this._collapseController.render(this.element.element);
            this.workspaceService.create(this);
        }
    }

    protected __registerLayoutListeners(): void {
        this.navigationPanelService.registerListeners();
        this.workspaceService.registerListeners();

        // re-layout the entire workbench when the entire window is resizing
        this.__register(addDisposableListener(window, EventType.resize, () => {
            this.layout();
        }));

        /**
         * Listens to each NavigationBar button click events and notifies the 
         * navigationView to switch the view.
         */
        this.__register(this.navigationBarService.onDidClick(e => {
            this.navigationViewService.switchView(e.ID);
        }));

        // enable collapse/expand animation
        this._collapseController.registerListeners();
    }

    // [private helper functions]

    private __registerNavigationViews(): void {
        this.navigationViewService.registerView('explorer', ExplorerView);
        // TODO: other navigation-views are also registered here.
    }
}

/**
 * Decide how the layout should be collapsed and expanded with animation.
 */
class CollapseAnimationController extends Disposable {

    // [fields]

    private readonly navigationPanel: INavigationPanelService;
    private readonly workspace: IWorkspaceService;

    private readonly _button: ToggleCollapseButton;
    private _sash?: ISash;
    private _originalWidth?: number;

    // [event]

    get onDidCollapseStateChange() { return assert(this._button).onDidCollapseStateChange; }

    // [constructor]

    constructor(
        navigationPanel: INavigationPanelService,
        workspace: IWorkspaceService,
    ) {
        super();
        this.navigationPanel = navigationPanel;
        this.workspace = workspace;

        this._button = new ToggleCollapseButton({
            position: DirectionX.Left,
            positionOffset: 4,
            direction: DirectionX.Left,
        });
    }

    // [public methods]

    public render(container: HTMLElement): void {
        this._button.render(this.workspace.element.element);
        
        this._sash = this.__register(new Sash(container, { 
            orientation: Orientation.Vertical,
            size: 4,
            range: { start: 200, end: -1 }, // BUG (Chris): Even set the `end` to `-1`, due to the CSS rule `flex-grow: 1;` in the workspace, the maximum reach is half of screen.
            controller: SimpleSashController,
        }));
    }

    public registerListeners(): void {
        const sash = assert(this._sash);
        sash.registerListeners();

        // Based on the sash movement, we recalculate the left/right width.
        this.__register(sash.onDidMove(e => {
            const left  = this.navigationPanel.element.element;
            const right = this.workspace.element.element;
            const leftWidth   = Numbers.clamp(left.offsetWidth + e.deltaX, sash.range.start, (sash.range.end === -1) ? Number.POSITIVE_INFINITY : sash.range.end);
            const rightWidth  = Numbers.clamp(right.offsetWidth + e.deltaX, sash.range.start, (sash.range.end === -1) ? Number.POSITIVE_INFINITY : sash.range.end);
            left.style.width  = `${leftWidth}px`;
            right.style.width = `${rightWidth}px`;
        }));

        // manage navigation-panel collapse/expand
        this.__register(this.onDidCollapseStateChange(state => {
            const left = this.navigationPanel.element.element;
            const right = this.workspace.element.element;
            const transitionTime = '0.2';

            if (state === CollapseState.Collapse) {
                left.style.transition = `width ${transitionTime}s ease`;
                this._originalWidth = right.offsetLeft;
                left.style.width = `0px`;
            } 
            else {
                left.style.width = `${this._originalWidth ?? NavigationPanel.WIDTH}px`;
                
                // remove the transition animation after it finishes.
                const disposable = addDisposableListener(left, EventType.transitionend, (e) => {
                    if (e.target === left && e.propertyName === 'width') {
                        left.style.transition = '';
                        disposable.dispose();
                    }
                });
            }
        }));
    }
}