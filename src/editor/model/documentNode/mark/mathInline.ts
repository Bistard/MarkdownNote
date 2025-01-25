import katex from "katex";
import { TokenizerAndRendererExtension } from "marked";
import { TokenEnum } from "src/editor/common/markdown";
import { EditorTokens } from "src/editor/common/model";
import { ProseNode, ProseNodeSpec } from "src/editor/common/proseMirror";
import { DocumentNode, IParseTokenStatus } from "src/editor/model/documentNode/documentNode";
import { IDocumentParseState } from "src/editor/model/parser";
import { IMarkdownSerializerState } from "src/editor/model/serializer";

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:？！。，：]|$)/;
const inlineRuleNonStandard = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1/; // Non-standard, even if there are no spaces before and after $ or $$, try to parse

export function createMathInlineTokenizer(options: { nonStandard: boolean }): TokenizerAndRendererExtension {
    const {nonStandard} = options;
    const ruleReg = nonStandard ? inlineRuleNonStandard : inlineRule;
    return {
        name: 'mathInline',
        level: 'inline',
        start(src) {
            let index: number;
            let indexSrc = src;
            while (indexSrc) {
                index = indexSrc.indexOf('$');
                if (index === -1) {
                    return;
                }
                const found = nonStandard ? index > -1 : index === 0 || indexSrc.charAt(index - 1) === ' ';
                if (found) {
                    const possibleInline = indexSrc.substring(index);
                    if (possibleInline.match(ruleReg)) {
                        return index;
                    }
                }
                indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
            }
        },
        tokenizer(src, tokens) {
            const match = src.match(ruleReg);
            if (match) {
                return {
                    type: 'mathInline',
                    raw: match[0],
                    text: match[2]!.trim(),
                    displayMode: match[1]!.length === 2,
                };
            }
        }
    };
}

export class MathInline extends DocumentNode<EditorTokens.MathInline> {

    constructor() {
        super(TokenEnum.MathInline);
    }

    public getSchema(): ProseNodeSpec {
        return <ProseNodeSpec>{
            group: 'inline',
            inline: true,
            content: undefined,
            attrs: {
                text: { default: '' },
            },
            toDOM: (node) => { 
                const text = node.attrs['text'] as string;
                const dom = document.createElement('span');
                dom.classList.add('math-inline');
                
                katex.render(text, dom, {
                    displayMode: false,
                    output: 'htmlAndMathml',
                    throwOnError: false,
                });

                return dom; 
            }
        };
    }

    public parseFromToken(state: IDocumentParseState, status: IParseTokenStatus<EditorTokens.Image>): void {
        const token = status.token;
        state.activateNode(this.ctor, status, {
            attrs: {
                text: token.text
            }
        });
        state.deactivateNode();
    }

    public serializer = (state: IMarkdownSerializerState, node: ProseNode, parent: ProseNode, index: number) => {
        const { text } = node.attrs;
        state.write(`$${text}$`);
    };
}