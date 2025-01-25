import { Marked } from "marked";
import { EditorToken } from "src/editor/common/model";
import { createMathInlineTokenizer } from "src/editor/model/documentNode/mark/mathInline";
import { createMathBlockTokenizer } from "src/editor/model/documentNode/node/mathBlock";

/**
 * The options for markdown parsing.
 */
export interface IMarkdownLexerOptions {
    
    /**
     * A prefix url for any relative link.
     * @default undefined
     */
    baseURI?: string;
}

export function getDefaultLexerOptions(): IMarkdownLexerOptions {
    return {
        baseURI: undefined,
    };
}

/**
 * An interface only for {@link MarkdownLexer}.
 */
export interface IMarkdownLexer {

    /**
     * @description Apply a lexical analysis on the given text and returns the 
     * analyzed tokens.
     * @param text The given text.
     * 
     * @note Each token index is relatives to the whole text model (absolute).
     */
    lex(text: string): EditorToken[];

    /**
     * @description Returns the current markdown lexer options.
     */
    getOptions(): IMarkdownLexerOptions;

    /**
     * @description Updates the options of the lexer.
     * @param options The options.
     */
    updateOptions(options: Partial<IMarkdownLexerOptions>): void;
}

export class MarkdownLexer implements IMarkdownLexer {

    // [field]

    private readonly _marked: Marked;
    private readonly _parseOpts: IMarkdownLexerOptions;
    
    // [constructor]

    constructor(options?: IMarkdownLexerOptions) {
        this._marked = new Marked({
            silent: false,
            extensions: [
                createMathInlineTokenizer({ nonStandard: true }),
                createMathBlockTokenizer(),
            ]
        });
        this._parseOpts = options ?? getDefaultLexerOptions();
    }

    // [public methods]

    public lex(text: string): EditorToken[] {
        const tokens = this._marked.lexer(text);
        return tokens;
    }

    public getOptions(): IMarkdownLexerOptions {
        return this._parseOpts;
    }

    public updateOptions(options: Partial<IMarkdownLexerOptions>): void {
        this._parseOpts.baseURI = options.baseURI;
    }
}