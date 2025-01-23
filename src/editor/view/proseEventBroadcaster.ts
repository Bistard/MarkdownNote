import { DomEmitter, EventType } from "src/base/browser/basic/dom";
import { Disposable, IDisposable } from "src/base/common/dispose";
import { Emitter, Event, Register } from "src/base/common/event";
import { createStandardKeyboardEvent, IStandardKeyboardEvent } from "src/base/common/keyboard";
import { memoize } from "src/base/common/memoization";
import { ProseDirectEditorProperty, ProseEditorProperty, ProseEditorView, ProseNode, ProseResolvedPos, ProseSlice, ProseTransaction } from "src/editor/common/proseMirror";

type __TransactionEventBase = {
    readonly view: ProseEditorView;
    readonly transaction: ProseTransaction;
};

export interface IOnBeforeRenderEvent extends __TransactionEventBase { prevent(): void; }
export interface IOnRenderEvent extends __TransactionEventBase {}
export interface IOnDidRenderEvent extends __TransactionEventBase {}
export interface IOnDidSelectionChangeEvent extends __TransactionEventBase {}
export interface IOnDidContentChangeEvent extends __TransactionEventBase {}

type __OnBeforeClickEventBase = {
    readonly view: ProseEditorView;
    readonly position: number;
    readonly node: ProseNode;
    readonly nodePosition: number;
    readonly direct: boolean;
    readonly browserEvent: MouseEvent;
};

type __OnDidClickEventBase = {
    readonly view: ProseEditorView;
    readonly position: number;
    readonly browserEvent: MouseEvent;
};

export interface IOnClickEvent extends __OnBeforeClickEventBase {}
export interface IOnDidClickEvent extends __OnDidClickEventBase {}
export interface IOnDoubleClickEvent extends __OnBeforeClickEventBase {}
export interface IOnDidDoubleClickEvent extends __OnDidClickEventBase {}
export interface IOnTripleClickEvent extends __OnBeforeClickEventBase {}
export interface IOnDidTripleClickEvent extends __OnDidClickEventBase {}

export interface IOnKeydownEvent {
    readonly view: ProseEditorView;
    readonly event: IStandardKeyboardEvent;

    /**
     * Whenever a command is executed by any listeners, we need to invoke 
     * `markAsExecuted` to tell prosemirror to prevent default behavior of the 
     * browser.
     * 
     * @see https://discuss.prosemirror.net/t/question-allselection-weird-behaviours-when-the-document-contains-a-non-text-node-at-the-end/7749/3
     */
    markAsExecuted: () => void;
}

export interface IOnKeypressEvent {
    readonly view: ProseEditorView;
    readonly event: IStandardKeyboardEvent;
    preventDefault(): void;
}

export interface IOnTextInputEvent {
    readonly view: ProseEditorView;
    readonly from: number;
    readonly to: number;
    readonly text: string;
    preventDefault(): void;
}

export interface IOnPasteEvent {
    readonly view: ProseEditorView;
    readonly slice: ProseSlice;
    readonly browserEvent: ClipboardEvent;
    preventDefault(): void;
}

export interface IOnDropEvent {
    readonly view: ProseEditorView;
    readonly slice: ProseSlice;
    readonly moved: boolean;
    readonly browserEvent: DragEvent;
    preventDefault(): void;
}

export interface IEditorMouseEvent {
    
    /**
     * The prosemirror view reference.
     */
    readonly view: ProseEditorView;

    /**
     * The original browser event.
     */
    readonly event: MouseEvent;
    
    /**
     * Defined when the mouse is interacting with any prosemirror node.
     */
    readonly target?: {
        /**
         * The interacting prosemirror node.
         */
        readonly node: ProseNode;
        /**
         * The corresponding HTMLElement.
         */
        readonly nodeElement: HTMLElement;
        /**
         * The absolute position of the node.
         */
        readonly position: number;
        /**
         * The absolute position of the parent of the node. If no parent, 
         * -1 returned.
         */
        readonly parentPosition: number;
        /**
         * When `parentPosition` equals -1, this equal to `position`, otherwise
         * equals to `parentPosition`.
         */
        readonly resolvedPosition: number;
    }
}

export interface IEditorDragEvent extends IEditorMouseEvent {
    readonly event: DragEvent;
    readonly dataTransfer?: DataTransfer;
}

/**
 * An interface only for {@link ProseEventBroadcaster}.
 */
export interface IProseEventBroadcaster extends IDisposable {

    /** 
	 * Fires when the component is either blurred.
	 */
    readonly onDidBlur: Register<void>;
    
    /** 
	 * Fires when the component is either focused.
	 */
    readonly onDidFocus: Register<void>;

    /**
     * Fires before next rendering on DOM tree. The client has a chance to 
     * prevent the render action.
     */
    readonly onBeforeRender: Register<IOnBeforeRenderEvent>;
    
    /**
     * Fires right before a rendering action is taken on DOM tree.
     */
    readonly onRender: Register<IOnRenderEvent>;

    /**
     * Fires after a rendering action is taken on DOM tree. 
     * Either:
     *      1. {@link onDidSelectionChange} or 
     *      2. {@link onDidDocumentChange} 
     * will also trigger this event.
     */
    readonly onDidRender: Register<IOnDidRenderEvent>;
    
    /**
     * Fires whenever the selection of the editor changes.
     */
    readonly onDidSelectionChange: Register<IOnDidSelectionChangeEvent>;
    
    /**
     * Fires whenever the content of the document of the editor changes.
     */
    readonly onDidContentChange: Register<IOnDidContentChangeEvent>;

    /**
     * Fires for each node around a click, from the inside out. The direct flag 
     * will be true for the inner node.
     */
    readonly onClick: Register<IOnClickEvent>;

    /**
     * Fires when the editor is clicked, after 'onClick' event have been called.
     */
    readonly onDidClick: Register<IOnDidClickEvent>;

    /**
     * Fires for each node around a double click, from the inside out. The 
     * direct flag will be true for the inner node.
     */
    readonly onDoubleClick: Register<IOnDoubleClickEvent>;

    /**
     * Fires when the editor is double clicked, after 'onDoubleClick' event have 
     * been called.
     */
    readonly onDidDoubleClick: Register<IOnDidDoubleClickEvent>;

    /**
     * Fires for each node around a triple click, from the inside out. The 
     * direct flag will be true for the inner node.
     */
    readonly onTripleClick: Register<IOnTripleClickEvent>;

    /**
     * Fires when the editor is triple clicked, after 'onDoubleClick' event have 
     * been called.
     */
    readonly onDidTripleClick: Register<IOnDidTripleClickEvent>;

    /**
     * Fires when the editor encounters a keydown event.
     */
    readonly onKeydown: Register<IOnKeydownEvent>;

    /**
     * Fires when the editor encounters a keypress event.
     */
    readonly onKeypress: Register<IOnKeypressEvent>;

    /**
     * Fires whenever the user directly inputs some text, this event is called 
     * before the input is applied. If the `preventDefault` is invoked, the 
     * default behavior of inserting the text is prevented.
     */
    readonly onTextInput: Register<IOnTextInputEvent>;

    readonly onMouseOver: Register<IEditorMouseEvent>;
    readonly onMouseOut: Register<IEditorMouseEvent>;
    readonly onMouseEnter: Register<IEditorMouseEvent>;
    readonly onMouseLeave: Register<IEditorMouseEvent>;
    readonly onMouseDown: Register<IEditorMouseEvent>;
    readonly onMouseUp: Register<IEditorMouseEvent>;
    readonly onMouseMove: Register<IEditorMouseEvent>;
    
    /**
     * Fires when the editor encounters a clipboard event. `slice` is the pasted 
     * content parsed by the editor, but you can directly access the event to 
     * get at the raw content.
     */
    readonly onPaste: Register<IOnPasteEvent>;

    /**
     * Fires when something is dropped onto the editor. `moved` will be true if 
     * this drop moves from the current selection (which should thus be deleted).
     */
    readonly onDrop: Register<IOnDropEvent>;
    
    /**
     * Fires when something is dropped on the editor overlay. Overlay is a layer
     * not just including the editor, but also some spaces.
     */
    readonly onDropOverlay: Register<IEditorDragEvent>;
    readonly onDrag: Register<IEditorDragEvent>;
    readonly onDragStart: Register<IEditorDragEvent>;
    readonly onDragEnd: Register<IEditorDragEvent>;
    readonly onDragOver: Register<IEditorDragEvent>;
    readonly onDragEnter: Register<IEditorDragEvent>;
    readonly onDragLeave: Register<IEditorDragEvent>;

    /**
     * Fires when scrolling happens.
     */
    readonly onWheel: Register<WheelEvent>;
}

/**
 * @class Given either a prosemirror view, or a property object from an 
 * extension, the broadcaster will bind all the event emitter from prosemirror 
 * to our own {@link Emitter} for standardized event handling.
 * 
 * If:
 *  - binding with a {@link ProseEditorProperty}, all the events from prosemirror
 *    will be emitted through our own {@link Emitter}.
 *  - binding with a {@link ProseEditorView}, all the events with an additional
 *    event {@link ProseDirectEditorProperty['dispatchTransaction']} will be emitted.
 */
export class ProseEventBroadcaster extends Disposable implements IProseEventBroadcaster {

    // [field]

    /**
     * The ProseMirror view reference.
     */
    protected readonly _view: ProseEditorView;
    
    /**
     * The element only for dom event listening purpose. This is the element that
     * triggers the dom-related events.
     */
    private readonly _$container: HTMLElement;

    // [event]

    private readonly _onDidBlur = this.__register(new Emitter<void>());
    public readonly onDidBlur = this._onDidBlur.registerListener;
    
    private readonly _onDidFocus = this.__register(new Emitter<void>());
    public readonly onDidFocus = this._onDidFocus.registerListener;

    private readonly _onBeforeRender = this.__register(new Emitter<IOnBeforeRenderEvent>());
    public readonly onBeforeRender = this._onBeforeRender.registerListener;
    
    private readonly _onRender = this.__register(new Emitter<IOnRenderEvent>());
    public readonly onRender = this._onRender.registerListener;
    
    private readonly _onDidRender = this.__register(new Emitter<IOnDidRenderEvent>());
    public readonly onDidRender = this._onDidRender.registerListener;
    
    private readonly _onDidSelectionChange = this.__register(new Emitter<IOnDidSelectionChangeEvent>());
    public readonly onDidSelectionChange = this._onDidSelectionChange.registerListener;
    
    private readonly _onDidContentChange = this.__register(new Emitter<IOnDidContentChangeEvent>());
    public readonly onDidContentChange = this._onDidContentChange.registerListener;

    private readonly _onClick = this.__register(new Emitter<IOnClickEvent>());
    public readonly onClick = this._onClick.registerListener;

    private readonly _onDidClick = this.__register(new Emitter<IOnDidClickEvent>());
    public readonly onDidClick = this._onDidClick.registerListener;

    private readonly _onDoubleClick = this.__register(new Emitter<IOnDoubleClickEvent>());
    public readonly onDoubleClick = this._onDoubleClick.registerListener;

    private readonly _onDidDoubleClick = this.__register(new Emitter<IOnDidDoubleClickEvent>());
    public readonly onDidDoubleClick = this._onDidDoubleClick.registerListener;

    private readonly _onTripleClick = this.__register(new Emitter<IOnTripleClickEvent>());
    public readonly onTripleClick = this._onTripleClick.registerListener;

    private readonly _onDidTripleClick = this.__register(new Emitter<IOnDidTripleClickEvent>());
    public readonly onDidTripleClick = this._onDidTripleClick.registerListener;

    private readonly _onKeydown = this.__register(new Emitter<IOnKeydownEvent>());
    public readonly onKeydown = this._onKeydown.registerListener;

    private readonly _onKeypress = this.__register(new Emitter<IOnKeypressEvent>());
    public readonly onKeypress = this._onKeypress.registerListener;
    
    private readonly _onTextInput = this.__register(new Emitter<IOnTextInputEvent>());
    public readonly onTextInput = this._onTextInput.registerListener;

    @memoize get onMouseOver() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mouseover)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseOut() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mouseout)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseEnter() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mouseenter)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseLeave() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mouseleave)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseDown() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mousedown)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseUp() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mouseup)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    @memoize get onMouseMove() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.mousemove)).registerListener, e => __standardizeMouseEvent(e, this._view)); }
    
    @memoize get onDrag() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.drag)).registerListener, e => __standardizeDragEvent(e, this._view)); }
    @memoize get onDragStart() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.dragstart)).registerListener, e => __standardizeDragEvent(e, this._view)); }
    @memoize get onDragEnd() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.dragend)).registerListener, e => __standardizeDragEvent(e, this._view)); }
    @memoize get onDragOver() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.dragover)).registerListener, e => __standardizeDragEvent(e, this._view)); }
    @memoize get onDragEnter() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.dragenter)).registerListener, e => __standardizeDragEvent(e, this._view)); }
    @memoize get onDragLeave() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.dragleave)).registerListener, e => __standardizeDragEvent(e, this._view)); }

    private readonly _onPaste = this.__register(new Emitter<IOnPasteEvent>());
    public readonly onPaste = this._onPaste.registerListener;

    private readonly _onDrop = this.__register(new Emitter<IOnDropEvent>());
    public readonly onDrop = this._onDrop.registerListener;
    @memoize get onDropOverlay() { return Event.map(this.__register(new DomEmitter(this._$container, EventType.drop)).registerListener, e => __standardizeDragEvent(e, this._view)); }

    @memoize get onWheel() { return this.__register(new DomEmitter(this._$container, EventType.wheel)).registerListener; }

    // [constructor]

    constructor(container: HTMLElement, view: ProseEditorView) {
        super();
        this._$container = container;
        this._view = view;
        const property = view.props;
        
        /**
         * Only applied when the event broadcaster is binding to the actual 
         * prosemirror view directly.
         */
        if (view) {
            const viewProperty = <ProseDirectEditorProperty>property;
            viewProperty.dispatchTransaction = (transaction) => {
                const event = {
                    view: view,
                    transaction: transaction,
                };
                let prevented = false;
                this._onBeforeRender.fire({ ...event, prevent: () => prevented = true });
                
                if (prevented) {
                    return;
                }

                this._onRender.fire(event);

                const newState = view.state.apply(transaction);
                view.updateState(newState);

                this._onDidRender.fire(event);

                if (transaction.selectionSet) {
                    this._onDidSelectionChange.fire(event);
                }

                if (transaction.docChanged) {
                    this._onDidContentChange.fire(event);
                }
            };
        }

        // dom event listeners
        property.handleDOMEvents = {
            ...property.handleDOMEvents,
            focus: () => this._onDidFocus.fire(),
            blur: () => this._onDidBlur.fire(),
        };

        // on before click
        property.handleClickOn = (view, pos, node, nodePos, event, direct) => {
            this._onClick.fire({
                view: view,
                position: pos,
                node: node,
                nodePosition: nodePos,
                browserEvent: event,
                direct: direct,
            });
        };
        
        // on did click
        property.handleClick = (view, pos, event) => {
            this._onDidClick.fire({
                view: view,
                position: pos,
                browserEvent: event,
            });
        };

        // on before double click
        property.handleDoubleClickOn = (view, pos, node, nodePos, event, direct) => {
            this._onDoubleClick.fire({
                view: view,
                position: pos,
                node: node,
                nodePosition: nodePos,
                browserEvent: event,
                direct: direct,
            });
        };
        
        // on did double click
        property.handleDoubleClick = (view, pos, event) => {
            this._onDidDoubleClick.fire({
                view: view,
                position: pos,
                browserEvent: event,
            });
        };

        // on before triple click
        property.handleTripleClickOn = (view, pos, node, nodePos, event, direct) => {
            this._onTripleClick.fire({
                view: view,
                position: pos,
                node: node,
                nodePosition: nodePos,
                browserEvent: event,
                direct: direct,
            });
        };

        // on did triple click
        property.handleTripleClick = (view, pos, event) => {
            this._onDidTripleClick.fire({
                view: view,
                position: pos,
                browserEvent: event,
            });
        };
        
        // on key down
        property.handleKeyDown = (view, event) => {
            let anyExecuted = false;
            
            this._onKeydown.fire({
                view: view,
                event: createStandardKeyboardEvent(event),
                markAsExecuted: () => { anyExecuted = true; },
            });

            return anyExecuted;
        };
        
        // on key press
        property.handleKeyPress = (view, event) => {
            let prevented = false;
            
            this._onKeypress.fire({
                view: view,
                event: createStandardKeyboardEvent(event),
                preventDefault: () => prevented = true,
            });

            return prevented;
        };
        
        // on text input
        property.handleTextInput = (view, from, to, text) => {
            let prevented = false;
            
            this._onTextInput.fire({
                view: view,
                from: from,
                to: to,
                text: text,
                preventDefault: () => prevented = true,
            });

            return prevented;
        };
        
        // on paste
        property.handlePaste = (view, event, slice) => {
            let prevented = false;
            
            this._onPaste.fire({
                view: view,
                browserEvent: event,
                slice: slice,
                preventDefault: () => prevented = true,
            });

            return prevented;
        };
        
        // on drop
        property.handleDrop = (view, event, slice, moved) => {
            let prevented = false;

            this._onDrop.fire({
                view: view,
                browserEvent: event,
                slice: slice,
                moved: moved,
                preventDefault: () => prevented = true,
            });

            return prevented;
        };
    }
}

function __standardizeMouseEvent(e: MouseEvent, view: ProseEditorView): IEditorMouseEvent {
    const pos = view.posAtCoords({
        left: e.clientX,
        top: e.clientY,
    });

    if (!pos) {
        return { view: view, event: e, target: undefined };
    }

    const resolvedPosition = pos.inside === -1 ? pos.pos : pos.inside;
    const node = view.state.doc.nodeAt(resolvedPosition)!;
    const nodeElement = view.nodeDOM(resolvedPosition)! as HTMLElement;
    
    return { 
        view: view, 
        event: e, 
        target: { 
            node: node, 
            nodeElement: nodeElement,
            position: pos.pos, 
            parentPosition: pos.inside,
            resolvedPosition: resolvedPosition,
        } 
    };
}

function __standardizeDragEvent(e: DragEvent, view: ProseEditorView): IEditorDragEvent {
    const pos = view.posAtCoords({
        left: e.clientX,
        top: e.clientY,
    });
    const dataTransfer = e.dataTransfer ?? undefined;

    if (!pos) {
        return { view: view, event: e, target: undefined };
    }

    const resolvedPosition = pos.inside === -1 ? pos.pos : pos.inside;
    const node = view.state.doc.nodeAt(resolvedPosition)!;
    const nodeElement = view.nodeDOM(resolvedPosition)! as HTMLElement;

    return { 
        view: view, 
        event: e, 
        dataTransfer,
        target: { 
            node: node, 
            nodeElement: nodeElement,
            position: pos.pos, 
            parentPosition: pos.inside,
            resolvedPosition: resolvedPosition,
        } 
    };
}