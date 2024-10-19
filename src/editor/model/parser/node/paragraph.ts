import { TokenEnum } from "src/editor/common/markdown";
import { EditorTokens } from "src/editor/common/model";
import { ProseNodeSpec } from "src/editor/common/proseMirror";
import { DocumentNode } from "src/editor/model/parser/documentNode";
import { createDomOutputFromOptions } from "../../schema";
import { IDocumentParseState } from "src/editor/model/parser/parser";

/**
 * @class A plain paragraph textblock. Represented in the DOM as a `<p>` 
 * element.
 */
export class Paragraph extends DocumentNode<EditorTokens.Paragraph> {

    constructor() {
        super(TokenEnum.Paragraph);
    }

    public getSchema(): ProseNodeSpec {
        return {
            group: 'block',
            content: 'inline*',
            parseDOM: [{ tag: 'p' }],
            toDOM: () => { 
                return createDomOutputFromOptions({
                    type: 'node',
                    tagName: 'p',
                    editable: true,
                });
            }
        };
    }

    public parseFromToken(state: IDocumentParseState, token: EditorTokens.Paragraph): void {
        state.activateNode(this.ctor);
        if (token.tokens) {
            state.parseTokens(token.tokens);
        }
        state.deactivateNode();
    }
}