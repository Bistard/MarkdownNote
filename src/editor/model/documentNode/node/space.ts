import { TokenEnum } from "src/editor/common/markdown";
import { EditorTokens } from "src/editor/common/model";
import { ProseNode, ProseNodeSpec } from "src/editor/common/proseMirror";
import { DocumentNode, IParseTokenStatus } from "src/editor/model/documentNode/documentNode";
import { createDomOutputFromOptions } from "../../schema";
import { IDocumentParseState } from "src/editor/model/parser";
import { IMarkdownSerializerState } from "src/editor/model/serializer";

/**
 * @class An empty space block. Represented in the DOM as an empty `<p>` 
 * element.
 */
export class Space extends DocumentNode<EditorTokens.Space> {

    constructor() {
        super(TokenEnum.Space);
    }

    public getSchema(): ProseNodeSpec {
        return {
            group: 'block',
            content: 'inline*',
            toDOM: () => { 
                return createDomOutputFromOptions({
                    type: 'node',
                    tagName: 'p',
                    editable: true,
                });
            }
        };
    }

    public parseFromToken(state: IDocumentParseState, status: IParseTokenStatus<EditorTokens.Space>): void {
        state.activateNode(this.ctor, status, {});
        state.deactivateNode();
    }

    public serializer = (state: IMarkdownSerializerState, node: ProseNode, parent: ProseNode, index: number) => {
        state.text('');
        state.closeBlock(node);
    };
}