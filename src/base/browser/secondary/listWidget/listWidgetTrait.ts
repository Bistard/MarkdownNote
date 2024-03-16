import { IListViewRenderer, RendererType } from "src/base/browser/secondary/listView/listRenderer";
import { IDisposable } from "src/base/common/dispose";
import { Emitter } from "src/base/common/event";
import { Arrays } from "src/base/common/utilities/array";
import { hash } from "src/base/common/utilities/hash";

/**
 * The index changed in {@link ListTrait}.
 */
export interface ITraitChangeEvent {

    /** The new indices with the corresponding trait. */
    indice: number[];
}

/**
 * @internal
 * @class A {@link ListTrait} implements a set of methods for toggling one type 
 * of the characteristic of items in {@link ListWidget}, such as item selecting
 * and focusing.
 * 
 * @implements
 * Each {@link ListTrait} binds to a {@link ListTraitRenderer} so that the trait
 * can control the behaviours of when to render the trait manually.
 */
export class ListTrait<T> implements IDisposable {

    // [field]

    /** A trait is a string that represents an CSS class. */
    public readonly traitID: string;
    public readonly renderer: ListTraitRenderer<T>;

    private readonly _onDidChange = new Emitter<ITraitChangeEvent>();
    public readonly onDidChange = this._onDidChange.registerListener;

    /**
     * Storing all the indice of the elements who has this trait.
     */
    private _indice: number[];
    private _queryCache?: Set<number>;

    // [constructor]

    constructor(trait: string) {
        this.traitID = trait;
        this.renderer = new ListTraitRenderer(this);
        this._indice = [];
    }

    // [public method]

    /**
     * @description Sets the given items with the current trait.
     * @param indice The indice of the items.
     * @param fire If fires the onDidChange event.
     */
    public set(indice: number[], fire: boolean = true): void {
        const oldIndice = this._indice;
        this._indice = indice;
        this._queryCache = undefined;

        const toUnrender = Arrays.relativeComplement(indice, oldIndice);
        const toRender = Arrays.relativeComplement(oldIndice, indice);

        /**
         * Since the trait is manually `set` by the client. We need to trigger
         * the rendering update manually.
         */
        this.renderer.manuallyUpdateCurrElementsBy(toUnrender, element => {
            element.classList.toggle(this.traitID, false);
        });
        
        this.renderer.manuallyUpdateCurrElementsBy(toRender, element => {
            element.classList.toggle(this.traitID, true);
        });

        if (fire) {
            this._onDidChange.fire({ indice });
        }
    }

    /**
     * @description Returns how many items has such trait.
     */
    public size(): number {
        return this._indice.length;
    }

    /**
     * @description Returns all the indice of items with the current trait.
     */
    public items(): number[] {
        return this._indice;
    }

    /**
     * @description Determines if the item with the given index has the current
     * trait.
     * @param index The index of the item.
     */
    public has(index: number): boolean {
        if (!this._queryCache) {
            this._queryCache = new Set();
            this._indice.forEach(index => this._queryCache!.add(index));
        }
        return this._queryCache.has(index);
    }

    /**
     * @description Since each splice operation occurs in the {@link ListWidget}
     * might affects the existed traits (for example deleting the items that
     * has a trait or causes the location change of the existed traits). Trait
     * needs to react to the splice operation.
     */
    public splice(index: number, deleteCount: number, ifReInserted: readonly boolean[]): void {

        const insertOffset = ifReInserted.length - deleteCount;
        const deleteStart = index;
        const deleteEnd = index + deleteCount;

        const sortedIndice: number[] = [];
        
        // all the existed traits before the splice should not change
        for (const idx of this._indice) {
            if (idx < deleteStart) {
                sortedIndice.push(idx);
            }
        }

        // push each inserted index that has the trait
        for (let i = 0; i < ifReInserted.length; i++) {
            if (ifReInserted[i] === true) {
                sortedIndice.push(index + i);
            }
        }

        // all the existed traits after the splice should update with offset
        for (const idx of this._indice) {
            if (idx >= deleteEnd) {
                sortedIndice.push(idx + insertOffset);
            }
        }

        this.set(sortedIndice);
    }

    /**
     * @description All the listeners will be removed and indice will be reset.
     */
    public dispose(): void {
        this._onDidChange.dispose();
        this._indice = [];
    }
}

/**
 * Represent the element that is already rendered under the corresponding trait.
 */
type IListRenderedElement<T> = {
    readonly metadata: T;
    index: number;
};

/**
 * @class A type of {@link IListViewRenderer} for rendering {@link ListTrait}.
 */
export class ListTraitRenderer<T> implements IListViewRenderer<T, HTMLElement> {

    // [fields]

    public readonly type: RendererType;
    
    /**
     * The reason the renderer needs to bind to the corresponding {@link ListTrait}
     * is because the view component cannot aware of the changes of the updatest
     * traits that might be changed by the splicing operation.
     * 
     * To solve this, the `update` function of the renderer will ask for the
     * corresponding {@link ListTrait} if the current node still requires marked
     * as a trait.
     */
    private readonly _trait: ListTrait<T>;
    
    /**
     * Stores all the currently rendered elements.
     */
    private _currRendered: IListRenderedElement<HTMLElement>[] = [];

    // [constructor]

    constructor(trait: ListTrait<T>) {
        this._trait = trait;
        this.type = hash(trait.traitID);
    }

    // [public methods]

    public render(element: HTMLElement): HTMLElement {
        return element;
    }

    public update(item: T, index: number, data: HTMLElement, size?: number): void {
        const renderedBefore = this._currRendered.find(rendered => rendered.metadata === data);
        
        // this data was rendered before, update its current idx.
        if (renderedBefore) {
            renderedBefore.index = index;
        } 
        // rendered for the 1st time
        else {
            this._currRendered.push({ metadata: data, index: index });
        }

        // If the updating item has the trait, we update with the trait.
        data.classList.toggle(this._trait.traitID, this._trait.has(index));
    }

    public splice(index: number, deleteCount: number, insertCount: number): void {
        const rendered: IListRenderedElement<HTMLElement>[] = [];

        const start = index;
        const end = start + deleteCount;

        for (const existedRendered of this._currRendered) {
            if (existedRendered.index < start) {
                rendered.push(existedRendered);
            }
            else if (existedRendered.index >= end) {
                rendered.push({
                    metadata: existedRendered.metadata,
                    index: existedRendered.index + insertCount - deleteCount,
                });
            }
        }

        this._currRendered = rendered;
    }

    /**
     * @description Invoking this function to manually update the already 
     * rendered trait. If the index in the provided `indice` is not rendered 
     * yet, it will be ignored.
     * 
     * @param indice The indice you want to update.
     * @param onRender The callback when there are matching index.
     */
    public manuallyUpdateCurrElementsBy(indice: number[], onRender: (element: HTMLElement, index: number) => void): void {
        for (const { metadata, index } of this._currRendered) {
            if (Arrays.exist(indice, index)) {
                onRender(metadata, index);
            }
        }
    }

    public dispose(element: HTMLElement): void {
        // noop
    }
}