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
import { history } from "prosemirror-history";
import { IOnDidContentChangeEvent } from "src/editor/view/proseEventBroadcaster";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";

export class EditorModel extends Disposable implements IEditorModel {

    // [events]

    private readonly _onDidBuild = this.__register(new Emitter<ProseEditorState>({ onFire: () => this.__setDirty(false) }));
    public readonly onDidBuild = this._onDidBuild.registerListener;

    private readonly _onTransaction = this.__register(new Emitter<ProseTransaction>({ onFire: () => this.__setDirty(true) }));
    public readonly onTransaction = this._onTransaction.registerListener;

    private readonly _onDidStateChange = this.__register(new Emitter<void>({ onFire: () => this.__setDirty(true) }));
    public readonly onDidStateChange = this._onDidStateChange.registerListener;

    private readonly _onDidSave = this.__register(new Emitter<void>({ onFire: () => this.__setDirty(false) }));
    public readonly onDidSave = this._onDidSave.registerListener;

    private readonly _onDidSaveError = this.__register(new Emitter<unknown>());
    public readonly onDidSaveError = this._onDidSaveError.registerListener;

    private readonly _onDidDirtyChange = this.__register(new Emitter<boolean>());
    public readonly onDidDirtyChange = this._onDidDirtyChange.registerListener;

    // [fields]

    private readonly _options: EditorOptionsType;        // The configuration of the editor
    private readonly _source: URI;                       // The source file the model is about to read and parse.
    private readonly _schema: EditorSchema;              // An object that defines how a view is organized.
    private readonly _lexer: IMarkdownLexer;             // Responsible for parsing the raw text into tokens.
    private readonly _docParser: IDocumentParser;        // Parser that parses the given token into a legal view based on the schema.
    private readonly _docSerializer: MarkdownSerializer; // Serializer that transforms the prosemirror document back to raw string.

    private _editorState?: ProseEditorState; // A reference to the prosemirror state.
    private _dirty: boolean;                 // Indicates if the file has unsaved changes. Modify this through `this.__setDirty()`

    // [constructor]

    constructor(
        source: URI,
        options: EditorOptionsType,
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
        @IInstantiationService instantiationService: IInstantiationService,
    ) {
        super();
        this._source = source;
        this._options = options;
        this._lexer = new MarkdownLexer(this.__initLexerOptions(options));

        const nodeProvider = DocumentNodeProvider.create(instantiationService).register();
        this._schema = buildSchema(nodeProvider);
        this._docParser = this.__register(new DocumentParser(this._schema, nodeProvider, /* options */));
        this.__register(this._docParser.onLog(event => defaultLog(logService, event.level, 'EditorView', event.message, event.error, event.additional)));
        this._docSerializer = new MarkdownSerializer(nodeProvider, { strict: true, escapeExtraCharacters: undefined, });

        this._dirty = false;

        logService.debug('EditorModel', 'Constructed');
    }

    // [getter / setter]

    get source(): URI { return this._source; }
    get schema(): EditorSchema { return this._schema; }
    get state(): ProseEditorState | undefined { return this._editorState; }
    get dirty(): boolean { return this._dirty; }

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
        const raw = this._docSerializer.serialize(state.doc);
        return raw.split('\n'); // TODO
    }

    public getRawContent(): string {
        const state = assert(this._editorState);
        const raw = this._docSerializer.serialize(state.doc);
        return raw; // TODO
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
        if (this._dirty === false) {
            return AsyncResult.ok();
        }

        const state = assert(this._editorState);
        const serialized = this._docSerializer.serialize(state.doc);
        const buffer = DataBuffer.fromString(serialized);

        return this.fileService.writeFile(this._source, buffer, { create: true, overwrite: true, unlock: false })
            .map(() => {
                this._onDidSave.fire();
            })
            .mapErr(error => {
                this.logService.trace('EditorModel', `File saved (${URI.toString(this._source)})`);
                this._onDidSaveError.fire(error);
                return error;
            });
    }

    // [private methods]

    private __setDirty(value: boolean): void {
        if (this._dirty === value) {
            return;
        }
        this._dirty = value;
        this._onDidDirtyChange.fire(value);
    }

    public __onDidStateChange(event: IOnDidContentChangeEvent): void {
        const newState = event.view.state;
        this._editorState = newState;
        this._onDidStateChange.fire();
    }

    private __tokenizeAndParse(raw: string): ProseNode {
        const tokens = this._lexer.lex(raw);
        console.log(tokens); // TEST

        const doc = this._docParser.parse(tokens);
        console.log(doc); // TEST

        // console.log(this._docSerializer.serialize(doc)); // TEST
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
                    plugins: [
                        ...extensions.map(extension => extension.getViewExtension()),
                        history({ depth: 500 }),
                    ],
                });
                return ok(state);
            });
    }

    private __readFileRaw(source: URI): AsyncResult<string, Error> {
        return this.fileService.readFile(source, {})
            .map(buffer => buffer.toString());
    }
}