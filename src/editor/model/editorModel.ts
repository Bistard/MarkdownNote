import { Disposable } from "src/base/common/dispose";
import { Emitter } from "src/base/common/event";
import { DataBuffer } from "src/base/common/files/buffer";
import { URI } from "src/base/common/files/uri";
import { defaultLog, ILogService } from "src/base/common/logger";
import { AsyncResult, ok } from "src/base/common/result";
import { assert } from "src/base/common/utilities/panic";
import { EditorOptionsType } from "src/editor/common/editorConfiguration";
import { IEditorExtension } from "src/editor/common/editorExtension";
import { IEditorModel } from "src/editor/common/model";
import { IEditorPosition } from "src/editor/common/position";
import { ProseEditorState, ProseNode, ProseTransaction } from "src/editor/common/proseMirror";
import { IMarkdownLexer, IMarkdownLexerOptions, MarkdownLexer } from "src/editor/model/markdownLexer";
import { DocumentNodeProvider } from "src/editor/model/documentNode/documentNodeProvider";
import { DocumentParser, IDocumentParser } from "src/editor/model/parser";
import { buildSchema, EditorSchema } from "src/editor/model/schema";
import { MarkdownSerializer } from "src/editor/model/serializer";
import { IFileService } from "src/platform/files/common/fileService";


export class EditorModel extends Disposable implements IEditorModel {

    // [events]

    private readonly _onDidBuild = this.__register(new Emitter<ProseEditorState>());
    public readonly onDidBuild = this._onDidBuild.registerListener;
    
    private readonly _onTransaction = this.__register(new Emitter<ProseTransaction>());
    public readonly onTransaction = this._onTransaction.registerListener;

    private readonly _onDidStateChange = this.__register(new Emitter<void>());
    public readonly onDidStateChange = this._onDidStateChange.registerListener;

    // [fields]

    /** The configuration of the editor */
    private readonly _options: EditorOptionsType;

    /** The source file the model is about to read and parse. */
    private readonly _source: URI;

    /** An object that defines how a view is organized. */
    private readonly _schema: EditorSchema;
    
    /** Responsible for parsing the raw text into tokens. */
    private readonly _lexer: IMarkdownLexer;

    /** Parser that parses the given token into a legal view based on the schema. */
    private readonly _docParser: IDocumentParser;

    /** Serializer that transforms the prosemirror document back to raw string. */
    private readonly _docSerializer: MarkdownSerializer;

    /** A reference to the prosemirror state. */
    private _editorState?: ProseEditorState;

    // [constructor]

    constructor(
        source: URI,
        options: EditorOptionsType,
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
    ) {
        super();
        this._source = source;
        this._options = options;
        this._lexer = new MarkdownLexer(this.__initLexerOptions(options));
        
        const nodeProvider = DocumentNodeProvider.create().register();
        this._schema = buildSchema(nodeProvider);
        this._docParser = new DocumentParser(this._schema, nodeProvider, /* options */);
        this.__register(this._docParser.onLog(event => defaultLog(logService, event.level, 'EditorView', event.message, event.error, event.additionals)));
        this._docSerializer = new MarkdownSerializer(nodeProvider, { strict: true, escapeExtraCharacters: undefined, });

        logService.debug('EditorModel', 'Constructed');
    }

    // [getter / setter]

    get source(): URI { return this._source; }
    get schema(): EditorSchema { return this._schema; }
    get state(): ProseEditorState | undefined { return this._editorState; }

    // [public methods]

    public build(extensions: IEditorExtension[]): AsyncResult<ProseEditorState, Error> {
        return this.__buildModel(this._source, extensions)
            .map(state => {
                this._editorState = state;
                this._onDidBuild.fire(state);
                return state;
            });
    }

    public insertAt(textOffset: number, text: string): void {
        const state = assert(this._editorState);
        const document = this.__tokenizeAndParse(text);
        const newTr = state.tr.insert(textOffset, document);
        this._onTransaction.fire(newTr);
    }

    public deleteAt(textOffset: number, length: number): void {
        const state = assert(this._editorState);
        const newTr = state.tr.delete(textOffset, textOffset + length);
        this._onTransaction.fire(newTr);
    }

    public getContent(): string[] {
        const state = assert(this._editorState);
        return []; // TODO
    }

    public getRawContent(): string {
        const state = assert(this._editorState);
        return ''; // TODO
    }

    public getLine(lineNumber: number): string {
        return ''; // TODO
    }
    
    public getRawLine(lineNumber: number): string {
        return ''; // TODO
    }

    public getLineLength(lineNumber: number): number {
        return -1; // TODO
    }

    public getRawLineLength(lineNumber: number): number {
        return -1; // TODO
    }

    public getLineCount(): number {
        return -1; // TODO
    }

    public getOffsetAt(lineNumber: number, lineOffset: number): number {
        return -1; // TODO
    }

    public getPositionAt(textOffset: number): IEditorPosition {
        return undefined!; // TODO
    }

    public getCharCodeByOffset(textOffset: number): number {
        return -1; // TODO
    }

    public getCharCodeByLine(lineNumber: number, lineOffset: number): number {
        return -1; // TODO
    }

    public save(): AsyncResult<void, Error> {
        const state = assert(this._editorState);
        const serialized = this._docSerializer.serialize(state.doc);
        const buffer = DataBuffer.fromString(serialized);
        return this.fileService.writeFile(this._source, buffer, { create: true, overwrite: true, unlock: false });
    }

    // [private methods]

    public __onDidStateChange(newState: ProseEditorState): void {
        this._editorState = newState;
        this._onDidStateChange.fire();
    }

    private __tokenizeAndParse(raw: string): ProseNode {
        const tokens = this._lexer.lex(raw);
        console.log(tokens); // TEST

        const doc = this._docParser.parse(tokens);
        console.log(doc); // TEST
        
        console.log(this._docSerializer.serialize(doc)); // TEST
        return doc;
    }

    private __initLexerOptions(options: EditorOptionsType): IMarkdownLexerOptions {
        return {
            baseURI: options.baseURI.value,
        };
    }

    private __buildModel(source: URI, extensions: IEditorExtension[]): AsyncResult<ProseEditorState, Error> {
        this.logService.debug('EditorModel', `Start building at: ${URI.toString(source)}`);

        return this.__readFileRaw(source)
            .andThen(raw => {
                const document = this.__tokenizeAndParse(raw);
                const state = ProseEditorState.create({
                    schema: this._schema,
                    doc: document,
                    plugins: extensions.map(extension => extension.getViewExtension()),
                });
                return ok(state);
            });
    }

    private __readFileRaw(source: URI): AsyncResult<string, Error> {
        return this.fileService.readFile(source, {})
            .map(buffer => buffer.toString());
    }
}