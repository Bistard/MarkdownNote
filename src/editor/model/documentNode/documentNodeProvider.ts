import { IO } from "src/base/common/utilities/functional";
import { panic } from "src/base/common/utilities/panic";
import { Mutable } from "src/base/common/utilities/type";
import { TokenEnum, MarkEnum } from "src/editor/common/markdown";
import { ProseNodeType, ProseMarkType } from "src/editor/common/proseMirror";
import { DocumentNode, DocumentMark } from "src/editor/model/documentNode/documentNode";
import { Codespan } from "src/editor/model/documentNode/mark/codespan";
import { Emphasis } from "src/editor/model/documentNode/mark/emphasis";
import { Link } from "src/editor/model/documentNode/mark/link";
import { MathInline } from "src/editor/model/documentNode/mark/mathInline";
import { Strong } from "src/editor/model/documentNode/mark/strong";
import { Blockquote } from "src/editor/model/documentNode/node/blockquote";
import { CodeBlock } from "src/editor/model/documentNode/node/codeBlock";
import { Escape } from "src/editor/model/documentNode/node/escape";
import { Heading } from "src/editor/model/documentNode/node/heading";
import { HorizontalRule } from "src/editor/model/documentNode/node/horizontalRule";
import { HTML, InlineHTML } from "src/editor/model/documentNode/node/html";
import { Image } from "src/editor/model/documentNode/node/image";
import { LineBreak } from "src/editor/model/documentNode/node/lineBreak";
import { List, ListItem } from "src/editor/model/documentNode/node/list";
import { MathBlock } from "src/editor/model/documentNode/node/mathBlock";
import { Paragraph } from "src/editor/model/documentNode/node/paragraph";
import { Space } from "src/editor/model/documentNode/node/space";
import { Text } from "src/editor/model/documentNode/node/text";
import { EditorSchema, TOP_NODE_NAME } from "src/editor/model/schema";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";

/**
 * @class A provider that stores all the registered {@link IDocumentNode}. Those
 * nodes represents all the valid document nodes that can be parsed into the 
 * view.
 * 
 * @note All the registered nodes and marks will be used to build a complete
 * {@link EditorSchema} that defines a set of rules how the parsing tree will
 * be look like.
 * 
 * @warn Must invoke {@link DocumentNodeProvider["init"]} before access any data.
 */
export class DocumentNodeProvider {

    // [field]

    private readonly _nodes = new Map<string, DocumentNode<any>>();
    private readonly _marks = new Map<string, DocumentMark<any>>();

    // [constructor]

    private constructor() {}

    // [public static methods]

    public static create(instantiationService: IInstantiationService): { register: IO<DocumentNodeProvider> } {
        const provider = new DocumentNodeProvider();
        return {
            /**
             * @description Registers all the valid document nodes.
             */
            register: () => {
                // nodes
                provider.registerNode(instantiationService.createInstance(Space));
                provider.registerNode(instantiationService.createInstance(Text));
                provider.registerNode(instantiationService.createInstance(Escape));
                provider.registerNode(instantiationService.createInstance(Paragraph));
                provider.registerNode(instantiationService.createInstance(Blockquote));
                provider.registerNode(instantiationService.createInstance(HorizontalRule));
                provider.registerNode(instantiationService.createInstance(Heading));
                provider.registerNode(instantiationService.createInstance(CodeBlock));
                provider.registerNode(instantiationService.createInstance(List));
                provider.registerNode(instantiationService.createInstance(ListItem));
                provider.registerNode(instantiationService.createInstance(LineBreak));
                provider.registerNode(instantiationService.createInstance(Image));
                provider.registerNode(instantiationService.createInstance(HTML));
                provider.registerNode(instantiationService.createInstance(InlineHTML));
                provider.registerNode(instantiationService.createInstance(MathBlock));
                provider.registerNode(instantiationService.createInstance(MathInline));

                // marks
                provider.registerMark(instantiationService.createInstance(Link));
                provider.registerMark(instantiationService.createInstance(Emphasis));
                provider.registerMark(instantiationService.createInstance(Strong));
                provider.registerMark(instantiationService.createInstance(Codespan));

                return provider;
            }
        };
    }

    // [public methods]

    public isNodeRegistered(name: string): boolean {
        return this._nodes.has(name);
    }

    public isMarkRegistered(name: string): boolean {
        return this._marks.has(name);
    }

    public registerNode(node: DocumentNode<any>): void {
        if (!this.__assertIfValid(node.name)) return;
        this._nodes.set(node.name, node);
    }

    public registerMark(mark: DocumentMark<any>): void {
        if (!this.__assertIfValid(mark.name)) return;
        this._marks.set(mark.name, mark);
    }

    public getNode<TToken>(name: TokenEnum | string): DocumentNode<TToken> | undefined {
        return this._nodes.get(name);
    }

    public getMark<TToken>(name: MarkEnum | string): DocumentMark<TToken> | undefined {
        return this._marks.get(name);
    }

    public getRegisteredNodes(): readonly DocumentNode<any>[] {
        const arr: DocumentNode<any>[] = [];
        for (const [name, node] of this._nodes) { arr.push(node); }
        return arr;
    }

    public getRegisteredMarks(): readonly DocumentMark<any>[] {
        const arr: DocumentMark<any>[] = [];
        for (const [name, mark] of this._marks) { arr.push(mark); }
        return arr;
    }

    public init(schema: EditorSchema): void {
        for (const [name, node] of this._nodes) {
            const nodeCtor = schema.getNodeType(name);
            if (!nodeCtor) {
                panic(`[DocumentNodeProvider] Cannot find prosemirror node constructor for type ${name}`);
            }
            initDocumentNode(node, nodeCtor);
        }

        for (const [name, mark] of this._marks) {
            const markCtor = schema.getMarkType(name);
            if (!markCtor) {
                panic(`[DocumentNodeProvider] Cannot find prosemirror mark constructor for type ${name}`);
            }
            initDocumentMark(mark, markCtor);
        }
    }

    // [private helper methods]

    private __assertIfValid(name: string): boolean {
        if (this._nodes.has(name)) {
            console.warn(`The given document node is already registered with name: ${name}.`);
            return false;
        }

        if (this._marks.has(name)) {
            console.warn(`The given document mark is already registered with name: ${name}.`);
            return false;
        }

        if (name === TOP_NODE_NAME) {
            console.warn(`Cannot register the document node with name '${TOP_NODE_NAME}' since it is already taken by default.`);
            return false;
        }

        return true;
    }
}

function initDocumentNode(node: DocumentNode<any>, ctor: ProseNodeType): void {
    (<Mutable<typeof node>>node).ctor = ctor;
}

function initDocumentMark(mark: DocumentMark<any>, ctor: ProseMarkType): void {
    (<Mutable<typeof mark>>mark).ctor = ctor;
}