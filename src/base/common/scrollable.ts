import { Disposable, IDisposable, untrackDisposable } from "src/base/common/dispose";
import { Emitter, Register } from "src/base/common/event";

/**
 * @readonly Scroll wheel event type.
 */
 export interface IScrollEvent {

    prevScrollSize: number;
    scrollSize: number;

    prevScrollPosition: number;
    scrollPosition: number;

    /** The delta change in scroll position */
    delta: number;

    prevViewportSize: number;
    viewportSize: number;
}

/**
 * An interface only for {@link Scrollable}.
 */
export interface IScrollable extends IDisposable {
	
    readonly onDidScroll: Register<IScrollEvent>;

	setScrollbarSize(size: number): void;
	setViewportSize(size: number): void;
	setScrollSize(size: number): void;
	setScrollPosition(position: number): void;

	getScrollbarSize(): number;
	getViewportSize(): number;
	getScrollSize(): number;
	getScrollPosition(): number;
	getSliderSize(): number;
	getSliderPosition(): number;
    getSliderMaxPosition(): number;
    getSliderRatio(): number;
	required(): boolean;

    /**
     * @description Computes a new scroll position when the slider / mouse moves
     * a delta amount of pixels.
     * @param delta A change in slider / mouse position.
     * @returns the new scroll position relatives to the moved slider.
     */
    getScrollPositionFromDelta(delta: number): number;

    /**
     * @description Returns a clone of itself.
     */
    clone():  Scrollable;

    /**
     * @description Manually construct a scroll event.
     * @note The `prev`-related data will be the same as the current data.
     */
    getScrollEvent(): IScrollEvent;
}

const MIN_SLIDER_SIZE = 20; // pixels

/**
 * @class A class for storing the numerated data of scrolling action. 
 * Self-recalculating the correct data of a slider if needed.
 * 
 * A {@link Scrollable} only specifies one type of direction, either vertical or
 * horizontal.
 * 
 * Any of the following fields is changed will fires the event `onDidScroll`.
 *  1) viewport size 
 *  2) scroll size 
 *  3) scroll position
 */
export class Scrollable extends Disposable implements IScrollable {

    // [fields]

    /**
     * vertical: width of the scrollbar
     * horizontal: height of the scrollbar
     */
    private _scrollbarSize: number;

    /**
     * vertical: height of the viewport
     * horizontal: width of the viewport
     */
    private _viewportSize: number;

    /**
     * vertical: height of the actual scrolling area
     * horizontal: width of the actual scrolling area
     */
    private _scrollSize: number;

    /**
     * vertical: top of the actual scrolling area
     * horizontal: left of the actual scrolling area
     */
    private _scrollPosition: number;

    /**
     * vertical: the height of the slider
     * horizontal: the width of the slider
     */
    private _sliderSize: number;

    /**
     * vertical: the top of the slider
     * horizontal: the left of the slider
     */
    private _sliderPosition: number;

    /**
     * The ratio represents how fast the scroll goes, how fast the slider goes.
     */
    private _sliderRatio: number;

    /**
     * if `_scrollSize` is zero or `_scrollSize` <= `_viewportSize`, scrollbar 
     * is not required.
     */
    private _required: boolean;

    /**
     * fires when scroll happens.
     */
    private readonly _onDidScroll = this.__register(new Emitter<IScrollEvent>());
    public readonly onDidScroll = this._onDidScroll.registerListener;

    // [constructor]

    constructor(scrollbarSize: number, viewportSize: number, scrollSize: number, scrollPosition: number) {
        super();
        this._scrollbarSize = scrollbarSize;
        this._viewportSize = viewportSize;
        this._scrollSize = scrollSize;
        this._scrollPosition = scrollPosition;

        this._sliderSize = 0;
        this._sliderPosition = 0;
        this._sliderRatio = 0;
        this._required = false;

        this.__recalculate();
    }

    // [methods - set]

    public setScrollbarSize(size: number): void {
        this._scrollbarSize = size;
    }

    public setViewportSize(size: number): void {
        if (this._viewportSize !== size) {
            const prev = this.clone();

            this._viewportSize = size;
            this.__validateValue();
            this.__recalculate();

            this.__fireOnDidScroll(prev);
        }
    }

    public setScrollSize(size: number): void {
        if (this._scrollSize !== size) {
            const prev = this.clone();

            this._scrollSize = size;
            this.__validateValue();
            this.__recalculate();

            this.__fireOnDidScroll(prev);
        }
    }

    public setScrollPosition(position: number): void {
        if (this._scrollPosition !== position) {
            const prev = this.clone();
            
            this._scrollPosition = position;
            this.__validateValue();
            this.__onlyRecalculateSliderPosition();

            this.__fireOnDidScroll(prev);
        }
    }

    // [methods - get]

    public getScrollbarSize(): number {
        return this._scrollbarSize;
    }

    public getViewportSize(): number {
        return this._viewportSize;
    }

    public getScrollSize(): number {
        return this._scrollSize;
    }

    public getScrollPosition(): number {
        return this._scrollPosition;
    }

    public getSliderSize(): number {
        return this._sliderSize;
    }

    public getSliderPosition(): number {
        return this._sliderPosition;
    }

    public getSliderMaxPosition(): number {
        return this._viewportSize - this._sliderSize;
    }

    public getSliderRatio(): number {
        return this._sliderRatio;
    }

    public required(): boolean {
        return this._required;
    }

	// [methods]

    public clone():  Scrollable {
        return new Scrollable(this._scrollbarSize, this._viewportSize, this._scrollSize, this._scrollPosition);
    }

    public getScrollPositionFromDelta(delta: number): number {
        return Math.round((this._sliderPosition + delta) / this._sliderRatio);
    }

    public getScrollEvent(): IScrollEvent {
        return this.__createScrollEvent(this);
    }

    // [private methods]

    /**
     * @description Every time when the {@link Scrollable} changes its fields, 
	 * this method will be invoked to recalculate all the numerated data to 
	 * display the correct scrollbar and its slider.
     */
    private __recalculate(): void {

        /**
         * does not need a scrollbar since the current viewport has enough space 
         * to displays all the contents.
         */
        this._required = this._scrollSize > 0 && this._scrollSize > this._viewportSize;
        if (!this._required) {
            this._sliderSize = 0;
            this._sliderRatio = 0;
            this._sliderPosition = 0;
            return;
        }

        /**
         * recalculates the size of the slider (set a minimum value to avoid the 
         * slider is too small to interact).
         */
        this._sliderSize = Math.max(
            MIN_SLIDER_SIZE, 
            Math.floor(this._viewportSize * this._viewportSize / this._scrollSize)
        );

        /**
         * the slider can move from `0` to `this._viewportSize - this._sliderSize`
         * the scroll can move from `0` to `this._scrollSize - this._viewportSize`
         * we calculate the ratio which represents how fast the scroll goes, 
         * how fast the slider goes.
         * 
         * note that the ratio is always less than 1.
         */
        this._sliderRatio = (
            (this._viewportSize - this._sliderSize) / 
            (this._scrollSize - this._viewportSize)
        );
        
        /**
         * recalculates the position of the slider.
         */
        this._sliderPosition = Math.round(this._scrollPosition * this._sliderRatio);
    }

    /**
     * @description Only recalculates the position of the slider since when 
     * changing the scroll position, other fields does not need to recalculate.
     */
    private __onlyRecalculateSliderPosition(): void {
        this._sliderPosition = Math.round(this._scrollPosition * this._sliderRatio);
    }

    /**
     * @description Validates the current numerated data is not out of range.
     */
    private __validateValue(): void {
        if (this._viewportSize < 0) {
            this._viewportSize = 0;
        }
        
        if (this._scrollPosition + this._viewportSize > this._scrollSize) {
            this._scrollPosition = this._scrollSize - this._viewportSize;
        }

        if (this._scrollPosition < 0) {
            this._scrollPosition = 0;
        }
    }

    /**
     * @description Generates a standard scroll event based on a previous 
     * scrollable status.
     * @param prev The previous scrollable status.
     * @returns A standard scroll event.
     */
    private __createScrollEvent(prev: Scrollable): IScrollEvent {
		
        return {
            prevScrollSize: prev._scrollSize,
            scrollSize: this._scrollSize,

            prevScrollPosition: prev._scrollPosition,
            scrollPosition: this._scrollPosition,

            delta: prev._scrollPosition - this._scrollPosition,

            prevViewportSize: prev._viewportSize,
            viewportSize: this._viewportSize
		};
	}

    private __fireOnDidScroll(prev: Scrollable): void {
        // this `Scrollable` only for the internal usage, safe to untrack.
        untrackDisposable(prev);
        this._onDidScroll.fire(this.__createScrollEvent(prev));
    }
}
