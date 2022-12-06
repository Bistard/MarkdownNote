import { ContextMenuService, IContextMenuService } from 'src/code/browser/service/contextMenuService';
import { IInstantiationService } from "src/code/platform/instantiation/common/instantiation";
import { ServiceDescriptor } from "src/code/platform/instantiation/common/descriptor";
import { IComponentService } from "src/code/browser/service/component/componentService";
import { WorkbenchLayout } from "src/code/browser/workbench/layout";
import { IWorkbenchService } from "src/code/browser/service/workbench/workbenchService";
import { IKeyboardScreenCastService } from "src/code/browser/service/keyboard/keyboardScreenCastService";
import { IConfigService } from "src/code/platform/configuration/common/abstractConfigService";
import { BuiltInConfigScope } from "src/code/platform/configuration/common/configRegistrant";
import { IThemeService } from "src/code/browser/service/theme/themeService";
import { ISideBarService } from "src/code/browser/workbench/sideBar/sideBar";
import { ISideViewService } from "src/code/browser/workbench/sideView/sideView";
import { IWorkspaceService } from "src/code/browser/workbench/workspace/workspace";
import { Disposable } from 'src/base/common/dispose';
import { IContextService } from 'src/code/platform/context/common/contextService';
import { IContextKey } from 'src/code/platform/context/common/contextKey';
import { IS_LINUX, IS_MAC, IS_WINDOWS } from 'src/base/common/platform';
import { IEditorService } from 'src/code/browser/workbench/workspace/editor/editor';
import { IBrowserLifecycleService, ILifecycleService, LifecyclePhase } from 'src/code/platform/lifecycle/browser/browserLifecycleService';
import { IBrowserEnvironmentService, IEnvironmentService } from 'src/code/platform/environment/common/environment';

/**
 * @class Workbench represents all the Components in the web browser.
 */
export class Workbench extends WorkbenchLayout implements IWorkbenchService {

    // [field]

    private _contextKeyCentre?: WorkbenchContextKeyCentre;

    // [constructor]

    constructor(
        parent: HTMLElement,
        @IInstantiationService instantiationService: IInstantiationService,
        @IConfigService configService: IConfigService,
        @IComponentService componentService: IComponentService,
        @IThemeService themeService: IThemeService,
        @ISideBarService sideBarService: ISideBarService,
        @ISideViewService sideViewService: ISideViewService,
        @IWorkspaceService workspaceService: IWorkspaceService,
        @ILifecycleService private readonly lifecycleService: IBrowserLifecycleService,
    ) {
        super(parent, instantiationService, componentService, themeService, sideBarService, sideViewService, workspaceService, configService);
    }

    // [public methods]

    public init(): void {
        // initialization services
        this.initServices();
        
        // create each UI part of the workbench
        this.create();

        // register all the relavent listeners
        this.registerListeners();

        // once everything is done we layout the workbench
        this.layout();
    }

    protected initServices(): void {

        // workbench-service
        this.instantiationService.register(IWorkbenchService, this);

        // FIX: deprecated
        this.instantiationService.register(IContextMenuService, new ServiceDescriptor(ContextMenuService));
    }

    /**
     * @description calls 'create()' and '_registerListeners()' for each component.
     */
    protected override _createContent(): void {
        this.__createLayout();

        // open the side view with default one
        const defaultView = this.configService.get<string>(BuiltInConfigScope.User, 'sideView.default', 'explorer');
        this.sideViewService.switchView(defaultView);
    }

    /**
     * @description register renderer process global listeners.
     */
    protected override _registerListeners(): void {
        this.__registerLayoutListeners();
        this.__registerConfigurationChange();

        // initialize all the context keys only when the application is ready
        this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
            this._contextKeyCentre = this.instantiationService.createInstance(WorkbenchContextKeyCentre);
            this.__register(this._contextKeyCentre);
        });
    }

    // [private helper methods]

    /**
     * @description Responses to configuration change.
     */
    private __registerConfigurationChange(): void {
        this.__registerGlobalConfigurationChange();
    }

    private __registerGlobalConfigurationChange(): void {
        const ifEnabled = this.configService.get<boolean>(BuiltInConfigScope.User, 'workbench.keyboardScreenCast');
        
        let screenCastService: IKeyboardScreenCastService;

        if (ifEnabled) {
            screenCastService = this.instantiationService.getOrCreateService(IKeyboardScreenCastService);
            screenCastService.start();
        }

        this.configService.onDidChange<boolean>(BuiltInConfigScope.User, 'workbench.keyboardScreenCast', ifEnabled => {
            if (ifEnabled) {
                screenCastService.start();
            } else {
                screenCastService.dispose();
            }
        });
    }
}

export class WorkbenchContextKeyCentre extends Disposable {

    // [context - platform]

    // [context - side view]

    private readonly visibleSideView: IContextKey<boolean>;
    private readonly focusedSideView: IContextKey<boolean>;

    // [context - editor]

    private readonly focusedEditor: IContextKey<boolean>;

    // [constructor]

    constructor(
        @IContextService contextService: IContextService,
        @ISideViewService private readonly sideViewService: ISideViewService,
        @IEditorService private readonly editorService: IEditorService,
        @IEnvironmentService environmentService: IBrowserEnvironmentService,
    ) {
        super();

        // constant contexts
        {
            // platform
            contextService.createContextKey('isMac', IS_MAC, 'If the running platform is macOS');
            contextService.createContextKey('isLinux', IS_LINUX, 'If the running platform is Linux');
            contextService.createContextKey('isWindows', IS_WINDOWS, 'If the running platform is Windows');

            // environment
            contextService.createContextKey('isPackaged', environmentService.isPackaged, 'Whether the application is in release mode or develop mode');
        }

        // side view
        this.visibleSideView = contextService.createContextKey('visibleSideView', false, 'Whether a side view is visible');
        this.focusedSideView = contextService.createContextKey('focusedSideView', false, 'Whether a side view is focused');

        // editor
        this.focusedEditor = contextService.createContextKey('focusedEditor', false, 'Whether an editor is focused');

        // auto updates the context keys
        this.__registerListeners();
    }

    // [private helper methods]

    private __registerListeners(): void {

        // side view
        const currSideView = this.sideViewService.currView();
        this.visibleSideView.set(!!currSideView);
        this.__register(this.sideViewService.onDidViewChange(e => this.visibleSideView.set(!!e.view)));
        this.__register(this.sideViewService.onDidFocusChange(isFocused => this.focusedSideView.set(isFocused)));

        // editor
        this.__register(this.editorService.onDidFocusChange(isFocused => this.focusedEditor.set(isFocused)));
    }
}