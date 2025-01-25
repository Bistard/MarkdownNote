import { EditorView } from "prosemirror-view";
import { Time } from "src/base/common/date";
import { UnbufferedScheduler } from "src/base/common/utilities/async";
import { EditorExtension, IEditorExtension } from "src/editor/common/editorExtension";
import { EditorExtensionIDs } from "src/editor/contrib/builtInExtensionList";
import { IEditorWidget } from "src/editor/editorWidget";
import { IConfigurationService } from "src/platform/configuration/common/configuration";
import { INotificationService } from "src/workbench/services/notification/notification";
import { WorkbenchConfiguration } from "src/workbench/services/workbench/configuration.register";

interface IEditorAutoSaveExtension extends IEditorExtension {
	
    readonly id: EditorExtensionIDs.AutoSave;

    /**
     * If auto save is enabled.
     */
    readonly autoSave: boolean;

    /**
     * The auto save delay time.
     */
    readonly autoSaveDelay: Time;

    /**
     * When editor is lost focus, file is saved immediately.
     */
    readonly autoSaveOnLoseFocus: boolean;
}

export class EditorAutoSaveExtension extends EditorExtension implements IEditorAutoSaveExtension {

    // [fields]

    public override readonly id = EditorExtensionIDs.AutoSave;

    private _autoSave: boolean;
    private _autoSaveOnLoseFocus: boolean;
    private _autoSaveDelay: Time;
    
    private readonly _scheduler: UnbufferedScheduler<void>;

    // [constructor]

    constructor(
        editorWidget: IEditorWidget,
        @INotificationService private readonly notificationService: INotificationService,
        @IConfigurationService private readonly configurationService: IConfigurationService
    ) {
        super(editorWidget);

        // Initialize the configuration settings
        this._autoSave = this.configurationService.get<boolean>(WorkbenchConfiguration.EditorAutoSave, false);
        this._autoSaveOnLoseFocus = this.configurationService.get<boolean>(WorkbenchConfiguration.EditorAutoSaveOnLoseFocus, false);
        this._autoSaveDelay = Time.ms(this.configurationService.get<number>(WorkbenchConfiguration.EditorAutoSaveDelay));

        this._scheduler = this.__register(new UnbufferedScheduler(this._autoSaveDelay, () => {
            this.__saveEditorContent();
        }));

        this.__registerConfigurationListener();
        this.__registerEditorStateListener();
        this.__registerLoseFocusListener();
    }

    // [getter]

    get autoSave(): boolean { return this._autoSave; }
    get autoSaveDelay(): Time { return this._autoSaveDelay; }
    get autoSaveOnLoseFocus(): boolean { return this._autoSaveOnLoseFocus; }

    // [protected methods]

    protected override onViewDestroy(view: EditorView): void {
        super.dispose();
    }

    // [private methods]

    private __registerConfigurationListener(): void {

        // autoSave: true -> false

        this.__register(this.configurationService.onDidConfigurationChange(e => {
            if (e.affect(WorkbenchConfiguration.EditorAutoSave)) {
                this._autoSave = this.configurationService.get<boolean>(WorkbenchConfiguration.EditorAutoSave);
            }
            if (e.affect(WorkbenchConfiguration.EditorAutoSaveOnLoseFocus)) {
                this._autoSaveOnLoseFocus = this.configurationService.get<boolean>(WorkbenchConfiguration.EditorAutoSaveOnLoseFocus);
            }
            if (e.affect(WorkbenchConfiguration.EditorAutoSaveDelay)) {
                this._autoSaveDelay = Time.ms(this.configurationService.get<number>(WorkbenchConfiguration.EditorAutoSaveDelay));
            }
        }));
    }

    private __registerEditorStateListener(): void {
        this.__register(this._editorWidget.onDidStateChange(() => {
            if (this._autoSave) {
                this._scheduler.schedule(undefined, this._autoSaveDelay);
            }
        }));
    }

    private __registerLoseFocusListener(): void {
        this.__register(this._editorWidget.onDidBlur(() => {
            if (this._autoSaveOnLoseFocus) {
                this._scheduler.cancel();
                this.__saveEditorContent();
            }
        }));
    }

    private async __saveEditorContent(): Promise<void> {
        this._editorWidget.save().match<void>(
            () => {},
            (error) => this.notificationService.error(
                `Failed to save file: ${error.message}`,
                {
                    actions: [
                        { label: 'Close', run: 'noop' },
                        { label: 'Retry', run: () => this.__saveEditorContent() }
                    ]
                }
            )
        );
    }
}