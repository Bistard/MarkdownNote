import { Disposable } from "src/base/common/dispose";
import { Register } from "src/base/common/event";
import { ProseEditorState, ProseTransaction } from "src/editor/common/proseMirror";
import { IOnDidContentChangeEvent } from "src/editor/view/proseEventBroadcaster";

export interface IEditorViewModel extends Disposable {

    readonly onDidChangeModelState: Register<ProseTransaction>;
    readonly onDidBuild: Register<ProseEditorState>;

    /**
     * @description This will be invoked whenever the view content changes.
     */
    onDidViewContentChange(e: IOnDidContentChangeEvent): void;
}