import { Disposable } from "src/base/common/dispose";
import { Emitter } from "src/base/common/event";
import { IEditorModel } from "src/editor/common/model";
import { ProseEditorState, ProseTransaction } from "src/editor/common/proseMirror";
import { IEditorViewModel } from "src/editor/common/viewModel";
import { IOnDidContentChangeEvent } from "src/editor/view/proseEventBroadcaster";

export class EditorViewModel extends Disposable implements IEditorViewModel {

    // [events]

    private readonly _onDidChangeModelState = this.__register(new Emitter<ProseTransaction>());
    public readonly onDidChangeModelState = this._onDidChangeModelState.registerListener;
    
    private readonly _onDidBuild = this.__register(new Emitter<ProseEditorState>());
    public readonly onDidBuild = this._onDidBuild.registerListener;
    
    // [fields]

    private readonly _model: IEditorModel;

    // [constructor]

    constructor(
        model: IEditorModel,
    ) {
        super();
        this._model = model;

        this.__registerListeners();
    }

    // [public methods]

    public onDidViewContentChange(e: IOnDidContentChangeEvent): void {
        this._model.setDirty(true);
        this._model.__onDidStateChange(e);
    }

    // [private methods]

    private __registerListeners(): void {
        this.__register(this._model.onDidBuild(state => this._onDidBuild.fire(state)));
        this.__register(this._model.onTransaction(tr => this._onDidChangeModelState.fire(tr)));
    }
}