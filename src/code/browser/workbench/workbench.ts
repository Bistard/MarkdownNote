import { Component, ComponentType } from "src/code/browser/workbench/component";
import { ActionViewComponent, IActionViewService } from "src/code/browser/workbench/actionView/actionView";
import { ActionBarComponent, IActionBarService } from "src/code/browser/workbench/actionBar/actionBar";
import { EditorComponent, IEditorService } from "src/code/browser/workbench/editor/editor";
import { INoteBookManagerService, LOCAL_MDNOTE_DIR_NAME, NoteBookManager } from "src/code/common/model/notebookManager";
import { APP_ROOT_PATH } from "src/base/electron/app";
import { ipcRendererOn, ipcRendererSend } from "src/base/electron/register";
import { ConfigService, DEFAULT_CONFIG_FILE_NAME, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_FILE_NAME, GLOBAL_CONFIG_PATH, LOCAL_CONFIG_FILE_NAME } from "src/code/common/service/configService";
import { pathJoin } from "src/base/common/string";
import { ContextMenuService, IContextMenuService } from 'src/code/browser/service/contextMenuService';
import { IInstantiationService } from "src/code/common/service/instantiation/instantiation";
import { ServiceDescriptor } from "src/code/common/service/instantiation/descriptor";
import { ComponentService } from "src/code/browser/service/componentService";
import { GlobalConfigService } from "src/code/common/service/globalConfigService";
import { FileLogService, IFileLogService } from "src/code/common/service/fileLogService";
import { ExplorerViewComponent, IExplorerViewService } from "./actionView/explorer/explorer";

/**
 * @description Workbench represents all the Components in the web browser.
 */
export class Workbench extends Component {

    private _noteBookManager!: INoteBookManagerService;

    actionBarComponent!: ActionBarComponent;
    actionViewComponent!: ActionViewComponent;
    editorComponent!: EditorComponent;
    
    constructor(
        private readonly instantiationService: IInstantiationService,
    ) {
        super('mainApp', null, document.body, instantiationService.createInstance(ComponentService));
        
        this.initServices();
        this.create();
        this.registerListeners();
    }

    public initServices(): void {

        // ActionBarService
        this.instantiationService.register(IActionBarService, new ServiceDescriptor(ActionBarComponent));

        // ActionViewService
        this.instantiationService.register(IActionViewService, new ServiceDescriptor(ActionViewComponent));

        // EditorService && ExplorerViewService
        this.instantiationService.register(IEditorService, new ServiceDescriptor(EditorComponent));
        this.instantiationService.register(IExplorerViewService, new ServiceDescriptor(ExplorerViewComponent));

        // ContextMenuService
        this.instantiationService.register(IContextMenuService, new ServiceDescriptor(ContextMenuService));

        // NoteBookManagerService
        this.instantiationService.register(INoteBookManagerService, new ServiceDescriptor(NoteBookManager));
        
        // FileLogService
        this.instantiationService.register(IFileLogService, new ServiceDescriptor(FileLogService));

    }

    /**
     * @description calls 'create()' and '_registerListeners()' for each component.
     */
    protected override _createContent(): void {
        
        this._noteBookManager = this.instantiationService.createInstance(NoteBookManager);
        this._noteBookManager.init(APP_ROOT_PATH);

        this.actionBarComponent = this.instantiationService.createInstance(ActionBarComponent, this);
        this.actionViewComponent = this.instantiationService.createInstance(ActionViewComponent, this);
        this.editorComponent = this.instantiationService.createInstance(EditorComponent, this);
        
        [
            {id: ComponentType.ActionBar, classes: []},
            {id: ComponentType.ActionView, classes: []},
            {id: ComponentType.editor, classes: []},
        ]
        .forEach(({ id, classes }) => {
            const component = this.getComponentById(id);
            component.create();
            component.registerListeners();
        });
    }

    /**
     * @description register renderer process global listeners.
     */
    protected override _registerListeners(): void {
        
        // once the main process notifies this renderer process, we try to 
        // finish the following job.
        ipcRendererOn('closingApp', () => {
            
            // save global configuration first
            GlobalConfigService.Instance.previousNoteBookManagerDir = this._noteBookManager.noteBookManagerRootPath;
            GlobalConfigService.Instance.writeToJSON(GLOBAL_CONFIG_PATH, GLOBAL_CONFIG_FILE_NAME)
            .then(() => {
                // save local or default configuration
                if (GlobalConfigService.Instance.defaultConfigOn) {
                    return ConfigService.Instance.writeToJSON(
                        DEFAULT_CONFIG_PATH, 
                        DEFAULT_CONFIG_FILE_NAME
                    );
                }
                return ConfigService.Instance.writeToJSON(
                    pathJoin(this._noteBookManager.noteBookManagerRootPath, LOCAL_MDNOTE_DIR_NAME), 
                    LOCAL_CONFIG_FILE_NAME
                );
            })
            .then(() => {
                ipcRendererSend('rendererReadyForClosingApp');
            });

        });

        this.container.addEventListener('click', (ev: MouseEvent) => {
            const service = this.instantiationService.getService(IContextMenuService);
            if (service) {
                service.removeContextMenu();
            }
            const menu = document.querySelector(".toastui-editor-context-menu") as HTMLElement;
            menu.style.display = 'none';
        });

        ipcRendererOn('closeContextMenu', () => {
            const service = this.instantiationService.getService(IContextMenuService);
            if (service) {
                service.removeContextMenu();
            }
        })

    }

    public getComponentById(id: string): Component {
        const component = this.componentMap.get(id);
        if (!component) {
            throw new Error(`trying to get an unknown component ${id}`);
        }
        return component;
    }

}
