import { RelayEmitter } from "src/base/common/event";
import { URI } from "src/base/common/files/uri";
import { IFileTreeOpenEvent, FileTree, IFileTree } from "src/workbench/services/fileTree/fileTree";
import { IFileService } from "src/platform/files/common/fileService";
import { FileItemChildrenProvider, FileItem as FileItem, IFileItemResolveOptions } from "src/workbench/services/fileTree/fileItem";
import { ITreeService } from "src/workbench/services/explorerTree/treeService";
import { Disposable } from "src/base/common/dispose";
import { FileItemProvider as FileItemProvider, FileItemRenderer as FileItemRenderer } from "src/workbench/services/fileTree/fileItemRenderer";
import { FileItemDragAndDropProvider } from "src/workbench/services/fileTree/fileItemDragAndDrop";
import { ILogService } from "src/base/common/logger";
import { FuzzyScore, IFilterOpts } from "src/base/common/fuzzy";
import { FileItemFilter as FileItemFilter } from "src/workbench/services/fileTree/fileItemFilter";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { SideViewConfiguration } from "src/workbench/parts/sideView/configuration.register";
import { AsyncResult } from "src/base/common/result";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { FileSortOrder, FileSortType, FileTreeSorter } from "src/workbench/services/fileTree/fileTreeSorter";
import { Pair } from "src/base/common/utilities/type";
import { FileOperationError } from "src/base/common/files/file";
import { noop } from "src/base/common/performance";

/**
 * An interface only for {@link FileTreeService}.
 */
export interface IFileTreeService extends ITreeService<FileItem> {
    // noop
}

export class FileTreeService extends Disposable implements IFileTreeService {

    declare _serviceMarker: undefined;

    // [field]

    private _tree?: IFileTree<FileItem, void>;

    // [constructor]

    constructor(
        @IConfigurationService private readonly configurationService: IConfigurationService,
        @ILogService private readonly logService: ILogService,
        @IFileService private readonly fileService: IFileService,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
    ) {
        super();
    }

    // [event]

    private readonly _onSelect = this.__register(new RelayEmitter<IFileTreeOpenEvent<FileItem>>());
    public readonly onSelect = this._onSelect.registerListener;
    
    // [getter]

    get container(): HTMLElement | undefined {
        return this._tree?.DOMElement;
    }

    get root(): URI | undefined {
        return this._tree?.root.uri;
    }

    get rootItem(): FileItem | undefined {
        return this._tree?.root;
    }

    get isOpened(): boolean {
        return !!this._tree;
    }

    // [public mehtods]

    public init(container: HTMLElement, root: URI): AsyncResult<void, Error> {
        return this.__initTree(container, root)
            .andThen(async tree => {
                this._onSelect.setInput(tree.onSelect);

                /**
                 * After the tree is constructed, refresh tree to fetch the 
                 * latest data for the first time.
                 */
                await tree.refresh();
            });
    }

    public layout(height?: number | undefined): void {
        this._tree?.layout(height);
    }

    public async refresh(data?: FileItem): Promise<void> {
        this._tree?.refresh(data);
    }

    public async close(): Promise<void> {
        
    }

    // [private helper methods]

    private __initTree(container: HTMLElement, root: URI): AsyncResult<IFileTree<FileItem, void>, FileOperationError> {
        
        /**
         * Make sure the root directory exists first.
         * Only resolving the direct children of the root, indicates we are 
         * always collapsing the tree at the beginning.
         */
        return this.fileService.stat(root, { 
            resolveChildren: true,
            resolveChildrenRecursive: false,
        })

        // start building the tree
        .andThen(async rootStat => {
            
            // retrieve tree configurations
            const filterOpts: IFilterOpts = {
                exclude: this.configurationService.get<string[]>(SideViewConfiguration.ExplorerViewExclude, []).filter(s => !!s).map(s => new RegExp(s)),
                include: this.configurationService.get<string[]>(SideViewConfiguration.ExplorerViewInclude, []).filter(s => !!s).map(s => new RegExp(s)),
            };

            // construct sorter and initialize it after
            const sorter = this.__register(this.__initSorter());

            const fileItemResolveOpts: IFileItemResolveOptions<FileItem> = { 
                onError: noop, 
                cmp: sorter.compare.bind(sorter), 
                beforeCmp: async folder => __syncSorterMetadataBy(sorter, folder),
                filters: filterOpts,
            };

            // initially construct the entire file system hierarchy
            const root = await FileItem.resolve(rootStat, null, fileItemResolveOpts);

            // init tree
            const dndProvider = this.__register(this.instantiationService.createInstance(FileItemDragAndDropProvider));
            const tree = this.__register(
                new FileTree<FileItem, FuzzyScore>(
                    container,
                    root,
                    {
                        itemProvider: new FileItemProvider(),
                        renderers: [new FileItemRenderer()],
                        childrenProvider: new FileItemChildrenProvider(this.logService, this.fileService, fileItemResolveOpts),
                        identityProvider: { getID: (data: FileItem) => data.id },

                        // optional
                        collapsedByDefault: true,
                        filter: new FileItemFilter(),
                        dnd: dndProvider,
                    },
                )
            );

            // bind the dnd with the tree
            dndProvider.bindWithTree(tree);
            
            this._tree = tree;
            return tree;
        });
    }   

    private __initSorter(): FileTreeSorter<FileItem> {
        const fileSortType = this.configurationService.get<FileSortType>(SideViewConfiguration.ExplorerFileSortType);
        const fileSortOrder = this.configurationService.get<FileSortOrder>(SideViewConfiguration.ExplorerFileSortOrder);

        const sorter = this.instantiationService.createInstance(FileTreeSorter, fileSortType, fileSortOrder);
        return sorter;
    }
}

async function __syncSorterMetadataBy(sorter: FileTreeSorter<FileItem>, folder: FileItem): Promise<void> {
    if (sorter.sortType !== FileSortType.Custom) {
        return;
    }
    
    const customSorter = sorter.getCustomSorter();
    await customSorter.syncMetadataWithDiskState(folder).unwrap();
}