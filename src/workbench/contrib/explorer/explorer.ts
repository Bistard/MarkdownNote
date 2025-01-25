import 'src/workbench/contrib/explorer/media/explorerItem.scss';
import 'src/workbench/contrib/explorer/media/explorerView.scss';
import { Emitter } from 'src/base/common/event';
import { addDisposableListener, EventType } from 'src/base/browser/basic/dom';
import { IBrowserEnvironmentService } from 'src/platform/environment/common/environment';
import { URI } from 'src/base/common/files/uri';
import { LooseDisposableBucket } from 'src/base/common/dispose';
import { INavigationViewService, INavView, NavView } from 'src/workbench/parts/navigationPanel/navigationView/navigationView';
import { IFileOpenEvent, ExplorerViewID, IExplorerViewService } from 'src/workbench/contrib/explorer/explorerService';
import { IFileTreeService } from 'src/workbench/services/fileTree/treeService';
import { IInstantiationService } from 'src/platform/instantiation/common/instantiation';
import { IWorkspaceService } from 'src/workbench/parts/workspace/workspaceService';
import { CommonLocalize, getCommonLocalize } from 'src/platform/i18n/common/i18n';
import { II18nService } from 'src/platform/i18n/browser/i18nService';

/**
 * @class Represents an Explorer view within a workbench, providing a UI 
 * component to navigate and manage the file system hierarchy. 
 * 
 * The view includes functionality such as opening files and directories, 
 * displaying the current directory's contents, and integrating with other 
 * services like the editor and theme services to enhance the user experience.
 * 
 * This class extends `NavView`, allowing it to be used as a side panel
 * within the application's layout.
 */
export class ExplorerView extends NavView implements IExplorerViewService {

    // [field]

    /**
     * Since the switching between opened / unopened views is not often thus we 
     * do not need to hold each view in the memory.
     */
    private _currentView?: HTMLElement;

    /**
     * A disposable that contains all the UI related listeners of the current 
     * view.
     */
    private readonly _currViewBucket: LooseDisposableBucket;

    // [event]

    private readonly _onDidOpen = this.__register(new Emitter<IFileOpenEvent>());
    public readonly onDidOpen = this._onDidOpen.registerListener;

    // [constructor]

    constructor(
        parentElement: HTMLElement,
        @IInstantiationService instantiationService: IInstantiationService,
        @II18nService private readonly i18nService: II18nService,
        @IWorkspaceService private readonly workspaceService: IWorkspaceService,
        @INavigationViewService private readonly navigationViewService: INavigationViewService,
        @IBrowserEnvironmentService private readonly environmentService: IBrowserEnvironmentService,
        @IFileTreeService private readonly fileTreeService: IFileTreeService,
    ) {
        super(ExplorerViewID, parentElement, instantiationService);
        this._currViewBucket = this.__register(new LooseDisposableBucket());
    }

    // [getter]

    get isOpened(): boolean {
        return this.fileTreeService.isOpened;
    }

    get root(): URI | undefined {
        return this.fileTreeService.root;
    }

    // [static methods]

    public static is(view: INavView): view is ExplorerView {
        return view.id === ExplorerViewID;
    }

    // [public method]

    public async open(root: URI): Promise<void> {

        if (this.fileTreeService.isOpened) {
            this.logService.warn('ExplorerView', `view is already opened at: ${URI.toString(this.fileTreeService.root!, true)}`);
            return;
        }

        // unload the current view first
        this.__unloadCurrentView();

        // try to open the view at the given root
        const [view, success] = await this.__tryOpen(root);

        // load the given view as the current view
        this.__loadCurrentView(view, !success);

        /**
         * Once the element is put into the DOM tree, we now can re-layout to 
         * calculate the correct size of the view.
         */
        this.fileTreeService.layout();
    }

    public async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        await this.fileTreeService.close();

        this.__unloadCurrentView();
        const emptyView = this.__createEmptyView();
        this.__loadCurrentView(emptyView, true);
    }

    // [protected override method]

    protected override __createContent(): void {
        /**
         * If there are waiting URIs to be opened, we will open it once we are 
         * creating the UI component.
         */
        const uriToOpen = this.environmentService.configuration.uriOpenConfiguration;
        if (uriToOpen.directory) {
            this.open(uriToOpen.directory.target);
        }
        // we simply put an empty view
        else {
            const emptyView = this.__createEmptyView();
            this.__loadCurrentView(emptyView, true);
        }
    }

    protected override __registerListeners(): void {
        super.__registerListeners();

        /**
         * No need to register listeners initially, since `__loadCurrentView` 
         * will do for us internally.
         */
    }

    // [private helper method]

    private __unloadCurrentView(): void {
        if (this._currentView) {
            this._currentView.remove();
            this._currentView = undefined;
        }
        this._currViewBucket.dispose();
    }

    private __loadCurrentView(view: HTMLElement, isEmpty: boolean): void {
        if (!this._currentView) {
            this._currentView = view;
            this.element.appendChild(view);

            if (isEmpty) {
                this.__registerEmptyViewListeners();
            } else {
                this.__registerNonEmptyViewListeners(view);
            }
        }
    }

    /**
     * @description Try to open the explorer tree view at the given path.
     * @param path The given path.
     * @returns Returns a new {@link HTMLElement} of the view and a boolean 
     * indicates if operation succeeded.
     */
    private async __tryOpen(path: URI): Promise<[HTMLElement, boolean]> {
        let success = true;
        let container = this.__createOpenedView();

        /**
         * Open the root in the explorer tree service.
         * 
         * @note The file tree must be appended as the single child of the 
         * container due to the fact that the file tree will be filled out 
         * entirely by its parent.
         */
        const treeContainer = document.createElement('div');
        treeContainer.className = 'file-tree-container';
        container.appendChild(treeContainer);

        return this.fileTreeService.init(treeContainer, path)
            .match(
                () => this._onDidOpen.fire({ path: path }),
                (error) => {
                    /**
                     * If the initialization fails, we capture it and replace it with an
                     * empty view.
                     */
                    success = false;
                    container = this.__createEmptyView();
                    console.log(path);
                    this.logService.error('ExplorerView', `Cannot open the view`, error, { at: URI.toString(path, true) });
                }
            )
            .then(() => [container, success]);
    }

    // [private UI helper methods]

    private __createEmptyView(): HTMLElement {

        // the view
        const view = document.createElement('div');
        view.className = 'empty-explorer-container';

        // the tag
        const tag = document.createElement('div');
        tag.className = 'explorer-open-tag';
        tag.textContent = getCommonLocalize(this.i18nService, CommonLocalize.openDirectory);
        view.appendChild(tag);

        return view;
    }

    private __createOpenedView(): HTMLElement {
        // create view
        const view = document.createElement('div');
        view.className = 'opened-explorer-container';

        return view;
    }

    private __registerEmptyViewListeners(): void {
        if (this.isOpened || !this._currentView) {
            return;
        }

        /**
         * Empty view opening directory dialog listener (only open the last 
         * selected one).
         */
        const emptyView = this._currentView;
        const tag = emptyView.children[0]!;
        
        this._currViewBucket.register(
            addDisposableListener(tag, EventType.click, async () => {
                this.navigationViewService.selectFolderAndOpen(null);
            })
        );
    }

    private __registerNonEmptyViewListeners(view: HTMLElement): void {
        if (!this.isOpened || !this._currentView) {
            return;
        }

        /**
         * The tree model of the tree-service requires the correct height thus 
         * we need to update it every time we are resizing.
         */
        this._currViewBucket.register(this.navigationViewService.onDidLayout((e) => {
            this.fileTreeService.layout();
        }));

        // on opening file.
        this._currViewBucket.register(this.fileTreeService.onSelect(e => {
            this.workspaceService.openEditor({ uri: e.item.uri }, {});
        }));
    }
}