import { TokenEnum } from "src/editor/common/markdown";
import { EditorTokens } from "src/editor/common/model";
import { ProseNodeSpec } from "src/editor/common/proseMirror";
import { DocumentNode } from "src/editor/model/parser/documentNode";
import { createDomOutputFromOptions } from "../../schema";
import { IDocumentParseState } from "src/editor/model/parser/parser";

/**
 * @class A blockquote (`<blockquote>`) wrapping one or more blocks.
 */
export class Blockquote extends DocumentNode<EditorTokens.Blockquote> {

    constructor() {
        super(TokenEnum.Blockquote);
    }

    public getSchema(): ProseNodeSpec {
        return {
            group: 'block',
            content: 'block+',
            defining: true,
            parseDOM: [{ tag: 'blockquote' }],
            toDOM: () => { 
                return createDomOutputFromOptions({
                    type: 'node',
                    tagName: `blockquote`,
                    editable: true,
                });
            }
        };
    }

    public parseFromToken(state: IDocumentParseState, token: EditorTokens.Blockquote): void {
        state.activateNode(this.ctor);
        if (token.tokens) {
            state.parseTokens(token.tokens);
        }
        state.deactivateNode();
    }
}