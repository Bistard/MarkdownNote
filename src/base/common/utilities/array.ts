import { panic } from "src/base/common/result";
import { CompareOrder, NonUndefined } from "src/base/common/utilities/type";

/**
 * @namespace Array A series of helper functions that relates to array.
 */
export namespace Arrays {

    /**
     * @description Clear an array.
     * @returns Returns the same array.
     */
    export function clear<T>(array: T[]): T[] {
        array.length = 0;
        return array;
    }

    /**
     * @description Swap element at index1 with element at index2.
     * @returns Returns the same array.
     */
    export function swap<T>(array: T[], index1: number, index2: number): T[] {
        const item1 = array[index1];
        const item2 = array[index2];

        if (item1 === undefined || item2 === undefined) {
            return array;
        }

        array[index1] = item2;
        array[index2] = item1;

        return array;
    }

    /**
     * @description Whether the given value exsits in the given array.
     */
    export function exist<T>(array: ReadonlyArray<T>, value: T): boolean {
        return array.indexOf(value) >= 0;
    }

    /**
     * @description Returns the last element of an array.
     * @param array The array.
     * @param n Which element from the end (default is zero).
     */
    export function tail<T>(array: T[], n: number = 0): T {
        return array[array.length - (1 + n)]!;
    }

    /**
     * @description Fills an array with data with n times.
     * @param data The data to be filled.
     * @param size The size of the array.
     * @returns Returns the same array.
     */
    export function fill<T>(data: T, size: number): T[] {
        return Array(size).fill(data);
    }

    /**
     * @description Returns a new elements of an array that removed all the 
     * falsy elements.
     * @param array The given array.
     * @returns Returns the same array.
     */
    export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
        return <T[]>array.filter(e => !!e);
    }

    /**
     * @description Try to removes the first given item from the given array (
     * will mutate the original array).
     * @param array The given array.
     * @param item The item to be removed.
     * @param index The optional index of the removing item in the target array.
     *              When the index is provided, the provided item doesn't matter.
     * @returns Returns the same array.
     */
    export function remove<T>(array: T[], item: T, index?: number): T[] {
        const find = index ?? array.indexOf(item);
        if (find !== -1) {
            array.splice(find, 1);
        }
        return array;
    }

    /**
     * @description Removes elements from an array at the specified indice. The 
     * original array is mutated.
     * 
     * @param array The given array.
     * @param indice An array of indice at which elements should be removed. 
     *               Indices do not need to be in any particular order.
     * @returns Returns the same array.
     */
    export function removeByIndex<T>(array: T[], indice: number[]): T[] {
        
        // Sort the indexes in descending order
        indice = indice.sort((a, b) => b - a);

        for (const index of indice) {
            if (index >= 0 && index < array.length) {
                array.splice(index, 1);
            }
        }

        return array;
    }

    /**
     * @description Reversely iterate the given array.
     * @param array The given array.
     * @param each The visit callback for each element in array. Returns true to
     *             break the iteration.
     * @returns Returns the same array.
     */
    export function reverseIterate<T>(array: T[], each: (element: T, index: number) => boolean | void | undefined): T[] {
        for (let idx = array.length - 1; idx >= 0; idx--) {
            if (each(array[idx]!, idx) === true) {
                break;
            }
        }
        return array;
    }

    /**
     * @description Inserts the given item into the sorted array while 
     * maintaining its sorted order. The original array is mutated.
     * @param sorted The sorted array.
     * @param toInsert The item to be inserted.
     * @param cmp The compare function used to determine the sort order.
     *             Returns true if `a` is before `b`, false otherwise.
     * @returns Returns the same array.
     */
    export function insertSorted<T>(sorted: T[], toInsert: T, cmp: (a: T, b: T) => boolean = (a, b) => a < b): T[] {
        if (sorted.length === 0) {
            sorted.push(toInsert);
            return sorted;
        }

        let i = 0;
        for (i = 0; i < sorted.length; i++) {
            const currItem = sorted[i]!;

            if (cmp(toInsert, currItem)) {
                sorted.splice(i, 0, toInsert);
                return sorted;
            }
        }

        sorted.splice(i, 0, toInsert);
        return sorted;
    }

    /**
     * @description Inserts the specified elements into an array at the given 
     * index, modifying the original array.
     * 
     * @param array The given array be inserted.
     * @param index The index at which the new elements should be inserted. If 
     *              the index is negative, the elements will be inserted from 
     *              the end of the array.
     * @param elements The elements to be inserted.
     * @returns Returns the same array.
     * 
     * @example
     * ```ts
     * // Inserts elements [4, 5] at index 2 in array [1, 2, 3]
     * insertSequence([1, 2, 3], 2, [4, 5]); // => [1, 2, 4, 5, 3]
     * ```
     */
    export function insertSequence<T>(array: T[], index: number, elements: T[]): T[] {
        const startIdx = __getActualStartIndex(array, index);
        const originalLength = array.length;
        const newItemsLength = elements.length;
        array.length = originalLength + newItemsLength;
        
        for (let i = originalLength - 1; i >= startIdx; i--) {
            array[i + newItemsLength] = array[i]!;
        }
    
        for (let i = 0; i < newItemsLength; i++) {
            array[i + startIdx] = elements[i]!;
        }

        return array;
    }

    /**
     * @description Determines if the content of the given two arrays are equal.
     * The order does matter.
     * @param array1 The given 1st array.
     * @param array2 The given 2nd array.
     * @param cmp The compare function.
     * 
     * @note If you need to deep compare elements, pass `strictEquals` as cmp.
     */
    export function exactEquals<T>(array1: ReadonlyArray<T>, array2: ReadonlyArray<T>, cmp: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
        if (array1 === array2) {
            return true;
        }

        if (array1.length !== array2.length) {
            return false;
        }

        for (let i = 0, len = array1.length; i < len; i++) {
            if (cmp(array1[i]!, array2[i]!) === false) {
                return false;
            }
        }
    
        return true;
    }

    /**
     * @description Creates a new number array that contains numbers from begin
     * to end.
     * @param begin The begin of the array number (inclusive).
     * @param end The end of the array number (exclusive).
     * @returns The new created array.
     */
    export function range(begin: number, end: number): number[] {
        const arr: number[] = [];

        let i: number;
        if (begin <= end) {
            for (i = begin; i < end; i++) {
                arr.push(i);
            }
        } else {
            for (i = begin; i > end; i--) {
                arr.push(i);
            }
        }

        return arr;
    }

    /**
     * @description Returns the union (OR) of the two given arrays.
     * @param array1 The given first array.
     * @param array2 The given second array.
     * @param valueFn The function to decide how the items to be determined for equality.
     * @returns The new created array.
     * 
     * @note The returned union array will remove all the unique items.
     * @complexity O(n + m)
     */
    export function union<T>(array1: ReadonlyArray<T>, array2: ReadonlyArray<T>, valueFn: (value: T) => any = value => value): T[] {
        const union: T[] = [];
        const visited = new Set<T>();
        
        const each = (item: T): void => {
            const value = valueFn(item);

            if (visited.has(value)) {
                return;
            }

            union.push(value);
            visited.add(value);
        };

        array1.forEach(item => each(item));
        array2.forEach(item => each(item));

        return union;
    }

    /**
     * @description Returns the intersection (AND) of the two given arrays.
     * @param array1 The given first array.
     * @param array2 The given second array.
     * @param valueFn The function to decide how the items to be determined for equality.
     * @returns The new created array.
     * 
     * @note The returned union array will remove all the unique items.
     * @complexity O(n + m)
     */
    export function intersection<T>(array1: ReadonlyArray<T>, array2: ReadonlyArray<T>, valueFn: (value: T) => any = value => value): T[] {
        array1 = Arrays.unique(array1, valueFn);
        array2 = Arrays.unique(array2, valueFn);
        
        const intersection: T[] = [];
        const visited = new Set<T>();
        
        const each = (item: T): void => {
            const value = valueFn(item);

            if (visited.has(value)) {
                intersection.push(value);
                return;
            }

            visited.add(value);
        };

        array1.forEach(item => each(item));
        array2.forEach(item => each(item));

        return intersection;
    }

    /**
     * @description Returns the exclusive disjunction (XOR) of the given two arrays.
     * @param array1 The given first array.
     * @param array2 The given second array.
     * @param valueFn The function to decide how the items to be determined for equality.
     * @returns The new created array.
     * 
     * @note The returned union array will remove all the unique items.
     * @complexity O(n + m)
     */
    export function disjunction<T>(array1: ReadonlyArray<T>, array2: ReadonlyArray<T>, valueFn: (value: T) => any = value => value): T[] {
        array1 = Arrays.unique(array1, valueFn);
        array2 = Arrays.unique(array2, valueFn);
        
        const visitedOnce = new Set<any>();
        const visitedOnceItems = new Map<any, T>();
        
        const visited = new Set<any>();
        
        const each = (item: T): void => {
            const value = valueFn(item);

            if (visited.has(value)) {
                visitedOnce.delete(value);
                visitedOnceItems.delete(value);
                return;
            }

            visitedOnce.add(value);
            visitedOnceItems.set(value, item);
            visited.add(value);
        };

        array1.forEach(item => each(item));
        array2.forEach(item => each(item));

        const disjunction: T[] = [];
        visitedOnceItems.forEach((value, item) => disjunction.push(item));

        return disjunction;
    }

    /**
     * @description Returns the relative complement (') of the 1st array respect 
     * to the 2nd array, which is the array contains items in the 2nd one but 
     * not in the 1st one.
     * @param array1 The given first array.
     * @param array2 The given second array.
     * @param valueFn The function to decide how the items to be determined for equality.
     * @returns The new created array.
     * 
     * @note The returned union array will remove all the unique items.
     * @complexity O(n + m)
     */
    export function relativeComplement<T>(array1: ReadonlyArray<T>, array2: ReadonlyArray<T>, valueFn: (value: T) => any = value => value): T[] {
        array1 = Arrays.unique(array1, valueFn);
        array2 = Arrays.unique(array2, valueFn);

        const array1Visited = new Set<any>();

        for (const item of array1) {
            const value = valueFn(item);
            array1Visited.add(value);
        }

        const complement: T[] = [];
        const visited = new Set<any>();

        for (const item of array2) {
            const value = valueFn(item);
            
            if (array1Visited.has(value) || visited.has(value)) {
                continue;
            }

            complement.push(item);
            visited.add(value);
        }

        return complement;
    }

    /**
     * @description Removes the duplicate items in the given array.
     * @param array The given array.
     * @param valueFn The function to decide how the items to be determined for equality.
     * @returns The new created array.
     * 
     * @complexity O(n)
     */
    export function unique<T>(array: ReadonlyArray<T>, valueFn: (value: T) => any = value => value): T[] {
        const visited = new Set<T>();

        return array.filter(item => {
            const value = valueFn(item);
            
            if (visited.has(value)) {
                return false;
            }

            visited.add(value);
            return true;
        });
    }

    /**
     * @description If the given array includes any values that matches any of 
     * the provided values.
     * @param array The given array.
     * @param values The provided values.
     * @param match A compare function.
     */
    export function matchAny<T>(array: ReadonlyArray<T>, values: T[], match: (arrValue: T, yourValue: T) => boolean = (arrVal, yourVal) => arrVal === yourVal): boolean {
        for (const yourValue of values) {
            for (const arrValue of array) {
                if (match(arrValue, yourValue)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @description Whether the given array matches all values from the provided 
     * array.
     * @param array The given array.
     * @param values The provided values.
     * @param match A compare function.
     */
    export function matchAll<T>(array: ReadonlyArray<T>, values: T[], match: (arrValue: T, yourValue: T) => boolean = (arrVal, yourVal) => arrVal === yourVal): boolean {
        for (const yourValue of values) {
            let matched =  false;
            for (const arrValue of array) {
                if (match(arrValue, yourValue)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                return false;
            }
        }
        return true;
    }

    /**
     * @description Apply a binary search on the given array.
     * @param array The given array.
     * @param match A callback function that will apply to all the possible 
     * items in the array. Returns a number to indicate if the item is too left 
     * or too right. A negative value indicates the item is too left. A positive
     * value indicates the item is too right.
     * @returns The found item or undefined if not found.
     */
    export function binarySearch<T extends NonUndefined>(array: ReadonlyArray<T>, match: (value: T) => CompareOrder): T | undefined {

        let l = -1;
        let r = array.length;

        while (l + 1 < r) {
            const m = ((l + r) / 2) | 0;
            const value = array[m]!;
            const result = match(value);

            if (result === 0) {
                return value;
            }

            if (result < 0) {
                l = m;
            } else {
                r = m;
            }
        }

        return undefined;
    }

    /**
     * @description Converts an iterable to an array. If a converter function is 
     * provided, it applies the function to each item of the iterable before adding 
     * it to the resulting array.
     * 
     * @param iterable The iterable to convert to an array.
     * @param converter Converts each item of the iterable from type `T1` to 
     *                  type `T2`.
     * @returns An array of elements.
     */
    export function fromIterable<T>(iterable: Iterable<T>): T[];
    export function fromIterable<T1, T2>(iterable: Iterable<T1>, converter: (item: T1) => T2): T2[];
    export function fromIterable<T1, T2>(iterable: Iterable<any>, converter?: (item: T1) => T2): T2[] {
        if (!converter) {
            return Array.from(iterable);
        }
        return Array.from(iterable, item => converter(item));
    }

    /**
     * @description Converts a Set to an array. If a converter function is 
     * provided, it applies the function to each item of the set before adding 
     * it to the resulting array.
     * 
     * @param set The set to convert to an array.
     * @param converter Converts each item of the set from type `T1` to type `T2`.
     * @returns An array of elements.
     */
    export function fromSet<T>(set: Set<T>): T[];
    export function fromSet<T1, T2>(set: Set<T1>, converter: (item: T1) => T2): T2[];
    export function fromSet<T1, T2>(set: Set<any>, converter?: (item: T1) => T2): T2[] {
        if (!converter) {
            return [...set];
        }

        const arr: T2[] = [];
        for (const item of set) {
            arr.push(converter(item));
        }

        return arr;
    }

    /**
     * @description Converts a Map's entries to an array of values based on the 
     * provided converter function.
     * 
     * @param map The Map to convert to an array.
     * @param converter A converter function.
     * @returns An array of elements produced by applying the converter.
     */
    export function fromMap<K, V, T>(map: Map<K, V>, converter: (value: V, key: K) => T): T[] {
        const arr: T[] = [];
        for (const [key, value] of map) {
            arr.push(converter(value, key));
        }
        return arr;
    }

    /**
     * @description Converts the keys of an object into an array.
     * @param obj The object whose keys are to be converted into an array.
     * @returns An array of the object's keys.
     */
    export function fromObjectKeys<T extends object>(obj: T): (keyof T)[] {
        return Object.keys(obj) as (keyof T)[];
    }

    /**
     * @description Converts the values of an object into an array.
     * @param obj The object whose values are to be converted into an array.
     * @returns An array of the object's values.
     */
    export function fromObjectValues<T>(obj: Record<string, T>): T[] {
        return Object.values(obj);
    }

    /**
     * @description Converts the entries (key-value pairs) of an object into an
     * array of tuples.
     * @param obj The object whose entries are to be converted into an array of 
     *            tuples.
     * @returns An array of tuples, where each tuple is a [key, value] pair from 
     *          the object.
     */
    export function fromObjectEntries<T>(obj: Record<string, T>): [string, T][] {
        return Object.entries(obj);
    }
}

function __getActualStartIndex<T>(array: T[], index: number): number {
    if (index < 0) {
        return Math.max(index + array.length, 0);
    } else {
        return Math.min(index, array.length);
    }
}