import { MarkBuilder, NodeBuilder, builders } from 'prosemirror-test-builder';
import { pipe } from 'src/base/common/utilities/functional';
import { ProseEditorState, ProseEditorView, ProseNode, ProseNodeSelection, ProseSchema, ProseTextSelection } from "src/editor/common/proseMirror";
import { DocumentNodeProvider } from "src/editor/model/documentNode/documentNodeProvider";
import { buildSchema } from "src/editor/model/schema";
import { createIntegration } from 'test/utils/integration';

/**
 * Declaring an internal type from {@link NodeBuilder} and {@link MarkBuilder}.
 */
type Tag = {
    cursor?: number;
    node?: number;
    start?: number;
    end?: number;
};

type DocumentInfo = ProseNode & {
    tag: Tag;
};

interface IEditorInfo extends Tag {
    readonly state: ProseEditorState;
    readonly view: ProseEditorView;
}

const di = await createIntegration({ 
    i18nService: true 
});

export namespace ProseUtilsTest {

    export const buildNodeBuilder = <T extends ProseSchema>(schema: T) => builders(schema, {
        /**
         * To specify the custom node builders, it should be an object mapping 
         * names to attribute objects, which may contain a nodeType or markType 
         * property to specify which node or mark the builder by this name 
         * should create.
         */
        
        // nodes
        doc: { nodeType: 'doc' },
        blockquote: { nodeType: 'blockquote' },
        code_block: { nodeType: 'code_block' },
        heading: { nodeType: 'heading' },
        hr: { nodeType: 'hr' },
        html: { nodeType: 'html' },
        image: { nodeType: 'image', src: 'foo' },
        br: { nodeType: 'br' },
        list: { nodeType: 'list' },
        p: { nodeType: 'paragraph' },
        space: { nodeType: 'space' },
        text: { nodeType: 'text' },
        
        // marks
        listItem: { markType: 'list_item' },
        codespan: { markType: 'code' },
        em: { markType: 'em' },
        link: { markType: 'link', href: 'foo' },
        strong: { markType: 'strong' },
    });

    const defaultNodeBuilder = pipe(DocumentNodeProvider.create(di).register(), buildSchema, buildNodeBuilder);

    const list = <NodeBuilder>defaultNodeBuilder['list']!;
    const ul = (...children: any[]) => defaultNodes.list({ ordered: false }, ...children);
    const li = (...children: any[]) => defaultNodes.list({ ordered: true }, ...children);

    export const defaultNodes = {
        doc: <NodeBuilder>defaultNodeBuilder['doc']!,
        blockquote: <NodeBuilder>defaultNodeBuilder['blockquote']!,
        code_block: <NodeBuilder>defaultNodeBuilder['code_block']!,
        heading: <NodeBuilder>defaultNodeBuilder['heading']!,
        hr: <NodeBuilder>defaultNodeBuilder['hr']!,
        html: <NodeBuilder>defaultNodeBuilder['html']!,
        image: <NodeBuilder>defaultNodeBuilder['image']!,
        br: <NodeBuilder>defaultNodeBuilder['br']!,
        list: list,
        ul: ul,
        li: li,
        p: <NodeBuilder>defaultNodeBuilder['p']!,
        space: <NodeBuilder>defaultNodeBuilder['space']!,
        text: <NodeBuilder>defaultNodeBuilder['text']!,
        
        listItem: <MarkBuilder>defaultNodeBuilder['listItem']!,
        codespan: <MarkBuilder>defaultNodeBuilder['codespan']!,
        em: <MarkBuilder>defaultNodeBuilder['em']!,
        link: <MarkBuilder>defaultNodeBuilder['link']!,
        strong: <MarkBuilder>defaultNodeBuilder['strong']!,
    };

    /**
     * @description A quick way to build an ProseMirror editor during test 
     * environment.
     * @param doc The editor will build based on this given {@link ProseNode}.
     * @returns An object that contains useful info.
     */
    export function buildEditor(doc: DocumentInfo): IEditorInfo {

        // container
        const container = document.createElement('div');

        // schema
        const nodeProvider = DocumentNodeProvider.create(di).register();
        const schema = buildSchema(nodeProvider);

        // build
        const state = ProseEditorState.create({
            doc,
            schema,
            selection: __initSelection(doc),
        });
        const view = new ProseEditorView(container, { state });

        // render
        document.body.appendChild(container);
        return { view, state, ...doc.tag };
    }
}

function __initSelection(doc: DocumentInfo): ProseTextSelection | ProseNodeSelection | undefined {
    const { cursor, node, start, end } = doc.tag;

    if (typeof node === 'number') {
        return new ProseNodeSelection(doc.resolve(node));
    }
    if (typeof cursor === 'number') {
        return new ProseTextSelection(doc.resolve(cursor));
    }
    if (typeof start === 'number' && typeof end === 'number') {
        return new ProseTextSelection(doc.resolve(start), doc.resolve(end));
    }
}