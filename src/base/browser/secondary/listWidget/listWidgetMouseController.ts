import { DomEventHandler, DomUtility } from "src/base/browser/basic/dom";
import { IListMouseEvent, IListTouchEvent, IListWidget, IListWidgetOpts } from "src/base/browser/secondary/listWidget/listWidget";
import { DisposableManager, IDisposable } from "src/base/common/dispose";
import { IS_MAC } from "src/base/common/platform";
import { Arrays } from "src/base/common/util/array";

/**
 * @internal
 * @class An internal class that handles the mouse support of {@link IListWidget}.
 * It handles:
 *  - when to focus DOM
 *  - when to focus item
 *  - when to select item(s)
 * 
 * @readonly EXPORT FOR OTHER MODULES ONLY. DO NOT USE DIRECTLY.
 */
export class ListWidgetMouseController<T> implements IDisposable {

    // [fields]

    private _disposables = new DisposableManager();
    private _view: IListWidget<T>;

    private _multiSelectionSupport: boolean = true;

    // [constructor]

    constructor(view: IListWidget<T>, opts: IListWidgetOpts<T>) {
        this._view = view;

        this._view.DOMElement.classList.add('mouse-support');

        if (opts.multiSelectionSupport !== undefined) {
            this._multiSelectionSupport = opts.multiSelectionSupport;
        }

        this._disposables.register(view.onMousedown(e => this.__onMouseDown(e)));
        this._disposables.register(view.onTouchstart(e => this.__onMouseDown(e)));
        this._disposables.register(view.onClick(e => this.__onMouseClick(e)));
    }

    // [public methods]

    public dispose(): void {
        this._disposables.dispose();
    }

    // [protect methods]

    protected __ifSupported(e: IListMouseEvent<T>): boolean {
        if (DomUtility.isInputElement(e.browserEvent.target as HTMLElement)) {
            return false;
        }
        return true;
    }

    /**
     * @description Handles item focus and selection logic.
     */
    protected __onMouseClick(e: IListMouseEvent<T>): void {

        if (this.__ifSupported(e) === false) {
            return;
        }

        const toFocused = e.actualIndex;
        
        // clicking nowhere, we reset all the traits
        if (toFocused === undefined) {
            this._view.setFocus(null);
            this._view.setAnchor(null);
            this._view.setSelections([]);
            return;
        }

        // check if selecting in range
        if (this.__isSelectingInRangeEvent(e)) {
            this.__multiSelectionInRange(e);
            return;
        } else if (this.__isSelectingInSingleEvent(e)) {
            this._mutliSelectionInSingle(e);
            return;
        }

        // normal click
        this._view.setAnchor(toFocused);
        this._view.setFocus(toFocused);
        if (DomEventHandler.isRightClick(e.browserEvent) === false) {
            this._view.setSelections([toFocused]);
        }
    }

    /**
     * @description Determines if the event is selecting in range. In other words,
     * pressing SHIFT.
     */
    protected __isSelectingInRangeEvent(e: IListMouseEvent<T>): boolean {
        if (this._multiSelectionSupport === false) {
            return false;
        }
        return e.browserEvent.shiftKey;
    }

    /**
     * @description Determines if the event is selecting in single. In other words,
     * pressing CTRL in Windows or META in Macintosh.
     */
    protected __isSelectingInSingleEvent(e: IListMouseEvent<T>): boolean {
        if (this._multiSelectionSupport === false) {
            return false;
        }
        return IS_MAC ? e.browserEvent.metaKey : e.browserEvent.ctrlKey;
    }

    // [private helper methods]

    /**
     * @description Focuses the event target element.
     */
    private __onMouseDown(e: IListMouseEvent<T> | IListTouchEvent<T>): void {
        // prevent double focus
        if (document.activeElement !== e.browserEvent.target) {
			this._view.setDomFocus();
		}
    }

    /**
     * @description Applies multi-selection when selecting in range.
     */
    private __multiSelectionInRange(e: IListMouseEvent<T>): void {
        const toFocused = e.actualIndex!;
        let anchor = this._view.getAnchor();

        // if no focus yet, we focus on the current.
        if (anchor === null) {
            anchor = this._view.getFocus() ?? toFocused;
            this._view.setAnchor(anchor);
        }

        /**
         * @readonly Below is not really a good implementation (could be optimized), 
         * but works.
         */

        // calculates the selection range
        const toSelectRange = Arrays.range(
            Math.min(toFocused, anchor), 
            Math.max(toFocused, anchor) + 1
        );
        const currSelection = this._view.getSelections().sort((a, b) => a - b);
        const contiguousRange = this.__getNearestContiguousRange(Arrays.unique(Arrays.insert(currSelection, anchor)), anchor);
        if (!contiguousRange.length) {
            return;
        }
        const newSelection = 
            Arrays.union(toSelectRange, 
                Arrays.union(
                    Arrays.relativeComplement(currSelection, contiguousRange), 
                    Arrays.relativeComplement(contiguousRange, currSelection)
                )
            );
        
        // update selections and focused
        this._view.setSelections(newSelection);
        this._view.setFocus(toFocused);
    }

    /**
     * @description Applies multi-selection when selecting in single.
     */
    private _mutliSelectionInSingle(e: IListMouseEvent<T>): void {
        const toFocused = e.actualIndex!;

        const currSelection = this._view.getSelections();
        const newSelection = Arrays.remove(currSelection, toFocused);

        this._view.setFocus(toFocused);
        this._view.setAnchor(toFocused);

        if (newSelection.length === currSelection.length) {
            // we are not removing any of the current selections
            this._view.setSelections([...newSelection, toFocused]);
        } else {
            // we removed one of the selections
            this._view.setSelections(newSelection);
        }
    }

    private __getNearestContiguousRange(range: number[], anchor: number): number[] {
        const index = range.indexOf(anchor);
        if (index === -1) {
            return [];
        }

        const result: number[] = [];
        let i = index - 1;
        while (i >= 0 && range[i] === anchor - (index - i)) {
            result.push(range[i--]!);
        }

        result.reverse();
        i = index;
        while (i < range.length && range[i] === anchor + (i - index)) {
            result.push(range[i++]!);
        }

        return result;
    }
}
