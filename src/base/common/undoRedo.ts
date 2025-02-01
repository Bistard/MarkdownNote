import { mixin } from "src/base/common/utilities/object";

export interface IChange<T> {
    readonly old: T;
    readonly new: T;
}

/**
 * Represents the result of a batch operation, categorizing the outcomes into 
 * successful and failed items.
 */
export interface IBatchResult<T, E = unknown> {
    readonly passed: T[];
    readonly failed: T[];
    readonly failedError: E[];
}

export function createBatchResult<T, E = unknown>(batch: Partial<IBatchResult<T, E>>): IBatchResult<T, E> {
    return  mixin({
        failed: [],
        passed: [],
        failedError: [],
    }, batch, { overwrite: true });
}