import { FastElement } from "src/base/browser/basic/fastElement";
import { HexColor } from "src/base/common/color";
import { Disposable, IDisposable, toDisposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";
import { err, ok, Result } from "src/base/common/result";
import { panic } from "src/base/common/utilities/panic";
import { Dimension, IDomBox } from "src/base/common/utilities/size";
import { If, Pair } from "src/base/common/utilities/type";

const BODY = document.body;
const DocElement = document.documentElement;

export function initGlobalCssVariables(): void {
	if (!document) {
		return;
	}

	document.body.style.setProperty('--z-index-low', '2');
	document.body.style.setProperty('--z-index-medium', '10');
	document.body.style.setProperty('--z-index-high', '100');
}

/**
 * @namespace DomStyle A series of types for DOM styling purpose.
 */
export namespace DomStyle {

	export type Position = 'static' | 'absolute' | 'fixed' | 'relative' | 'sticky' | 'initial' | 'inherit';
	export type Display = 'block' | 'compact' | 'flex' | 'inline' | 'inline-block' | 'inline-flex' | 'inline-table' | 'list-item' | 'marker' | 'none' | 'run-in' | 'table' | 'table-caption' | 'table-cell' | 'table-column' | 'table-column-group' | 'table-footer-group' | 'table-header-group' | 'table-row' | 'table-row-group' | 'initial' | 'inherit';
	export type FontWeight = 'normal' | 'lighter' | 'bold' | 'bolder' | 'initial' | 'inherit' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
	export type Visibility = 'visible' | 'hidden' | 'collapse' | 'initial' | 'inherit';
	export type Color<T extends string> = HexColor<T>;
}

/**
 * @readonly A enumeration of all HTMLElement event types.
 * 
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element}
 */
export const enum EventType {

	unhandledrejection = 'unhandledrejection',

	click = 'click',
	contextmenu = 'contextmenu',
	mouseover = 'mouseover',
	mouseout = 'mouseout',
	mouseenter = 'mouseenter',
	mouseleave = 'mouseleave',
	mousedown = 'mousedown',
	mouseup = 'mouseup',
	mousemove = 'mousemove',
	doubleClick = 'dblclick',
	wheel = 'wheel',

	touchstart = 'touchstart',
	touchmove = 'touchmove',
	touchend = 'touchend',
	touchcancel = 'touchcancel',

	keydown = 'keydown',
	keyup = 'keyup',
	keypress = 'keypress',
	compositionStart = 'compositionstart',
	compositionUpdate = 'compositionupdate',
	compositionEnd = 'compositionend',

	resize = 'resize',

	focusin = 'focusin',
	focusout = 'focusout',
	focus = 'focus',
	blur = 'blur',

	drag = 'drag',
	dragstart = 'dragstart',
	dragend = 'dragend',
	dragover = 'dragover',
	dragenter = 'dragenter',
	dragleave = 'dragleave',
	drop = 'drop',

	input = 'input',
    select = "select",

	transitionend = 'transitionend',
}

export const enum Orientation {
    Horizontal,
    Vertical
}

export type Direction = DirectionX | DirectionY;

export const enum DirectionX {
	Left = 'left',
	Right = 'right',
}

export const enum DirectionY {
	Top = 'top',
	Bottom = 'bottom',
}

export const enum CollapseState {
	Collapse = 'collapse',
	Expand = 'expand',
}

export type DomEventMap = HTMLElementEventMap & DocumentEventMap & WindowEventMap;

/**
 * @description Given a `EventTarget` (eg. HTMLElement), we add a `eventType` 
 * listener to the target with the provided callback. The function returns a 
 * disposable to remove the listener.
 * 
 * @param node The target to be listening.
 * @param eventType The event type.
 * @param callback The callback function when the event happens.
 * @returns A disposable to remove the listener from the target.
 */
export function addDisposableListener<T extends keyof GlobalEventHandlersEventMap>(node: EventTarget, eventType: T, callback: (event: GlobalEventHandlersEventMap[T]) => void, useCapture: boolean = false): IDisposable {
	node.addEventListener(eventType, <any>callback, { capture: useCapture });
	let disposed = false;

	return toDisposable(() => {
		if (disposed) {
			return;
		}

		if (!node) {
			return;
		}

		node.removeEventListener(eventType, <any>callback);
		disposed = true;
	});
}

export type IStyleDisposable = IDisposable & {
	readonly style: HTMLStyleElement;
};

/**
 * Generates a {@link HTMLStyleElement} and appends to the given {@link HTMLElement}.
 * @param element The given HTMLElement to have the CSS style.
 * @returns A disposable that will dispose the new created stylesheet from the 
 * given HTMLElement.
 * 
 * @note Optimized for 'screen' in media attribute.
 */
export function createStyleInCSS(element: HTMLElement): IStyleDisposable {
	const style = document.createElement('style');
	
	/**
	 * The media attribute specifies what media/device the target resource is 
	 * optimized for. 
	 * 		`screen`: Used for computer screens.
	 */
	style.media = 'screen';
	
	element.appendChild(style);
	return {
		dispose: () => element.removeChild(style),
		style: style,
	};
}

/**
 * @description Programmatically load a CSS file with given `href` into HTML.
 */
export function loadCSS(href: string): Promise<Result<void, Error>> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve(ok());
        link.onerror = error => reject(err(error));
        document.head.appendChild(link);
    });
}

/**
 * @description Check if the web environment (DOM content) has been loaded.
 * @returns A promise that will fulfilled when everything is loaded.
 */
export function waitDomToBeLoad(): Promise<unknown> {
	return new Promise<unknown>(resolve => {
		const readyState = document.readyState;
		if (readyState === 'complete' || (document && BODY !== null)) {
			resolve(undefined);
		} else {
			window.addEventListener('DOMContentLoaded', resolve, false);
		}
	});
}

/**
 * @description A utility namespace that contains all the helper functions 
 * relates to DOM.
 * 
 * {@link DomUtility.Attrs}
 * {@link DomUtility.Positions}
 * {@link DomUtility.Elements}
 * {@link DomUtility.Modifiers}
 * 
 * @warn If the HTMLElement has not been added into the DOM tree, some methods 
 * under the namespace will NOT work properly.
 */
export namespace DomUtility
{

	/**
	 * @warn The size-related methods does NOT work for IE8 browser, see 
 	 * 	https://stackoverflow.com/questions/5227909/how-to-get-an-elements-padding-value-using-javascript AND
 	 * 	https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle
	 */
	export namespace Attrs {

		export function getPropertyValue(element: HTMLElement, property: string, computed?: CSSStyleDeclaration): number;
		export function getPropertyValue<T extends string[]>(element: HTMLElement, properties: [...T], computed?: CSSStyleDeclaration): { [K in keyof T]: number };
		export function getPropertyValue(element: HTMLElement, properties: string | string[], computed?: CSSStyleDeclaration): number | number[] {
			const computedStyle = computed ?? getComputedStyle(element);
			const propsArray = Array.isArray(properties) ? properties : [properties];

			const values = propsArray.map(prop => {
				const raw = computedStyle.getPropertyValue(prop);
				return parseFloat(raw) || 0;
			});

			return Array.isArray(properties) ? values : values[0]!;
		}

		// [method - padding]

		export function getPaddings(element: HTMLElement, computed?: CSSStyleDeclaration): Record<Direction, number> {
			const [top, right, bottom, left] = getPropertyValue(
				element, 
				[
					'padding-top',
					'padding-right',
					'padding-bottom',
					'padding-left'
				],
				computed
			);
			return { top, right, bottom, left };
		}

		export function getPaddingTop(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getPaddings(element, computed).top;
		}

		export function getPaddingBottom(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getPaddings(element, computed).bottom;
		}

		export function getPaddingLeft(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getPaddings(element, computed).left;
		}

		export function getPaddingRight(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getPaddings(element, computed).right;
		}

		// [method - border]

		export function getBorders(element: HTMLElement, computed?: CSSStyleDeclaration): Record<Direction, number> {
			const [top, right, bottom, left] = getPropertyValue(
				element, 
				[
					'border-top-width',
					'border-right-width',
					'border-bottom-width',
					'border-left-width'
				],
				computed
			);
			return { top, right, bottom, left };
		}

		export function getBorderTop(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getBorders(element, computed).top;
		}

		export function getBorderBottom(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getBorders(element, computed).bottom;
		}

		export function getBorderLeft(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getBorders(element, computed).left;
		}

		export function getBorderRight(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getBorders(element, computed).right;
		}
		
		// [method - margin]

		export function getMargins(element: HTMLElement, computed?: CSSStyleDeclaration): Record<Direction, number> {
			const [top, right, bottom, left] = getPropertyValue(
				element, 
				[
					'margin-top',
					'margin-right',
					'margin-bottom',
					'margin-left'
				], 
				computed
			);
			return { top, right, bottom, left };
		}

		export function getMarginTop(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getMargins(element, computed).top;
		}

		export function getMarginBottom(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getMargins(element, computed).bottom;
		}

		export function getMarginLeft(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getMargins(element, computed).left;
		}

		export function getMarginRight(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			return getMargins(element, computed).right;
		}

		// [method - content]

		/**
		 * @description Get element total width (including, padding, borders 
		 * and margins).
		 * @param element The HTMLElement.
		 */
		export function getTotalWidth(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			const margins = getMargins(element, computed);
			return element.offsetWidth + margins.left + margins.right;
		}

		/**
		 * @description Get element total height (including, padding, borders 
		 * and margins).
		 * @param element The HTMLElement.
		 */
		export function getTotalHeight(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			const margins = getMargins(element, computed);
			return element.offsetHeight + margins.top + margins.bottom;
		}

		/**
		 * @description Get the height of the content excluding padding and border.
		 * @param element The HTMLElement.
		 * @note If the element is NOT in the DOM tree, the behavior is undefined.
		 */
		export function getContentHeight(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			computed ??= getComputedStyle(element);
			const paddings = getPaddings(element, computed);
			const borders = getBorders(element, computed);
			return element.offsetHeight - (paddings.top + paddings.bottom) - (borders.top + borders.bottom);
		}

		/**
		 * @description Get the width of the content excluding padding and border.
		 * @param element The HTMLElement.
		 * @note If the element is NOT in the DOM tree, the behavior is undefined.
		 */
		export function getContentWidth(element: HTMLElement, computed?: CSSStyleDeclaration): number {
			computed ??= getComputedStyle(element);
			const paddings = getPaddings(element, computed);
			const borders = getBorders(element, computed);
			return element.offsetWidth - (paddings.left + paddings.right) - (borders.left + borders.right);
		}

		/**
		 * @description Get element top position relatives to the viewport.
		 * @param element The HTMLElement.
		 */
		export function getViewportTop(element: HTMLElement): number {
			const box = element.getBoundingClientRect();
			const scrollTop = window.pageYOffset || DocElement.scrollTop || BODY.scrollTop;
			const clientTop = DocElement.clientTop || BODY.clientTop || 0;
			const top  = box.top +  scrollTop - clientTop;
			return Math.round(top);
		}

		/**
		 * @description Get element left position relatives to the viewport.
		 * @param element The HTMLElement.
		 */
		export function getViewportLeft(element: HTMLElement): number {
			const box = element.getBoundingClientRect();
			const scrollLeft = window.pageXOffset || DocElement.scrollLeft || BODY.scrollLeft;
			const clientLeft = DocElement.clientLeft || BODY.clientLeft || 0;
			const left = box.left + scrollLeft - clientLeft;
			return Math.round(left);
		}
	}

	export namespace Positions {

		/**
		 * @description Calculates the position and dimensions of an DOM element 
		 * relative to the entire web page, taking into account any scrolling 
		 * that has occurred.
		 * @param node The given DOM element.
		 * @returns A dom position.
		 */
		export function getNodePagePosition(node: HTMLElement): IDomBox {
			const box: DOMRect = node.getBoundingClientRect();
			return {
				left: box.left + window.scrollX,
				top: box.top + window.scrollY,
				width: box.width,
				height: box.height,
			};
		}

		/**
		 * @description calculates the x and y coordinates of a mouse click 
		 * event relative to the provided target element.
		 * @param event The {@link MouseEvent}.
		 * @param target The {@link EventTarget} we are relative with.
		 * 
		 * @throws An exception will be thrown when there is no target element
		 * 		   detected.
		 */
		export function getRelativeClick(event: MouseEvent, target?: EventTarget): Pair<number, number> {
			const element = (target ?? event.currentTarget) as HTMLElement | null;
			if (element === null) {
				panic('invalid event target');
			}
			const box: DOMRect = element.getBoundingClientRect();
			return [
				event.clientX - box.left,
				event.clientY - box.top
			];
		}

		/**
		 * @description Returns the dimension of the provided element.
		 * @throws An exception will be thrown when it cannot figure the width
		 * 		   and height in the current environment.
		 */
		export function getClientDimension(element: HTMLElement): Dimension {
			// Try with DOM clientWidth / clientHeight
			if (element !== BODY) {
				return new Dimension(element.clientWidth, element.clientHeight);
			}

			// Try innerWidth / innerHeight
			if (window.innerWidth && window.innerHeight) {
				return new Dimension(window.innerWidth, window.innerHeight);
			}

			// Try with BODY.clientWidth / BODY.clientHeight
			if (BODY && BODY.clientWidth && BODY.clientHeight) {
				return new Dimension(BODY.clientWidth, BODY.clientHeight);
			}

			// Try with DocElement.clientWidth / DocElement.clientHeight
			if (DocElement && DocElement.clientWidth && DocElement.clientHeight) {
				return new Dimension(DocElement.clientWidth, DocElement.clientHeight);
			}

			panic('Unable to figure out browser width and height');
		}

		export function isInViewport(element: HTMLElement): boolean {
			const rect = element.getBoundingClientRect();
			return (
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
				rect.right <= (window.innerWidth || document.documentElement.clientWidth)
			);
		}
	}

	export namespace Elements {
		
		/**
		 * @description Check if the given HTMLElement is considered as a input type.
		 */
		export function isInputElement(target: Element): boolean {
			return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contentEditable') === 'true';
		}

		/**
		 * @description Determines if the given object is an instance of
		 * {@link HTMLElement}.
		 * @param o The given object.
		 */
		export function isHTMLElement(o: any): o is HTMLElement {
			if (typeof HTMLElement === 'object') {
				return o instanceof HTMLElement;
			}
			return o && typeof o === 'object' && o.nodeType === 1 && typeof o.nodeName === 'string';
		}

		/**
		 * @description Determines if the given node is in the DOM tree.
		 */
		export function ifInDomTree(node: Node): boolean {
			return node.isConnected;
		}

		/**
		 * @description Returns the current focused element in the DOM tree.
		 * @returns The element or undefined when not found.
		 */
		export function getActiveElement(): Element | undefined {
			let currElement = document.activeElement;
			while (currElement?.shadowRoot) {
				currElement = currElement.shadowRoot.activeElement;
			}
			return currElement ?? undefined;
		}

		/**
		 * @description Check if the given element is focused in the DOM tree.
		 */
		export function isElementFocused(element: Element | EventTarget | undefined | null): boolean {
			return getActiveElement() === element;
		}

		/**
		 * @description Check if the given node is a child node from the 
		 * provided potential ancestor node.
		 * @returns A boolean value if it is indeed an ancestor.
		 */
		export function isAncestor(potentialAncestor: Node, child?: Node): boolean {
			while (child) {
				if (child === potentialAncestor) {
					return true;
				}
				child = child.parentNode ?? undefined;
			}
			return false;
		}
	}

	export namespace Modifiers {
		
		export function show(element: HTMLElement): void {
			element.style.display = '';
			element.removeAttribute('aria-hidden');
		}

		export function hide(element: HTMLElement): void {
			element.style.display = 'none';
			element.setAttribute('aria-hidden', 'true');
		}

		export function setSize(element: HTMLElement, width: number | undefined, height: number | undefined): void {
			if (typeof width === 'number') {
				element.style.width = `${width}px`;
			}
		
			if (typeof height === 'number') {
				element.style.height = `${height}px`;
			}
		}
	
		export function setPosition(
			element: HTMLElement, 
			top: number | undefined, right: number | undefined, 
			bottom: number | undefined, left: number | undefined, 
			position: 'static' | 'absolute' | 'fixed' | 'relative' | 'sticky' | 'initial' | 'inherit',
		): void {
			if (typeof top === 'number') {
				element.style.top = `${top}px`;
			}
		
			if (typeof right === 'number') {
				element.style.right = `${right}px`;
			}
		
			if (typeof bottom === 'number') {
				element.style.bottom = `${bottom}px`;
			}
		
			if (typeof left === 'number') {
				element.style.left = `${left}px`;
			}
		
			element.style.position = position;
		}
	
		export function setFastSize<T extends HTMLElement>(element: FastElement<T>, width: number | undefined, height: number | undefined): void {
			if (typeof width === 'number') {
				element.setWidth(width);
			}
		
			if (typeof height === 'number') {
				element.setHeight(height);
			}
		}
	
		export function setFastPosition<T extends HTMLElement>(
			element: FastElement<T>, 
			top: number | undefined, right: number | undefined, 
			bottom: number | undefined, left: number | undefined, 
			position: 'static' | 'absolute' | 'fixed' | 'relative' | 'sticky' | 'initial' | 'inherit',
		): void {
			if (typeof top === 'number') {
				element.setTop(top);
			}
		
			if (typeof right === 'number') {
				element.setRight(right);
			}
		
			if (typeof bottom === 'number') {
				element.setBottom(bottom);
			}
		
			if (typeof left === 'number') {
				element.setLeft(left);
			}
		
			element.setPosition(position);
		}

		/**
		 * @description Clears all the children DOM nodes from a provided node.
		 * @param node The parent DOM node.
		 * @returns The number of cleared nodes.
		 */
		export function clearChildrenNodes(node: HTMLElement): number {
			let cnt = 0;
			while (node.firstChild) {
				node.firstChild.remove();
				cnt++;
			}
			return cnt;
		}
		
		/**
		 * @description Removes the given node from its parent in DOM tree.
		 * @param node The given DOMElement.
		 */
		export function removeNodeFromParent(node: HTMLElement): void {
			if (node.parentElement) {
				node.parentElement.removeChild(node);
			}
		}
	}
}

/**
 * @class A Simple class for register callback on a given HTMLElement using an
 * {@link Emitter} instead of using raw *addEventListener()* method.
 * 
 * @note LAZY: only start listening when there is one listener presents.
 */
export class DomEmitter<T extends keyof DomEventMap> extends Disposable {

    private readonly emitter: Emitter<DomEventMap[T]>;

    constructor(element: EventTarget, type: T, useCapture: boolean = false) {
		super();
		const fn = (e: any) => this.emitter.fire(e);
		// LAZY
		this.emitter = this.__register(new Emitter({
			onFirstListenerAdd: () => element.addEventListener(type, fn, useCapture),
			onLastListenerDidRemove: () => element.removeEventListener(type, fn, useCapture),
		}));
    }

	get registerListener(): Register<DomEventMap[T]> {
        return this.emitter.registerListener;
    }
}

/**
 * Provides a list of DOM element event APIs.
 */
export interface IDomEvent<IfUseElement extends boolean> {
	
	/**
	 * Fired when a pointing device button (e.g., a mouse's primary button) is 
	 * pressed and released on a single element.
	 */
	onClick: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable, 
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when a pointing device button (e.g., a mouse's primary button) is 
	 * clicked twice on a single element.
	 */
	onDoubleClick: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when a pointing device is moved onto the element to which the 
	 * listener is attached or onto one of its children.
	 */
	onMouseover: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when a pointing device (usually a mouse) is moved off the element 
	 * to which the listener is attached or off one of its children.
	 */
	onMouseout: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;    
	/**
	 * Fired when a pointing device (usually a mouse) is moved over the element 
	 * that has the listener attached.
	 */
	onMouseenter: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when the pointer of a pointing device (usually a mouse) is moved 
	 * out of an element that has the listener attached to it.
	 */
	onMouseleave: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
	
	/**
	 * Fired when a pointing device button is pressed on an element.
	 */
	onMousedown: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when a pointing device button is released on an element.
	 */
	onMouseup: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * Fired when a pointing device (usually a mouse) is moved while over an 
	 * element.
	 */
	onMousemove: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
    
	/**
	 * The `wheel` event fires when the user rotates a wheel button on a 
	 * pointing device (typically a mouse).
	 */
	onWheel: If<IfUseElement, 
		(element: HTMLElement, callback: (event: WheelEvent) => void) => IDisposable,
		(callback: (event: WheelEvent) => void) => IDisposable>;
    
	/**
	 * The `touchstart` event is fired when one or more touch points are placed 
	 * on the touch surface.
	 */
	onTouchstart: If<IfUseElement, 
		(element: HTMLElement, callback: (event: TouchEvent) => void) => IDisposable,
		(callback: (event: TouchEvent) => void) => IDisposable>;
    
	/**
	 * The `touchmove` event is fired when one or more touch points are moved 
	 * along the touch surface.
	 */
	onTouchmove: If<IfUseElement, 
		(element: HTMLElement, callback: (event: TouchEvent) => void) => IDisposable,
		(callback: (event: TouchEvent) => void) => IDisposable>;
    
	/**
	 * The `touchend` event fires when one or more touch points are removed from 
	 * the touch surface.
	 */
	onTouchend: If<IfUseElement, 
		(element: HTMLElement, callback: (event: TouchEvent) => void) => IDisposable,
		(callback: (event: TouchEvent) => void) => IDisposable>;
    
	/**
	 * The `touchcancel` event is fired when one or more touch points have been 
	 * disrupted in an implementation-specific manner (for example, too many 
	 * touch points are created).
	 */
	onTouchcancel: If<IfUseElement, 
		(element: HTMLElement, callback: (event: TouchEvent) => void) => IDisposable,
		(callback: (event: TouchEvent) => void) => IDisposable>;
	
	/**
	 * The `contextmenu` event fires when the user attempts to open a context 
	 * menu. This event is typically triggered by clicking the right mouse 
	 * button, or by pressing the context menu key.
	 * 
	 * In the latter case, the context menu is displayed at the bottom left of 
	 * the focused element, unless the element is a tree, in which case the 
	 * context menu is displayed at the bottom left of the current row.
	 * 
	 * Any right-click event that is not disabled (by calling the event's 
	 * preventDefault() method) will result in a `contextmenu` event being fired 
	 * at the targeted element.
	 */
	onContextmenu: If<IfUseElement, 
		(element: HTMLElement, callback: (event: MouseEvent) => void) => IDisposable,
		(callback: (event: MouseEvent) => void) => IDisposable>;
	
	/**
	 * The `focusin` event fires when an element has received focus, after the 
	 * `focus` event. The two events differ in that `focusin` bubbles, while 
	 * `focus` does not.
	 */
	onFocusin: If<IfUseElement, 
		(element: HTMLElement, callback: (event: FocusEvent) => void) => IDisposable,
		(callback: (event: FocusEvent) => void) => IDisposable>;
	
	/**
	 * The `focusout` event fires when an element has lost focus, after the 
	 * `blur` event. The two events differ in that `focusout` bubbles, while 
	 * `blur` does not.
	 */
	onFocusout: If<IfUseElement, 
		(element: HTMLElement, callback: (event: FocusEvent) => void) => IDisposable,
		(callback: (event: FocusEvent) => void) => IDisposable>;

	/**
	 * The `focus` event fires when an element has received focus. The event 
	 * does not bubble, but the related `focusin` event that follows does bubble.
	 */
	onFocus: If<IfUseElement, 
		(element: HTMLElement, callback: (event: FocusEvent) => void) => IDisposable,
		(callback: (event: FocusEvent) => void) => IDisposable>;

	/**
	 * The `blur` event fires when an element has lost focus. The event does not 
	 * bubble, but the related `focusout` event that follows does bubble.
	 */
	onBlur: If<IfUseElement, 
		(element: HTMLElement, callback: (event: FocusEvent) => void) => IDisposable,
		(callback: (event: FocusEvent) => void) => IDisposable>;

	/**
	 * The `keydown` event is fired when a key is pressed. The event is fired 
	 * for all keys, regardless of whether they produce a character value.
	 */
	onKeydown: If<IfUseElement, 
		(element: HTMLElement, callback: (event: KeyboardEvent) => void) => IDisposable,
		(callback: (event: KeyboardEvent) => void) => IDisposable>;
	
	/**
	 * The `keyup` event is fired when a key is released. The event is fired 
	 * for all keys, regardless of whether they produce a character value.
	 */
	onKeyup: If<IfUseElement, 
		(element: HTMLElement, callback: (event: KeyboardEvent) => void) => IDisposable,
		(callback: (event: KeyboardEvent) => void) => IDisposable>;
}

/**
 * An interface only for {@link BaseElement}.
 */
export interface IBaseElement extends IDomEvent<true>, IDisposable {
	// empty
}

/**
 * @class Simple class that encapsulates DOM event-related methods.
 */
export class BaseElement extends Disposable implements IBaseElement {

	constructor() {
		super();
	}

	public onClick(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.click, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onDoubleClick(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.doubleClick, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onMouseover(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mouseover, (e: MouseEvent) => {
            callback(e);
        }));
    }

	public onMouseout(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mouseout, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onMouseenter(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mouseenter, (e: MouseEvent) => {
            callback(e);
        }));
    }

	public onMouseleave(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mouseleave, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onMousedown(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mousedown, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onMouseup(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mouseup, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onMousemove(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.mousemove, (e: MouseEvent) => {
            callback(e);
        }));
    }

    public onWheel(element: HTMLElement, callback: (event: WheelEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.wheel, (e: WheelEvent) => {
            callback(e);
        }));
    }

    public onTouchstart(element: HTMLElement, callback: (event: TouchEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.touchstart, (e: TouchEvent) => {
            callback(e);
        }));
    }

    public onTouchmove(element: HTMLElement, callback: (event: TouchEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.touchmove, (e: TouchEvent) => {
            callback(e);
        }));
    }

    public onTouchend(element: HTMLElement, callback: (event: TouchEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.touchend, (e: TouchEvent) => {
            callback(e);
        }));
    }

    public onTouchcancel(element: HTMLElement, callback: (event: TouchEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.touchcancel, (e: TouchEvent) => {
            callback(e);
        }));
    }

	public onContextmenu(element: HTMLElement, callback: (event: MouseEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.contextmenu, (e: MouseEvent) => {
            callback(e);
        }));
    }

	public onFocusin(element: HTMLElement, callback: (event: FocusEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.focusin, (e: FocusEvent) => {
            callback(e);
        }));
    }

	public onFocusout(element: HTMLElement, callback: (event: FocusEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.focusout, (e: FocusEvent) => {
            callback(e);
        }));
    }

	public onFocus(element: HTMLElement, callback: (event: FocusEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.focus, (e: FocusEvent) => {
            callback(e);
        }));
    }

	public onBlur(element: HTMLElement, callback: (event: FocusEvent) => void): IDisposable {
        return this.__register(addDisposableListener(element, EventType.blur, (e: FocusEvent) => {
            callback(e);
        }));
    }

	public onKeydown(element: HTMLElement, callback: (event: KeyboardEvent) => void): IDisposable {
		return this.__register(addDisposableListener(element, EventType.keydown, (e: KeyboardEvent) => {
            callback(e);
        }));
	}

	public onKeyup(element: HTMLElement, callback: (event: KeyboardEvent) => void): IDisposable {
		return this.__register(addDisposableListener(element, EventType.keyup, (e: KeyboardEvent) => {
            callback(e);
        }));
	}
}

export interface IDomEventLike {
	preventDefault(): void;
	stopPropagation(): void;
}

export namespace DomEventHandler {

	export function stop<T extends IDomEventLike>(event: T, stopBubble: boolean = false): T {
		event.preventDefault();
		if (stopBubble) {
			event.stopPropagation();
		}
		return event;
	}

	export function isLeftClick(event: MouseEvent): boolean {
		return event.button === 0;
	}

	export function isMiddleClick(event: MouseEvent): boolean {
		return event.button === 1;
	}

	export function isRightClick(event: MouseEvent): boolean {
		return event.button === 2;
	}

	// typically the browser back button
	export function isFourthClick(event: MouseEvent): boolean {
		return event.button === 3;
	}

	// typically the browser forward button
	export function isFifthClick(event: MouseEvent): boolean {
		return event.button === 4;
	}
}