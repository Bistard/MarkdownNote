import { Disposable, DisposableManager, IDisposable } from "src/base/common/dispose";
import { RelayEmitter } from "src/base/common/event";
import { URI } from "src/base/common/files/uri";
import { IScheduler, Scheduler } from "src/base/common/utilities/async";
import { FileItem } from "src/workbench/services/fileTree/fileItem";
import { IFileTreeOpenEvent } from "src/workbench/services/fileTree/fileTree";
import { FileTreeService, IFileTreeService } from "src/workbench/services/fileTree/fileTreeService";
import { ITreeService, TreeMode } from "src/workbench/services/explorerTree/treeService";
import { SideViewConfiguration } from "src/workbench/parts/sideView/configuration.register";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { IFileService } from "src/platform/files/common/fileService";
import { IResourceChangeEvent } from "src/platform/files/common/resourceChangeEvent";
import { createService } from "src/platform/instantiation/common/decorator";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { ILogService } from "src/base/common/logger";
import { Time, TimeUnit } from "src/base/common/date";
import { AsyncResult, ok } from "src/base/common/error";

export const IExplorerTreeService = createService<IExplorerTreeService>('explorer-tree-service');

export interface IExplorerTreeService extends ITreeService<FileItem> {

    /**
     * The displaying tree mode.
     */
    readonly mode: TreeMode;
}

export class ExplorerTreeService extends Disposable implements IExplorerTreeService {

    declare _serviceMarker: undefined;

    // [event]

    private readonly _onSelect = this.__register(new RelayEmitter<IFileTreeOpenEvent<FileItem>>());
    public readonly onSelect = this._onSelect.registerListener;

    // [field]

    /** The root directory of the opened tree, undefined if not opened. */
    private _root?: URI;
    
    /** The current tree display mode. */
    private _mode: TreeMode;

    private readonly classicTreeService: IFileTreeService;

    private _currTreeDisposable?: IDisposable;
    private _currentTreeService?: ITreeService<FileItem>;
    private _onDidResourceChangeScheduler?: IScheduler<IResourceChangeEvent>;

    private static readonly ON_RESOURCE_CHANGE_DELAY = new Time(TimeUnit.Milliseconds, 100);

    // [constructor]

    constructor(
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IConfigurationService configurationService: IConfigurationService,
        @IInstantiationService instantiationService: IInstantiationService,
    ) {
        super();
        this._root = undefined;
        this._mode = configurationService.get<TreeMode>(SideViewConfiguration.ExplorerViewMode, TreeMode.Classic);
        this.classicTreeService = instantiationService.createInstance(FileTreeService);
        this.__register(this.classicTreeService);
    }

    // [getter / setter]

    get mode(): TreeMode {
        return this._mode;
    }

    get container(): HTMLElement | undefined {
        return this.isOpened ? this.classicTreeService.container : undefined;
    }

    get root(): URI | undefined {
        return this._root;
    }

    get isOpened(): boolean {
        return !!this._root;
    }

    // [public mehtods]

    public init(container: HTMLElement, root: URI, mode?: TreeMode): AsyncResult<void, Error> {
        return this.classicTreeService.init(container, root)
        .andThen(() => {
            this._currentTreeService = this.classicTreeService;
            this._root = root;
            this._mode = mode ?? this._mode;
            this._onSelect.setInput(this._currentTreeService.onSelect);

            this.__registerTreeListeners(root);

            return ok();
        });
    }

    public layout(height?: number | undefined): void {
        if (!this._root) {
            return;
        }
        this._currentTreeService!.layout(height);
    }

    public async refresh(): Promise<void> {
        if (!this._root) {
            return;
        }

        this._currentTreeService!.refresh();
    }

    public async close(): Promise<void> {
        if (!this._root) {
            return;
        }

        // dispose the watching request on the root
        this._currTreeDisposable!.dispose();
        this._currTreeDisposable = undefined;

        // close the actual tree service
        this._currentTreeService!.close();
        this._currentTreeService = undefined;
    }

    // [private helper methods]

    /**
     * @description Registers tree related listeners when initializing.
     */
    private __registerTreeListeners(root: URI): void {

        // create a disposable for all the current tree business
        const disposables = new DisposableManager();
        this._currTreeDisposable = disposables;

        // on did resource change callback
        this._onDidResourceChangeScheduler = new Scheduler(
            ExplorerTreeService.ON_RESOURCE_CHANGE_DELAY,
            (events: IResourceChangeEvent[]) => {
                if (!root || !this._currentTreeService) {
                    return;
                }

                let affected = false;
                for (const event of events) {
                    if (event.affect(root)) {
                        affected = true;
                        break;
                    }
                }

                if (affected) {
                    this._currentTreeService.refresh();
                }
            }
        );

        const result = this.fileService.watch(root, { recursive: true });
        result.match<void>(
            (disposable) => disposables.register(disposable),
            error => this.logService.warn('ExplorerTreeService', 'Cannot watch the root directory.', { at: URI.toString(root), error: error, }),
        );
        
        disposables.register(this._onDidResourceChangeScheduler);
        disposables.register(this.fileService.onDidResourceChange(e => {
            this._onDidResourceChangeScheduler?.schedule(e.wrap());
        }));
    }
}