import { Time } from "src/base/common/date";

/**
 * Options for configuring {@link createFinalizationRegistry}.
 */
export interface IFinalizationRegistryOptions<T> {
    
    /**
     * Callback function triggered immediately when a registered object is 
     * garbage collected. Receives the held value associated with the collected 
     * object.
     *
     * @param heldValue The held value associated with the garbage-collected object.
     */
    onGarbageCollectedImmediate?: (heldValue: T) => void;

    /**
     * Defines the interval for invoking the {@link onGarbageCollectedInterval}.
     * If not provided, a default interval of `5000` milliseconds will be used.
     */
    readonly internalTime?: Time;

    /**
     * Callback function triggered at regular intervals, providing an array of 
     * held values associated with objects that have been garbage collected 
     * since the last interval.
     *
     * @param heldValue An array of held values associated with garbage-collected objects.
     */
    onGarbageCollectedInterval?: (heldValue: T[]) => void;
}

/**
 * Creates a {@link FinalizationRegistry} for tracking objects and executing 
 * callbacks when these objects are garbage collected.
 * 
 * The registry:
 *  1. invokes the immediate callback when a single object is collected, and 
 *  2. periodically invokes the interval callback with all held values.
 *
 * @example
 * // Create a finalization registry with immediate and interval callbacks
 * const registry = createFinalizationRegistry({
 *   onGarbageCollectedImmediate: (value) => console.log("Collected:", value),
 *   internalTime: new Time(5000),
 *   onGarbageCollectedInterval: (values) => console.log("Collected values:", values)
 * });
 *
 * // Register an object with the registry. When `obj` is collected, "someValue" will be passed into the callbacks.
 * registry.register(obj, "someValue");
 */
export function createFinalizationRegistry<T>(opts: IFinalizationRegistryOptions<T>): FinalizationRegistry<T> {
    let cached: T[] | undefined = undefined;
    
    if (opts.onGarbageCollectedInterval) {
        cached = [];
        
        setInterval(() => {
            if (!cached || cached.length === 0) {
                return;
            }
            opts.onGarbageCollectedInterval?.(cached);
            cached.length = 0;
        }, opts.internalTime?.toMs().time ?? 5000);
    }

    return new FinalizationRegistry((held: T) => {
        opts.onGarbageCollectedImmediate?.(held);
        
        if (cached) {
            cached.push(held);
        }
    });
}
