import katex from "katex";
import { TokenizerAndRendererExtension } from "marked";
import { SmartRegExp } from "src/base/common/utilities/regExp";
import { TokenEnum } from "src/editor/common/markdown";
import { EditorTokens } from "src/editor/common/model";
import { ProseNode, ProseNodeSpec } from "src/editor/common/proseMirror";
import { DocumentNode, IParseTokenStatus } from "src/editor/model/documentNode/documentNode";
import { IDocumentParseState } from "src/editor/model/parser";
import { IMarkdownSerializerState } from "src/editor/model/serializer";
import { II18nService } from "src/platform/i18n/browser/i18nService";

export const mathBlockRule = 
    new SmartRegExp(/^(dollars)\s*\n(content)(?:dollars)\s*(?:optionalEnd)/)
    .replace('dollars', /\${2}/)
    .replace('content', /(?:singleLine\n)*/) // multiple line: allow to be empty
    .replace('singleLine', /(?!\$\$)[^\n]*/) // single line: not allow occurrence of `$$`
    .replace('optionalEnd', /\n|$/)
    .get();

export function createMathBlockTokenizer(): TokenizerAndRendererExtension {
    return {
        name: 'mathBlock',
        level: 'block',
        start: (src: string) => {
            const index = src.indexOf('$$');
            return index !== -1 ? index : undefined;
        },
        tokenizer: (src: string, tokens: any) => {
            const match = src.match(mathBlockRule);
            if (match) {
                return {
                    type: 'mathBlock',
                    raw: match[0],
                    text: match[2]!.trim(),
                    displayMode: match[1]!.length === 2,
                };
            }
        },
    };
}

export class MathBlock extends DocumentNode<EditorTokens.MathBlock> {

    constructor(
        @II18nService private readonly i18nService: II18nService,
    ) {
        super(TokenEnum.MathBlock);
    }

    public getSchema(): ProseNodeSpec {
        return {
            group: 'block',
            content: undefined,
            draggable: true,
            selectable: true,
            attrs: {
                text: { default: '' },
            },
            toDOM: (node) => { 
                const text = node.attrs['text'] as string;
                const dom = document.createElement('div');
                dom.classList.add('math-block');

                // special case: empty math block
                if (text.trim().length === 0) {
                    dom.classList.add('empty');
                    const contentText = this.i18nService.localize('emptyMathBlock', 'Empty Math Block');
                    dom.textContent = `< ${contentText} >`;
                } 
                // normal case: use KaTeX for rendering math equations
                else {
                    katex.render(text, dom, {
                        displayMode: true,
                        output: 'htmlAndMathml',
                        throwOnError: false,
                    });
                }

                return dom;
            }
        };
    }

    public parseFromToken(state: IDocumentParseState, status: IParseTokenStatus<EditorTokens.MathBlock>): void {
        const token = status.token;
        state.activateNode(this.ctor, status, {
            attrs: {
                text: token.text,
            }
        });
        state.deactivateNode();
    }

    public serializer = (state: IMarkdownSerializerState, node: ProseNode, parent: ProseNode, index: number) => {
        const { text } = node.attrs;
        state.write(`$$${text}$$`);
    };
}