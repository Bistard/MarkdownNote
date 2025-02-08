import { Node as ProseNode, ResolvedPos } from "prosemirror-model";
import { Selection } from "prosemirror-state";

export {
    Step as ProseStep,
    ReplaceStep as ProseReplaceStep,
    Mapping as ProseMapping,
    StepMap as ProseStepMapping,
} from "prosemirror-transform";

export { 
    EditorState as ProseEditorState,
    NodeSelection as ProseNodeSelection,
    Transaction as ProseTransaction,
    Plugin as ProseExtension,
    Command as ProseCommand,
    Selection as ProseSelection,
    AllSelection as ProseAllSelection,
    TextSelection as ProseTextSelection,
    SelectionRange as ProseSelectionRange,
} from "prosemirror-state";

export type ProseCursor = Selection & { empty: true; };

export { 
    EditorView as ProseEditorView, 
    EditorProps as ProseEditorProperty, 
    DirectEditorProps as ProseDirectEditorProperty,
    EditorProps as ProseEditorProps,
    Decoration as ProseDecoration,
    DecorationSet as ProseDecorationSet,
    DecorationSource as ProseDecorationSource,
} from "prosemirror-view";

export { 
    Slice as ProseSlice,
    ContentMatch as ProseContentMatch,
    MarkSpec as ProseMarkSpec, 
    NodeSpec as ProseNodeSpec, 
    Node as ProseNode, 
    NodeType as ProseNodeType, 
    MarkType as ProseMarkType, 
    NodeRange as ProseNodeRange,
    Attrs as ProseAttrs, 
    Mark as ProseMark, 
    Fragment as ProseFragment,
    Schema as ProseSchema,
    ResolvedPos as ProseResolvedPos,
    DOMOutputSpec as ProseDOMOutputSpec,
} from "prosemirror-model";

export interface IProseTextNode extends ProseNode {
    withText(text: string): IProseTextNode;
}

declare module 'prosemirror-model' {
    
    // eslint-disable-next-line local/code-interface-check
    interface ResolvedPos {
        
        /**
         * @description Returns the absolute position of the **start** of the 
         * node at the specified depth.
         * 
         * @param depth The depth at which to calculate the start position.
         *   1. Defaults to `this.depth`, meaning it returns the start of the 
         *      current node.
         *   2. If `depth` is 0, returns 0, the start of the document.
         * 
         * @note The value is **inside** the node, meaning it points to the 
         *       first character or first child node inside that node.
         * 
         * @example
         * ```ts
         * // Document structure:
         * // <doc>
         * //   <p>Hello, </p>
         * //   <p>world!</p>
         * // </doc>
         * 
         * const pos = doc.resolve(10);  // Inside the second p
         * console.log(pos.start(1)); // Returns the position before "world!" but after <p>
         * ```
         */
        start(depth?: number | null): number;

        /**
         * @description Returns the absolute position of the **end** of the node 
         * at the specified depth.
         * 
         * @param depth The depth at which to calculate the end position.
         *   1. Defaults to `this.depth`, meaning it returns the end of the 
         *      current node.
         *   2. If `depth` is 0, returns the length of the document, the end of 
         *      the root.
         * 
         * @note The value is **inside** the node, meaning it points **after** 
         *       the last character or last child node but before the node 
         *       itself closes.
         * 
         * @example
         * ```ts
         * // Document structure:
         * // <doc>
         * //   <p>Hello, </p>
         * //   <p>world!</p>
         * // </doc>
         * 
         * const pos = doc.resolve(10);  // Inside the second p
         * console.log(pos.end(1)); // Returns the position after "world!" but before </p>
         * ```
         */
        end(depth?: number | null): number;

        /**
         * @description Returns the absolute position immediately **before** the 
         * node at the specified depth.
         * 
         * @param depth The depth at which to calculate the before position.
         *   1. Defaults to `this.depth`, meaning it returns the position before 
         *      the current node.
         *   2. If `depth` is 0, returns 0, as the document itself has no 
         *      "before" position.
         * 
         * @note
         * - `.start(depth)` returns the position **inside** the node at the given depth.
         * - `.before(depth)` returns the position **before** the node in its parent.
         * 
         * @example
         * ```ts
         * // Document structure:
         * // <doc>
         * //   <paragraph>Hello, </paragraph>
         * //   <paragraph>world!</paragraph>
         * // </doc>
         * 
         * const pos = doc.resolve(10);  // Inside the second paragraph
         * console.log(pos.start(1)); // Returns 9 (start of the second paragraph)
         * console.log(pos.before(1)); // Returns 8 (before the second paragraph starts)
         * ```
         */
        after(depth?: number | null): number;

        /**
         * @description Returns the absolute position immediately **after** the 
         * node at the specified depth.
         * 
         * @param depth The depth at which to calculate the after position.
         *   1. Defaults to `this.depth`, meaning it returns the position after 
         *      the current node.
         *   2. If `depth` is 0, returns the length of the document.
         * 
         * @note
         * - `.end(depth)` returns the position **inside** the node, at its last position.
         * - `.after(depth)` returns the position **after** the node in its parent's content.
         * 
         * @example
         * ```ts
         * // Document structure:
         * // <doc>
         * //   <paragraph>Hello, </paragraph>
         * //   <paragraph>world!</paragraph>
         * // </doc>
         * 
         * const pos = doc.resolve(10);  // Inside the second paragraph
         * console.log(pos.end(1)); // Returns 15 (inside the paragraph, just before it closes)
         * console.log(pos.after(1)); // Returns 16 (after the paragraph has closed)
         * ```
         */
        before(depth?: number | null): number;

        /**
         * @description The exact same API as {@link getParentNodeAt}. Except 
         * making `depth = this.depth`.
         * @note Wrapper of `this.node()`.
         */
        getCurrNode(): ProseNode;

        /**
         * @description Retrieves a parent node from the document structure at a 
         *              specified depth level relative to the root.
         * 
         * @note Wrapper of `this.node()`.
         * @note The depth is measured from the root of the document, where the root 
         *       node (usually the document itself) is at depth 0. This method allows 
         *       you to navigate the document tree and access ancestor nodes at 
         *       various levels of the hierarchy.
         * 
         * @param depth The depth level from the root at which to retrieve the node. 
         *   - Depth 0 always refers to the root document node.
         *   - A positive depth value specifies the nth level down from the root node.
         *   - When `depth` is negative, it is added to the current depth of the 
         *     resolved position, effectively moving upwards in the document tree. 
         *     This allows for relative upward navigation from the current node.
         * 
         * @note The method returns `undefined` if the specified depth exceeds the 
         *       bounds of the document structure, meaning the depth is greater than 
         *       the total number of levels in the document tree.
         * @note When using negative depths, if the calculated depth (current depth 
         *       + negative depth) is less than 0, the method will return undefined, 
         *       as it cannot go above the root of the document tree.
         * 
         * @example
         * ```ts
         * // Given a document structure:
         * // <doc>
         * //   <paragraph>Hello, </paragraph>
         * //   <paragraph>world!</paragraph>
         * // </doc>
         * 
         * // Assuming `pos` is a resolved position in the second paragraph:
         * pos.node();        // Returns the second <paragraph> node
         * pos.node(0);       // Returns the <doc> node
         * pos.node(pos.depth); // Same as pos.node(), returns the second <paragraph> node
         * pos.node(-1);      // Returns the parent of the node at the current position, which is also the <doc> node
         * 
         * // For a nested structure like:
         * // <doc>
         * //   <blockquote>
         * //     <paragraph>One</paragraph>
         * //     <paragraph>Two<img /></paragraph>
         * //   </blockquote>
         * // </doc>
         * 
         * // Assuming `pos` is inside the <paragraph> containing "Two":
         * pos.node(-1); // Returns the <paragraph> node containing "Two"
         * pos.node(-2); // Returns the <blockquote> node
         * ```
         */
        getParentNodeAt(depth: number): ProseNode | undefined;

        /**
         * @description Finds the deepest common ancestor node between this position 
         *              and the given position. The returned value is the depth at 
         *              which both positions share the same parent node.
         * 
         * ### Example 1: Positions within the same section but different paragraphs
         * 
         * Consider a document structured as:
         * 
         * ```plaintext
         * doc (depth 0)
         * └── section (depth 1)
         *     ├── paragraph (depth 2)
         *     │   └── text "Hello" (depth 3)
         *     └── paragraph (depth 2)
         *         └── text "World" (depth 3)
         * ```
         * 
         * ```js
         * const resolvedPos1 = doc.resolve(2);   // Inside first paragraph ("Hello")
         * const resolvedPos2 = doc.resolve(12);  // Inside second paragraph ("World")
         * 
         * // Since both positions are in different paragraphs but share the same section,
         * // the common ancestor depth will be 1 (the section node).
         * const sharedDepth = resolvedPos1.getCommonAncestorDepth(resolvedPos2.pos);
         * console.log(sharedDepth);  // Output: 1
         * ```
         * 
         * ### Example 2: One position is at the root and another is deep in the document
         * 
         * Consider a document structured similarly to Example 1. 
         * 
         * ```js
         * const resolvedPos1 = doc.resolve(0);   // Position at the start of the document (root)
         * const resolvedPos2 = doc.resolve(4);   // Inside first paragraph ("Hello")
         * 
         * // The only common ancestor is the root (depth 0), so the result is 0.
         * const sharedDepth = resolvedPos1.getCommonAncestorDepth(resolvedPos2.pos);
         * console.log(sharedDepth);  // Output: 0
         * ```
         * 
         * @param pos The position to compare with this one.
         * @returns The depth of the shared ancestor node, or 0 if the only common 
         *          ancestor is the root node.
         */
        getCommonAncestorDepth(pos: number): number;
    }
}

(function extendProseMirrorPrototypes() {
    __extendResolvedPosPrototype();
})();

function __extendResolvedPosPrototype(): void {
    ResolvedPos.prototype['getParentNodeAt'] = function (depth: number) { return this.node(depth); };
    ResolvedPos.prototype['getCurrNode'] = function () { return this.node(this.depth); };
    ResolvedPos.prototype['getCommonAncestorDepth'] = function (pos: number) { return this.sharedDepth(pos); };
}