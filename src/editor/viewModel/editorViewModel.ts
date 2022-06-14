import { Disposable } from "src/base/common/dispose";
import { IEditorModel } from "src/editor/common/model";
import { IEditorViewModel } from "src/editor/common/viewModel";
import { EditorItemProvider } from "src/editor/viewModel/editorItem";

/**
 * @class // TODO
 */
export class EditorViewModel extends Disposable implements IEditorViewModel {

    // [event]
    
    // [field]
    
    private readonly _model: IEditorModel;

    private readonly _itemProvider: EditorItemProvider;

    // [constructor]

    constructor(
        model: IEditorModel,
    ) {
        super();
        
        this._model = model;
        this._itemProvider = new EditorItemProvider();

        this.__registerModelListeners();
    }

    // [public methods]

    public getItemProvider(): EditorItemProvider {
        return this._itemProvider;
    }

    // [private helper methods]

    /**
     * @description Registrations for {@link EditorModel} events.
     */
    private __registerModelListeners(): void {
        
        this._model.onDidChangeContent((changeEvents) => {
            
        });
    }

}