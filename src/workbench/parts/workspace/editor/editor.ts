import 'src/workbench/parts/workspace/editor/media/editor.scss';
import { URI } from "src/base/common/files/uri";
import { IComponentService } from "src/workbench/services/component/componentService";
import { Component, } from "src/workbench/services/component/component";
import { IFileService } from "src/platform/files/common/fileService";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { ExplorerViewID, IExplorerViewService } from "src/workbench/contrib/explorer/explorerService";
import { IBrowserLifecycleService, ILifecycleService } from "src/platform/lifecycle/browser/browserLifecycleService";
import { ILogService } from "src/base/common/logger";
import { IEditorWidgetOptions } from "src/editor/common/configuration/editorConfiguration";
import { deepCopy } from "src/base/common/utilities/object";
import { IEditorService } from "src/workbench/parts/workspace/editor/editorService";
import { IThemeService } from 'src/workbench/services/theme/themeService';
import { IConfigurationService } from 'src/platform/configuration/common/configuration';
import { EditorWidget, IEditorWidget } from 'src/editor/editorWidget';
import { EditorType } from 'src/editor/common/viewModel';
import { getBuiltInExtension } from 'src/editor/common/extension/builtInExtension';
import { INavigationViewService } from 'src/workbench/parts/navigationPanel/navigationView/navigationView';
import { assert, panic } from 'src/base/common/utilities/panic';
import { Emitter } from 'src/base/common/event';
import { IOutlineService } from 'src/workbench/services/outline/outlineService';
import { Throttler } from 'src/base/common/utilities/async';

export class EditorService extends Component implements IEditorService {

    declare _serviceMarker: undefined;

    // [field]

    private _editorWidget: IEditorWidget | null;
    
    /**
     * Stores editor open request. A throttler is needed to avoid excessive file
     * loading during a very short time.
     */
    private readonly _pendingRequest: Throttler;

    // [event]

    private readonly _onDidOpen = this.__register(new Emitter<URI>());
    public readonly onDidOpen = this._onDidOpen.registerListener;

    // [constructor]

    constructor(
        @IComponentService componentService: IComponentService,
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @IFileService private readonly fileService: IFileService,
        @IThemeService themeService: IThemeService,
        @INavigationViewService private readonly navigationViewService: INavigationViewService,
        @ILifecycleService private readonly lifecycleService: IBrowserLifecycleService,
        @ILogService logService: ILogService,
        @IConfigurationService private readonly configurationService: IConfigurationService,
    ) {
        super('editor', null, themeService, componentService, logService);
        this._editorWidget = null;
        this._pendingRequest = new Throttler();

        this.logService.trace('EditorService', 'Constructed.');
    }

    // [getter]

    get editor(): IEditorWidget | null {
        return this._editorWidget ?? null;
    }

    // [public methods]

    public override dispose(): void {
        super.dispose();
    }

    public async openSource(source: URI | string): Promise<void> {
        const uri = URI.isURI(source) ? source : URI.fromFile(source);

        if (!this._editorWidget) {
            panic(`[EditorService] Cannot open at "${URI.toString(uri)}". Reason: service currently is not created.`);
        }

        // queue a request
        await this._pendingRequest.queue(async () => {
            const editorWidget = assert(this._editorWidget);

            // do open
            this.logService.debug('EditorService', `Opening at: ${URI.toString(uri)}`);
            await editorWidget.open(uri);
            this.logService.debug('EditorService', `Open successfully at: ${URI.toString(uri)}`);
            
            this._onDidOpen.fire(uri);
            return uri;
        });
    }

    // [override protected methods]

    protected override async _createContent(): Promise<void> {
        const options = <IEditorWidgetOptions>deepCopy(this.configurationService.get('editor', {}));

        // building options
        const explorerView = this.navigationViewService.getView<IExplorerViewService>(ExplorerViewID);
        if (explorerView?.root) {
            options.baseURI = URI.toFsPath(explorerView.root);
        }

        this.logService.debug('EditorService', 'Constructing editor...');

        // editor construction
        const editor = this.instantiationService.createInstance(
            EditorWidget, 
            this.element.element,
            getBuiltInExtension(),
            {
                mode: EditorType.Rich,
            },
        );
        this._editorWidget = editor;

        this.logService.debug('EditorService', 'Editor constructed.');
    }

    protected override async _registerListeners(): Promise<void> {

        // building options
        const explorerView = this.navigationViewService.getView<IExplorerViewService>(ExplorerViewID);
        if (explorerView) {
            explorerView.onDidOpen((e) => {
                // FIX
                // this._editorWidget?.updateOptions({ baseURI: URI.toFsPath(e.path) });
            });
        }

        // listen to outline service click event
        const outlineService = this.instantiationService.getOrCreateService(IOutlineService);
        this.__register(outlineService.onDidClick(heading => {
            console.log('[EditorService] heading clicked', heading); // TODO
        }));
    }

    // [private helper methods]

}