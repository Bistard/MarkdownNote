import { Component, ComponentType, IComponent } from 'src/code/browser/service/component/component';
import { Emitter, Register } from 'src/base/common/event';
import { IComponentService } from 'src/code/browser/service/component/componentService';
import { createService } from 'src/code/platform/instantiation/common/decorator';
import { Ii18nService } from 'src/code/platform/i18n/i18n';
import { Section } from 'src/code/platform/section';
import { registerSingleton } from 'src/code/platform/instantiation/common/serviceCollection';
import { ServiceDescriptor } from 'src/code/platform/instantiation/common/descriptor';
import { addDisposableListener, EventType } from 'src/base/browser/basic/dom';
import { IEditorService } from 'src/code/browser/workbench/workspace/editor/editor';
import { IBrowserDialogService, IDialogService } from 'src/code/platform/dialog/browser/browserDialogService';
import { IThemeService } from 'src/code/browser/service/theme/themeService';
import { ILogService } from 'src/base/common/logger';
import { IWorkbenchService } from 'src/code/browser/service/workbench/workbenchService';
import { IBrowserLifecycleService, ILifecycleService } from 'src/code/platform/lifecycle/browser/browserLifecycleService';
import { IBrowserEnvironmentService } from 'src/code/platform/environment/common/environment';
import { IExplorerTreeService } from 'src/code/browser/service/explorerTree/explorerTreeService';
import { URI } from 'src/base/common/file/uri';
import { IHostService } from 'src/code/platform/host/common/hostService';
import { StatusKey } from 'src/code/platform/status/common/status';
import { IMainStatusService } from 'src/code/platform/status/electron/mainStatusService';
import { DisposableManager } from 'src/base/common/dispose';

export const IExplorerViewService = createService<IExplorerViewService>('explorer-view-service');

/**
 * An interface only for {@link ExplorerViewComponent}.
 */
export interface IExplorerViewService extends IComponent {
    
    /**
     * Determine if the explorer view is opened right now.
     */
    readonly isOpened: boolean;

    /**
     * The root directory of the current opened explorer view. `undefined` if 
     * the view is not opened yet.
     */
    readonly root: URI | undefined;

    /**
     * Fired when the directory is opened.
     */
    onDidOpen: Register<ClassicOpenEvent>;

    /**
     * Open the explorer view under the given root path.
     */
    open(root: URI): Promise<void>;

    /**
     * Close the explorer view if any path is opened.
     */
    close(): Promise<void>;
}

export interface ClassicOpenEvent {

    /**
     * The path of the directory in string form.
     */
    readonly path: URI;
}

/**
 * @class TODO: complete comments
 */
export class ExplorerViewComponent extends Component implements IExplorerViewService {

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
    private _currentListeners = new DisposableManager();

    // [event]

    private readonly _onDidOpen = this.__register(new Emitter<ClassicOpenEvent>());
    public readonly onDidOpen = this._onDidOpen.registerListener;

    // [constructor]

    constructor(
        parentElement: HTMLElement,
        @IComponentService componentService: IComponentService,
        @IThemeService themeService: IThemeService,
        @IDialogService private readonly dialogService: IBrowserDialogService,
        @Ii18nService private readonly i18nService: Ii18nService,
        @IEditorService private readonly editorService: IEditorService,
        @ILogService private readonly logService: ILogService,
        @IWorkbenchService private readonly workbenchService: IWorkbenchService,
        @ILifecycleService lifecycleService: IBrowserLifecycleService,
        @IHostService private readonly hostService: IHostService,
        @IBrowserEnvironmentService private readonly envrionmentService: IBrowserEnvironmentService,
        @IExplorerTreeService private readonly explorerTreeService: IExplorerTreeService,
    ) {
        super(ComponentType.ExplorerView, parentElement, themeService, componentService);

        lifecycleService.onWillQuit(e => e.join(this.__onApplicationClose()));
    }

    // [getter]

    get isOpened(): boolean {
        return this.explorerTreeService.isOpened;
    }

    get root(): URI | undefined {
        return this.explorerTreeService.root;
    }

    // [public method]

    public async open(root: URI): Promise<void> {
        
        if (this.explorerTreeService.isOpened) {
            this.logService.warn(`Explorer view is already opened at ${URI.toString(this.explorerTreeService.root!)}`);
            return;
        }

        // unload the current view first
        this.__unloadCurrentView();

        // try to open the view at the given root
        const [view, success] = await this.__tryOpen(root);
        
        // load the given view as the current view
        this.__loadCurrentView(view, !success);

        /**
         * Once the element is put into the DOM tree, we now can relayout to 
         * calcualte the correct size of the view.
         */
        this.explorerTreeService.layout();
    }

    public async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        await this.explorerTreeService.close();

        this.__unloadCurrentView();
        const emptyView = this.__createEmptyView();
        this.__loadCurrentView(emptyView, true);
    }

    // [protected overrdie method]

    protected override _createContent(): void {
        /**
         * If there are waiting URIs to be opened, we will open it once we are 
         * creating the UI component.
         */
        const uriToOpen = this.envrionmentService.configuration.uriOpenConfiguration;
        if (uriToOpen.directory) {
            this.open(uriToOpen.directory);
        }
        // we simply put an empty view
        else {
            const emptyView = this.__createEmptyView();
            this.__loadCurrentView(emptyView, true);
        }
    }

    protected override _registerListeners(): void {
        /**
         * No need to register listeners initially, since `__loadCurrentView` 
         * will do for us internally.
         */
    }

    // [private helper method]

    private async __onApplicationClose(): Promise<void> {

        // save the last opened workspace root path.
        if (this.explorerTreeService.root) {
            const workspace = URI.join(this.explorerTreeService.root, '|directory');
            await this.hostService.setApplicationStatus(StatusKey.LastOpenedWorkspace, URI.toString(workspace));
        } else {
            await this.hostService.setApplicationStatus(StatusKey.LastOpenedWorkspace, '');
        }
    }

    private __unloadCurrentView(): void {
        if (this._currentView) {
            this._currentView.remove();
            this._currentView = undefined;
            this._currentListeners.dispose();
        }
    }

    private __loadCurrentView(view: HTMLElement, isEmpty: boolean): void {
        if (!this._currentView) {
            this._currentView = view;
            this.element.appendChild(view);
            this._currentListeners = new DisposableManager();

            if (isEmpty) {
                this.__registerEmptyViewListeners();
            } else {
                this.__registerNonEmptyViewListeners();
            }
        }
    }

    /**
     * @description Try to open the explorer tree view at the given path.
     * @param path The given path.
     * @returns Returns a new {@link HTMLElement} of the view and a boolean 
     * indicates if operation successed.
     */
    private async __tryOpen(path: URI): Promise<[HTMLElement, boolean]> {
        let success = true;
        let container = this.__createOpenedView();

        /**
         * Open the root in the explorer tree service who will handle the 
         * complicated stuff for us.
         */
        try {
            await this.explorerTreeService.init(container, path);
            this._onDidOpen.fire({ path: path });
        } 
        /**
         * If the initialization fails, we capture it and replace it with an
         * empty view.
         */
        catch (_error) {
            container = this.__createEmptyView();
            success = false;
            this.logService.error(`Explorer view cannot open the given path at ${URI.toString(path)}.`);
        }
        
        return [container, success];
    }

    // [private UI helper methods]

    private __createEmptyView(): HTMLElement {
        
        // the view
        const view = document.createElement('div');
        view.className = 'empty-explorer-container';
        
        // the tag
        const tag = document.createElement('div');
        tag.className = 'explorer-open-tag';
        tag.textContent = this.i18nService.trans(Section.Explorer, 'openDirectory');
        tag.classList.add('vertical-center', 'funcText');
        view.appendChild(tag);
        
        return view;
    }

    private __createOpenedView(): HTMLElement {
        // the view
        const view = document.createElement('div');
        view.className = 'opened-explorer-container';
        return view;
    }

    private __registerEmptyViewListeners(): void {
        if (this.isOpened || !this._currentView) {
            return;
        }

        const disposables = this._currentListeners;

        /**
         * Empty view openning directory dialog listener (only open the last 
         * selected one).
         */
        const emptyView = this._currentView;
        const tag = emptyView.children[0]!;
        disposables.register(
            addDisposableListener(tag, EventType.click, () => {
                this.dialogService.openDirectoryDialog({ title: 'open a directory' })
                .then(path => {
                    if (path.length > 0) {
                        this.open(URI.fromFile(path.at(-1)!));
                    }
                });
            }
        ));
    }

    private __registerNonEmptyViewListeners(): void {
        if (!this.isOpened || !this._currentView) {
            return;
        }

        const disposables = this._currentListeners;

        /**
         * The tree model of the tree-service requires the correct height thus 
         * we need to update it everytime we are resizing.
         */
         disposables.register(this.workbenchService.onDidLayout(() => this.explorerTreeService.layout()));

        // on openning file.
        disposables.register(this.explorerTreeService.onDidClick(e => {
            this.editorService.openEditor(e.item.uri);
        }));
    }
}

registerSingleton(IExplorerViewService, new ServiceDescriptor(ExplorerViewComponent));