import { URI } from "src/base/common/file/uri";
import { IComponentService } from "src/code/browser/service/componentService";
import { Component, IComponent } from "src/code/browser/workbench/component";
import { WorkspaceComponentType } from "src/code/browser/workbench/workspace/workspace";
import { IFileService } from "src/code/common/service/fileService/fileService";
import { createDecorator } from "src/code/common/service/instantiationService/decorator";
import { ServiceDescriptor } from "src/code/common/service/instantiationService/descriptor";
import { registerSingleton } from "src/code/common/service/instantiationService/serviceCollection";
import { EditorWidget } from "src/editor/editorWidget";
import { EditorModel } from "src/editor/model/editorModel";

export const IEditorService = createDecorator<IEditorService>('editor-service');

export interface IEditorService extends IComponent {

    /**
     * @description Openning a source given the URI in the editor.
     * @param uriOrString The uri or in the string form.
     */
    openEditor(uriOrString: URI | string): void;

}

export class EditorComponent extends Component implements IEditorService {

    // [field]

    // [constructor]

    constructor(
        @IComponentService componentService: IComponentService,
        @IFileService private fileService: IFileService,
    ) {
        super(WorkspaceComponentType.editor, null, componentService);
    }

    // [public methods]

    public openEditor(uriOrString: URI | string): void {
        let uri = uriOrString;
        if (!(uriOrString instanceof URI)) {
            uri = URI.fromFile(uriOrString);
        }
        
        const textModel = new EditorModel();
        console.log('[Editor Service] opening');
    }

    // [override protected methods]

    protected override _createContent(): void {
        const editor = new EditorWidget(this.container, {});
    }

    protected override _registerListeners(): void {
        
    }

    // [private helper methods]

}

registerSingleton(IEditorService, new ServiceDescriptor(EditorComponent));