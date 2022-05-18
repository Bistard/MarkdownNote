import { DataBuffer } from "src/base/common/file/buffer";
import { FileType } from "src/base/common/file/file";
import { resolve } from "src/base/common/file/path";
import { URI } from "src/base/common/file/uri";
import { Iterable } from "src/base/common/iterable";
import { String } from "src/base/common/string";
import { IIpcService } from "src/code/browser/service/ipcService";
import { Notebook } from "src/code/common/model/notebook";
import { DEFAULT_CONFIG_PATH, EGlobalSettings, EUserSettings, GLOBAL_CONFIG_FILE_NAME, GLOBAL_CONFIG_PATH, IGlobalNotebookManagerSettings, IUserNotebookManagerSettings, LOCAL_NOTA_DIR_NAME } from "src/code/common/service/configService/configService";
import { DEFAULT_CONFIG_FILE_NAME, IUserConfigService, LOCAL_CONFIG_FILE_NAME } from "src/code/common/service/configService/configService";
import { IGlobalConfigService } from "src/code/common/service/configService/configService";
import { IFileService } from "src/code/common/service/fileService/fileService";
import { createDecorator } from "src/code/common/service/instantiationService/decorator";

export const INotebookManagerService = createDecorator<INotebookManagerService>('notebook-manager-service');

export interface INotebookManagerService {
    
    /**
     * @description when opening a directory to the Notebooks, a '.nota' 
     * directory will be loaded or created. And each Notebook will be detected 
     * or initialized. If global config says no use of default config, a 
     * '.nota/user.config.json' will be created.
     * 
     * @param container The HTMLElement for rendering the whole notebooks.
     * @param path eg. D:\dev\AllNote
     * 
     * @throws An exception will be thrown if cannot open properly.
     */
    open(container: HTMLElement, path: string): Promise<void>;

    /**
     * @description Returns the root path of the {@link NotebookManager}.
     */
    root(): string;
}

/**
 * @class 
 */
export class NotebookManager implements INotebookManagerService {

    // [field]

    public static focusedFileNode: HTMLElement | null = null;
    
    /** The root path of the manager. */
    private _rootPath: string = '';

    /** Stores all the opened notebooks in memory. */
    private readonly _notebooks: Map<string, Notebook>;

    /** The current displaying notebook. */
    private _currentNotebook: string = '';

    constructor(
        @IIpcService private readonly ipcService: IIpcService,
        @IFileService private readonly fileService: IFileService,
        @IUserConfigService private readonly userConfigService: IUserConfigService,
        @IGlobalConfigService private readonly globalConfigService: IGlobalConfigService,
        
    ) {
        this._notebooks = new Map<string, Notebook>();

        this.ipcService.onApplicationClose(async () => this.__onApplicationClose());
    }

    public async open(container: HTMLElement, path: string): Promise<void> {
        
        try {
            this._rootPath = path;
            
            // read the configuration
            const userConfig = this.userConfigService.get<IUserNotebookManagerSettings>(EUserSettings.NotebookManager);
            
            // get all the names in the given directory
            const dir = await this.fileService.readDir(URI.fromFile(path));
            
            // get all the valid Notebook names in the given directory
            const notebooks = Iterable.reduce<[string, FileType], string[]>(dir, [], (tot, [str, type]) => {
                if (type !== FileType.DIRECTORY) {
                    return tot;
                }

                if (!String.regExp(str, userConfig.notebookManagerInclude.map(rule => new RegExp(rule))) && 
                    String.regExp(str, userConfig.notebookManagerExclude.map(rule => new RegExp(rule)))
                ) {
                    return tot;
                }

                tot.push(str);
                return tot;
            });

            /**
             * Only displaying one of the notebook, will try to open a previous
             * opened notebook, if not, opens the first one.
             */
            const prevNotebook = userConfig.previousOpenedNotebook;

            if (prevNotebook && notebooks.indexOf(prevNotebook) !== -1) {
                this.__switchOrCreateNotebook(container, path, userConfig, prevNotebook);
            } else {
                this.__switchOrCreateNotebook(container, path, userConfig, notebooks[0]!);
            }

        } catch(err) {
            throw err;
        }
    }

    public root(): string {
        return this._rootPath;
    }

    // [private helper method]

    /**
     * @description Given the name of the notebook, Switch to the notebook if 
     * already existed in the memory, otherwise we create a new one and stores 
     * it in the memory.
     * @param container The container for the creation of the notebook.
     * @param root The root path for the creation of the notebook.
     * @param config The configuration for later updating.
     * @param name The name of the notebook.
     */
    private __switchOrCreateNotebook(
        container: HTMLElement, 
        root: string, 
        config: IUserNotebookManagerSettings, 
        name: string
    ): void {
        
        // do nothing if the notebook is already displaying.
        if (name === this._currentNotebook) {
            return;
        }

        // try to get the notebook from the memory
        let notebook = this._notebooks.get(name);

        if (notebook) {
            // notebook is in the memory, we simply display it.
            notebook.setVisible(true);
        } else {
            // notebook not in the memory, we create a notebook.
            notebook = new Notebook(URI.fromFile(resolve(root, name)), container, this.fileService);
            this._notebooks.set(name, notebook);
        }

        notebook.onDidCreationFinished(success => {
            if (success) {
                this._currentNotebook = notebook!.name;
                config.previousOpenedNotebook = this._currentNotebook;
                
                this.userConfigService.set(EUserSettings.NotebookManager, config);
            } else {
                // this.logService();
            }
        });
    }

    /**
     * @description asynchronously write the notebook structure into the 
     * .nota/structure/`yourNotebookName`.json.
     */
    private async __notebookWriteToJSON(notebook: Notebook, name: string): Promise<void> {
        try {
            const rootpath = resolve(this._rootPath, LOCAL_NOTA_DIR_NAME, 'structure');
            await this.fileService.createFile(
                URI.fromFile(resolve(rootpath, name + '.json')), 
                DataBuffer.fromString(notebook.toJSON()), 
                { create: true, overwrite: true, unlock: true }
            );
        } catch(err) {
            throw err;
        }
    }

    /**
     * @description Invokes when the application is about to be closed.
     */
    private async __onApplicationClose(): Promise<void> {
        
        // get notebook configuration
        const notebookConfig = this.globalConfigService.get<IGlobalNotebookManagerSettings>(EGlobalSettings.NotebookManager);

        // save global configuration first
        notebookConfig.previousNotebookManagerDir = this.root();
        await this.globalConfigService.save(URI.fromFile(resolve(GLOBAL_CONFIG_PATH, LOCAL_NOTA_DIR_NAME, GLOBAL_CONFIG_FILE_NAME)));
        
        // save `user.config.json`
        if (notebookConfig.defaultConfigOn) {
            await this.userConfigService.save(URI.fromFile(resolve(DEFAULT_CONFIG_PATH, LOCAL_NOTA_DIR_NAME, DEFAULT_CONFIG_FILE_NAME)));
        }
        await this.userConfigService.save(URI.fromFile(resolve(this.root(), LOCAL_NOTA_DIR_NAME, LOCAL_CONFIG_FILE_NAME)));
        
    }

}
