import { Time } from "src/base/common/date";
import { Disposable, IDisposable } from "src/base/common/dispose";
import { CancellationError } from "src/base/common/error";
import { Emitter, Register } from "src/base/common/event";
import { noop } from "src/base/common/performance";
import { CancellationToken, ICancellable } from "src/base/common/utilities/cancellation";
import { panic } from "src/base/common/utilities/panic";
import { isNullable } from "src/base/common/utilities/type";

/**
 * @function {@link repeat} 
 * @function {@link delayFor} 
 * @class    {@link OngoingPromise}
 * @class    {@link JoinablePromise}
 * @class 	 {@link CancellablePromise}
 * @function {@link cancellableTimeout}
 * @function {@link retry}
 * @class	 {@link Blocker}
 * @class	 {@link EventBlocker}
 * @class	 {@link TimeoutPromise}
 * @class	 {@link AsyncRunner}
 * @class	 {@link AsyncQueue}
 * @class	 {@link Scheduler}
 * @class	 {@link UnbufferedScheduler}
 * @class	 {@link Throttler}
 * @class	 {@link Debouncer}
 * @class	 {@link ThrottleDebouncer}
 * @class	 {@link IntervalTimer}
 */

export interface ITask<T> {
	(...args: any[]): T; // any functions that returns `T`
}

export type IAsyncTask<T> = ITask<Promise<T>>;

/**
 * @description Runs the given callback a certain number of times.
 * @param round The number of times to run the callback.
 * @param fn The callback function to run, provided with the current iteration 
 * 			 index.
 */
export function repeat(round: number, fn: (index: number) => void): void {
    let i: number;
    for (i = 0; i < round; i++) {
        fn(i);
    }
}

/**
 * @description Delays for given milliseconds. It will immediately create a 
 * async task that runs in the javascript task queue by using setTimeout.
 * @param time Time for delay.
 * @param callback Callback function after the waiting ends.
 */
export async function delayFor(time: Time, callback?: ITask<void>): Promise<void> {
    return new Promise(
		(resolve, reject) => setTimeout(() => {
			try {
				callback?.();
			} catch (error) {
				reject();
			}
			resolve();
		}, time.toMs().time)
	);
}

/**
 * @class Ensures that only one promise task is executed at a time.
 */
export class OngoingPromise<T> {
    
	private _task?: Promise<T>;
	constructor() {}

    /**
     * @description Executes the task if it's not already pending. If a task is 
	 * already pending, returns the pending task.
     * 
     * @param taskFn A function that returns a promise.
     * @returns The promise of the task.
     */
    public execute(taskFn: () => Promise<T>): Promise<T> {
        if (!this._task) {
            this._task = taskFn().finally(() => {
                this._task = undefined;
            });
        }
        return this._task;
    }

    /**
     * @description Checks if a task is currently pending.
     */
    public isPending(): boolean {
        return !!this._task;
    }
}

/**
 * @class Represents a collection of promises that can be managed and settled as 
 * a group. This provides a structured way to join individual promises together 
 * and handle their settled results in a collective manner.
 * 
 * @example
 * const joinable = new JoinablePromise();
 * joinable.join(someAsyncFunction());
 * joinable.join(anotherAsyncFunction());
 * const results = await joinable.allSettled();
 * 
 * results.forEach(result => {
 *   if (result.status === 'fulfilled') {
 *     // Handle fulfilled promise
 *   } else {
 *     // Handle rejected promise
 *   }
 * });
 */
export class JoinablePromise {

	// [fields]

	private readonly _participants: PromiseLike<any>[];

	// [constructor]

	constructor() {
		this._participants = [];
	}

	// [public methods]

	public join(participant: PromiseLike<any>): this {
		this._participants.push(participant);
		return this;
	}

	/**
	 * @description Creates a Promise that is resolved with an array of results 
	 * when all of the provided Promises resolve or reject.
	 * @note This method never rejects.
	 */
	public async allSettled(): Promise<PromiseSettledResult<any>[]> {
		return Promise.allSettled(this._participants);
	}

	/**
	 * @description Creates a Promise that is resolved with an array of results 
	 * when all of the provided Promises resolve, or rejected when any Promise 
	 * is rejected.
	 * @returns 
	 */
	public async all(): Promise<any[]> {
		return Promise.all(this._participants);
	}
}

/**
 * @class A class that simulates the native behaviors of {@link Promise} but 
 * with an additional {@link CancellationToken}. You may decide the control flow
 * by the token. If the token is cancelled, the corresponding cancellable 
 * promise will reject with an {@link CancellationError}.
 */
export class CancellablePromise<T> implements Promise<T>, ICancellable {

	// [field]

	private readonly _token: CancellationToken;
	private readonly _promise: Promise<T>;

	// [constructor]

	constructor(callback: (token: CancellationToken) => Promise<T>, token?: CancellationToken) {
	
		this._token = token ?? new CancellationToken();
		const thenable = callback(this._token);

		this._promise = new Promise((resolve, reject) => {
			
			const tokenListener = this._token.onDidCancel(() => {
				tokenListener.dispose();
				this._token.dispose();
				reject(new CancellationError());
			});
			
			const onResolve = (value: T) => {
				tokenListener.dispose();
				this._token.dispose();
				resolve(value);
			};

			const onReject = (error: any) => {
				tokenListener.dispose();
				this._token.dispose();
				reject(error);
			};

			// catch the callback if the token is already cancelled
			thenable
			.then((value) => {
				if (this._token.isCancelled()) {
					onReject(new CancellationError());
				} else {
					onResolve(value);
				}
			})
			.catch((err) => onReject(err));
		});
	}

	// [public methods]

	public then<TResult1 = T, TResult2 = never>(resolve? :(value: T) => TResult1 | PromiseLike<TResult1>, reject?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2> {
		return this._promise.then(resolve, reject);
	}

	public catch<TResult = never>(reject?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult> {
		return this._promise.catch(reject);
	}

	public finally(onfinally?: () => void): Promise<T> {
		return this._promise.finally(onfinally);
	}

	public cancel(): void {
		this._token.cancel();
	}

	get [Symbol.toStringTag]() {
		return 'Promise';
	}
}

/**
 * @description Returns a {@link Promise} that resolves on the given ms, it can 
 * be cancelled by the given token. Returns a {@link CancellablePromise} if
 * no token is given which the client may cancel manually.
 * @param Time timeout time.
 * @param token The cancellation token binds to the promise if provided.
 */
export function cancellableTimeout(time: Time): CancellablePromise<void>;
export function cancellableTimeout(time: Time, token: CancellationToken): Promise<void>;
export function cancellableTimeout(time: Time, token?: CancellationToken): CancellablePromise<void> | Promise<void> {
	if (!token) {
		return new CancellablePromise((token) => cancellableTimeout(time, token));
	}
	
	return new Promise((resolve, reject) => {

		const handle = setTimeout(() => {
			tokenListener.dispose();
			resolve();
		}, time.toMs().time);

		const tokenListener = token.onDidCancel(() => {
			clearTimeout(handle);
			tokenListener.dispose();
			reject(new CancellationError());
		});
	});
}

/**
 * @description Helper functions for retrying a given task for given retry rounds.
 * @param task Task function.
 * @param delay Delay ms between each retry.
 * @param round Retry rounds.
 * @throws An exception will be thrown after all the retry rounds are finished 
 * if one of the round throws an error (if multiple fails, the last error will 
 * be thrown).
 */
export async function retry<T>(task: IAsyncTask<T>, delay: Time, round: number = 1): Promise<T> {
	let lastError: Error | unknown;

	for (let i = 0; i < round; i++) {
        try {
            // try to finish the task.
			return await task();
		}
        catch (error) {
            // if not, we delay for a while and will retry the task.
			lastError = error;
			await delayFor(delay);
		}
	}

	panic(lastError);
}

/**
 * @class Acts like a promise by calling {@link Blocker.waiting()} to wait a 
 * data with type T. The only difference is client may signals the blocker to 
 * resolve or reject manually.
 */
export class Blocker<T> {

	private _resolve!: (arg: T) => void;
	private _reject!: (reason?: any) => void;
	private _promise: Promise<T>;

	constructor() {
		this._promise = new Promise<T>((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	public async waiting(): Promise<T> {
		return this._promise;
	}

	public resolve(data: T): void {
		this._resolve(data);
	}

	public reject(reason?: any): void {
		this._reject(reason);
	}
}

/**
 * @class A {@link EventBlocker} registers the provided event register for one 
 * time only and convert it into a promise so that it can be listened in an 
 * asynchronous way instead of direct listening to the event.
 * 
 * You may pass a timeout to reject the promise if the event never fired after 
 * the timeout.
 */
export class EventBlocker<T> {

	private readonly _blocker = new Blocker<T>();
	private _listener: IDisposable;
	private _fired = false;
	private _timeout?: NodeJS.Timeout;
	
	constructor(register: Register<T>, time?: Time) {
		// one time only listener
		this._listener = register((event) => {
			this._fired = true;
			this._listener.dispose();

			if (this._timeout) {
				clearTimeout(this._timeout);
				this._timeout = undefined;
			}

			this._blocker.resolve(event);
		});

		if (time) {
			this._timeout = setTimeout(() => {
				if (!this._fired) {
					this._blocker.reject(new Error('EventBlocker timeout'));
				}
			}, time.toMs().time);
		}
	}

	public async waiting(): Promise<T> {
		return this._blocker.waiting();
	}

	public dispose(): void {
		if (!this._fired) {
			this._listener.dispose();
		}
	}
}

/**
 * @class Represents a promise that may timeout after a certain duration.
 * @template T The type of the return value of the promise.
 * 
 * @note An alternative choice is `Promise.race`.
 * 
 * @example
 * const longRunningPromise = new Promise((resolve) => {
 *     setTimeout(() => resolve('Hello World'), 3000);
 * });
 * 
 * const timeoutPromise = new TimeoutPromise(longRunningPromise, 2000);
 * 
 * timeoutPromise.waiting()
 *   .then(console.log)
 *   .catch(err => console.error('Promise timed out'));
 */
export class TimeoutPromise<T> {
	
	private _blocker = new Blocker<T>();
	private _timeout = false;

	constructor(promise: Promise<T>, timeout: Time) {
		const token = setTimeout(() => {
			this._timeout = true;
			this._blocker.reject(new Error('Promise is timeout'));
		}, timeout.toMs().time);
		
		promise
		.then((result) => {
			if (!this._timeout) {
				clearTimeout(token);
				this._blocker.resolve(result);
			}
		})
		.catch(err => {
			if (!this._timeout) {
				clearTimeout(token);
				this._blocker.reject(err);
			}
		});
	}

	public waiting(): Promise<T> {
		return this._blocker.waiting();
	}
}

/**
 * An interface for {@link AsyncRunner}.
 */
export interface IAsyncRunner<T> extends Disposable {
	
	/**
	 * The total number of promises that are either being waiting or executing.
	 */
	readonly size: number;

	/**
	 * The total number of promises that are being executing.
	 */
	readonly runningSize: number;
	
	/**
	 * The total number of promises that are being waiting.
	 */
	readonly pendingSize: number;

	/**
	 * Fires when any tasks is completed.
	 */
	readonly onDidComplete: Register<T>;
	
	/**
	 * Fires once the all the executing promises are done and no waiting promises.
	 */
	readonly onDidFlush: Register<void>;

	/**
	 * @description Queueing a function that returns a promise into the executor.
	 * @param task The task that returns a promise.
	 * @returns Returns a promise that will resolve the promise of the return 
	 * value of the {@link ITask}.
	 */
	queue(task: ITask<Promise<T>>): Promise<T>;

	/**
     * @description Dequeue the next pending promise, removing it from the queue.
     * @returns The task that was pending execution, or undefined if no tasks 
	 * 			are pending.
	 * 
	 * @note The API will not interrupt any executing tasks.
     */
	dequeue(): ITask<Promise<T>> | undefined;

	/**
	 * @description Pauses the executor (the running promises will not be paused).
	 */
	pause(): void;

	/**
	 * @description Resumes the flow of executing.
	 */
	resume(): void;

	/**
	 * @description Returns a promise that will resolve once the next queued 
	 * task is completed.
	 */
	waitNext(): Promise<void>;
}

/**
 * @class A helper tool that guarantees no more than N promises are running at 
 * the same time.
 * T: type of return value of each task.
 */
export class AsyncRunner<T> extends Disposable implements IAsyncRunner<T> {

	// [field]

	private _size: number;
	private _runningPromisesCount: number;
	private _paused: boolean;

	private readonly _limitCount: number;
	private readonly _waitingPromises: IAsyncPromiseTask<T>[];

	private readonly _onDidComplete = this.__register(new Emitter<T>());
	public readonly onDidComplete = this._onDidComplete.registerListener;

	private readonly _onDidFlush = this.__register(new Emitter<void>());
	public readonly onDidFlush = this._onDidFlush.registerListener;

	// [constructor]

	constructor(limit: number) {
		super();

		this._size = 0;
		this._runningPromisesCount = 0;
		this._paused = false;
		this._limitCount = limit;
		this._waitingPromises = [];
	}

	// [public methods]

	get size(): number {
		return this._size;
	}

	get runningSize(): number {
		return this._runningPromisesCount;
	}

	get pendingSize(): number {
		return this.size - this.runningSize;
	}

	public queue(task: ITask<Promise<T>>): Promise<T> {
		this._size++;
		return new Promise<T>((resolve, reject) => {
			this._waitingPromises.push({ task, resolve, reject });
			this.__consume();
		})
		.then(data => {
			this._onDidComplete.fire(data);
			return data;
		});
	}

	public dequeue(): ITask<Promise<T>> | undefined {
		if (this._waitingPromises.length > 0) {
            const { task } = this._waitingPromises.shift()!;
            this._size--; 

			if (this._size === 0) {
				this._onDidFlush.fire();
			}

            return task;
        }
        return undefined;
	}

	public pause(): void {
		this._paused = true;
	}

	public resume(): void {
		if (this._paused === false) {
			return;
		}
		
		this._paused = false;
		this.__consume();
	}

	public waitNext(): Promise<void> {
		return (new EventBlocker(this.onDidFlush)).waiting();
	}

	public override dispose(): void {
		super.dispose();
		this._waitingPromises.length = 0;
	}

	// [private helper methods]

	private __consume(): void {
		if (this._paused) {
			return;
		}

		while (this._waitingPromises.length > 0 && this._runningPromisesCount < this._limitCount) {
			const task = this._waitingPromises.shift()!;
			this._runningPromisesCount++;
			const taskPromise = task.task();
			
			taskPromise.then(task.resolve, task.reject);
			taskPromise.then(() => this.__consumed(), () => this.__consumed());
		}
	}

	private __consumed(): void {
		this._size--;
		this._runningPromisesCount--;

		if (this._waitingPromises.length > 0) {
			this.__consume();
		} 
		
		else if (this._size === 0) {
			this._onDidFlush.fire();
		}
	}
}

type IAsyncPromiseTask<T> = {
	task: ITask<Promise<T>>;
	resolve: (arg: T) => void;
	reject: (reason?: any) => void;
};

/**
 * @class An async queue helper that guarantees only 1 promise are running at 
 * the same time.
 * T: type of return value of each task.
 */
export class AsyncQueue<T> extends AsyncRunner<T> {
	constructor() {
		super(1);
	}
}

/**
 * An interface only for {@link Scheduler}.
 */
export interface IScheduler<T> extends IDisposable {

	/**
	 * @description Schedules the callback with the given delay and fires an 
	 * event to the callback, the event will be stored as a buffer inside the
	 * scheduler.
	 * @param event Pass the event as the parameter to the callback.
	 * @param clearBuffer If to clear the buffered event.
	 * @param delay Defaults to the delay option passed into the constructor.
	 */
	schedule(event: T, clearBuffer?: boolean, delay?: Time): void;

	/**
	 * @description Executes the callback with the existed event buffer if any.
	 */
	execute(): void;

	/**
	 * @description Determines if there is a scheduled execution.
	 */
	isScheduled(): boolean;

	/**
	 * @description Cancels the current scheduled execution if has any and 
	 * returns a boolean specifies whether the cancelation succeeded.
	 * @param clearBuffer If to cancel the previous event buffer.
	 */
	cancel(clearBuffer?: boolean): boolean;
}

/**
 * @class A `Scheduler` can schedule a new execution with the provided events on 
 * the given callback with a delay time when invoking {@link Scheduler.schedule}. 
 * The new schedule will cancel the previous schedule, the canceled event will be 
 * stored for the next scheduling.
 */
export class Scheduler<T> implements IScheduler<T> {

	private _eventBuffer: T[] = [];
	private _fn: (event: T[]) => void;
	private _delay: Time;
	private _token?: NodeJS.Timeout;

	constructor(delay: Time, fn: (event: T[]) => void) {
		this._fn = fn;
		this._delay = delay;
	}

	public schedule(event: T | T[], clearBuffer: boolean = false, delay: Time = this._delay): void {
		this.cancel(clearBuffer);
		
		if (!Array.isArray(event)) {
			event = [event];
		}
		this._eventBuffer.push(...event);

		this._token = setTimeout(() => {
			const buffer = this._eventBuffer;
			this._eventBuffer = [];
			this._fn(buffer);
		}, delay.toMs().time);
	}

	public execute(): void {
		this.cancel(false);
		const buffer = this._eventBuffer;
		this._eventBuffer = [];
		this._fn(buffer);
	}

	public cancel(clearBuffer?: boolean): boolean {
		if (clearBuffer) {
			this._eventBuffer = [];
		}

		if (!isNullable(this._token)) {
			clearTimeout(this._token);
			this._token = undefined;
			return true;
		}
		return false;
	}

	public isScheduled(): boolean {
		return !(this._token === undefined);
	}

	public dispose(): void {
		this.cancel(true);
		this._fn = noop;
	}
}

/**
 * An interface only for {@link UnbufferedScheduler}.
 */
export interface IUnbufferedScheduler<T> extends IDisposable {
	
	/**
	 * Represents the current scheduling event that is buffered and not ready 
	 * to fire. Return `undefined` when there is no waiting scheduling.
	 */
	readonly currentEvent?: T;

	/**
	 * @description Schedules the callback with the given delay and fires an 
	 * event to the callback, if a new scheduling happens before the previous
	 * scheduling, the previous scheduled event will be forget.
	 * @param event Pass the event as the parameter to the callback.
	 * @param delay Defaults to the delay option passed into the constructor.
	 */
	schedule(event: T, delay?: Time): void;

	/**
	 * @description Determines if there is a scheduled execution.
	 */
	isScheduled(): boolean;

	/**
	 * @description Cancels the current scheduled execution if has any and 
	 * returns a boolean specifies whether the cancelation succeeded.
	 */
	cancel(): boolean;
}

/**
 * @class The only difference compares to {@link Scheduler} is that, it does not
 * store the previous scheduled events into buffer. Only one event will be 
 * scheduled at a time.
 * @note Call schedule() first after new a UnbufferedScheduler to launch the
 * setTimeout
 */
export class UnbufferedScheduler<T> implements IUnbufferedScheduler<T> {

	// [fields]

	private _callback: (event: T) => void;
	private readonly _delay: Time;
	private _token?: NodeJS.Timeout;
	private _currEvent?: T;

	// [constructor]

	constructor(delay: Time, fn: (event: T) => void) {
		this._callback = fn;
		this._delay = delay;
	}

	// [getter]

	get currentEvent(): T | undefined {
		return this._currEvent;
	}

	// [public methods]

	public schedule(event: T, delay: Time = this._delay): void {
		this.cancel();
		this._currEvent = event;

		this._token = setTimeout(() => {
			this._callback(event);
			this._token = undefined;
			this._currEvent = undefined;
			
		}, delay.toMs().time);
	}

	public isScheduled(): boolean {
		return !(this._token === undefined);
	}

	public cancel(): boolean {
		if (!isNullable(this._token)) {
			clearTimeout(this._token);
			this._token = undefined;
			this._currEvent = undefined;
			return true;
		}
		return false;
	}

	public dispose(): void {
		this.cancel();
		this._callback = noop;
	}
}

/**
 * An interface only for {@link Throttler}.
 */
export interface IThrottler {
	/**
	 * @description Queues a task either runs immediately or, runs after the 
	 * current task finished if there is no new tasks is queued after.
	 * @param task A task returns a promise.
	 * @returns A promise settled once a task is executed.
	 */
	queue<T>(task: IAsyncTask<T>): Promise<T>;
}

/**
 * @class A Throttler class that efficiently manages the execution of queued tasks.
 * Tasks are managed as follows:
 * - If no task is currently running, the queued task is executed immediately.
     * - If a task is already in progress, the new task will be scheduled to run 
	 * after the current task completes.
     * - If multiple tasks are queued while a task is running, only the most 
	 * recently queued task will be executed next, discarding all previously queued tasks. 
 * 
 * It is designed for limiting actions over a set amount of time. It may prevent
 * performance goes down during a busy period.
 * 
 * @example
 * Queue Task1 								 // Task1 executes immediately.
 * Queue Task2, Task3 before Task1 completes // only Task 3 executes once Task1 completes
 * 											 // Task2 is discarded
 * 
 * @template T The type of the return value of the queued tasks.
 */
export class Throttler implements IThrottler {
	
	private _runningPromise?: Promise<any>;
	private _waitingPromise?: Promise<any>;
	private _latestTask?: IAsyncTask<any>;
	
	constructor() { /** noop */ }

	public queue<T>(newTask: IAsyncTask<T>): Promise<T> {
		
		// No running tasks, this is the first one.
		if (!this._runningPromise) {
			this._runningPromise = newTask().finally(() => this._runningPromise = undefined);
			return this._runningPromise;
		}

		// A task is running, we overwrite the prev task.
		this._latestTask = newTask;

		/**
		 * If there is no waiting task, Create a waiting task that will run 
		 * after the current task.
		 */
		this._waitingPromise ??= (async () => {
			await this._runningPromise;
			this._waitingPromise = undefined;

			const promise = this.queue(this._latestTask!);
			this._latestTask = undefined;
			
			return promise;
		})();

		return this._waitingPromise;
	}
}

type __Scheduler = IDisposable & {
	onSchedule(): boolean;
};

/** 
 * Can be passed into the {@link Debouncer.queue} to schedule using a microtask.
 */
export const MicrotaskDelay = Symbol('MicrotaskDelay');
export type DelayType = Time | typeof	MicrotaskDelay;

/**
 * An interface only for {@link Debouncer}.
 */
export interface IDebouncer<T> extends IDisposable {
	
	/**
	 * @description Queues a task and reset the timer.
	 * @param newTask The new task to be executed once the timer is up.
	 * @param delay The new delay timer.
	 * @returns A promise that settled either the task is done or the debouncer 
	 * is unscheduled.
	 */
	queue(newTask: ITask<T> | IAsyncTask<T>, delay?: DelayType): Promise<T>;

	/**
	 * @description Determines if the debouncer is currently on scheduling.
	 */
	onSchedule(): boolean;

	/**
	 * @description Unschedule the current timer if has one.
	 */
	unschedule(): void;
}

/**
 * @class A debouncer will use a global timer for every queued task. The timer 
 * will be reset once queued a new task. Only the latest queued task will be 
 * executed once the timer is up.
 * 
 * It is designed to ensure that the tasks do not fire so often.
 * 
 * @template T The type of the return value of the queued tasks.
 */
export class Debouncer<T> extends Disposable implements IDebouncer<T> {

	// [field]

	private readonly _defaultDelay: DelayType;
	private _schedule?: __Scheduler;
	private _blocker?: Blocker<T | Promise<T>>;
	private _latestTask?: ITask<T> | IAsyncTask<T>;

	// [constructor]

	constructor(defaultDelay: DelayType) {
		super();
		this._defaultDelay = defaultDelay;
	}

	// [public methods]

	public async queue(newTask: ITask<T> | IAsyncTask<T>, delay = this._defaultDelay): Promise<T> {
		
		// update the task to be executed when scheduled
		this._latestTask = newTask;
		
		// clear the previous schedule if has one
		this.__clearSchedule();

		// we need a blocker so that we can manually resolve
		if (!this._blocker) {
			this._blocker = new Blocker();
		}

		// callback when the schedule has reached
		const onSchedule = () => {
			const result = this._latestTask!();
			this._blocker?.resolve(result);

			this._latestTask = undefined;
			this._blocker = undefined;
			this._schedule = undefined;
		};

		// refresh the new schedule
		this._schedule = delay === MicrotaskDelay ? this.__scheduleAsMicrotask(onSchedule) : this.__scheduleAsTimeout(delay, onSchedule);

		// tell the client to be wait for
		return this._blocker.waiting();
	}

	public onSchedule(): boolean {
		return !!this._schedule?.onSchedule();
	}

	public unschedule(): void {
		this.__clearSchedule();
		this._blocker?.reject(new Error());
		this._blocker = undefined;
	}

	public override dispose(): void {
		super.dispose();
		this.unschedule();
	}

	// [private helper methods]

	private __clearSchedule(): void {
		this._schedule?.dispose();
		this._schedule = undefined;
	}

	private __scheduleAsTimeout(timeout: Time, fn: () => void): __Scheduler {
		let scheduling = true;
		
		const token = setTimeout(() => {
			scheduling = false;
			fn();
		}, timeout.toMs().time);
	
		return {
			onSchedule: () => scheduling,
			dispose: () => { scheduling = false; clearTimeout(token); },
		};
	}

	private __scheduleAsMicrotask(fn: () => void): __Scheduler {
		let schedulingOrDisposed = true;
		
		queueMicrotask(() => {
			if (schedulingOrDisposed) {
				schedulingOrDisposed = false;
				fn();
			}
		});
	
		return {
			onSchedule: () => schedulingOrDisposed,
			dispose: () => schedulingOrDisposed = false,
		};
	}
}

/**
 * An interface only for {@link ThrottleDebouncer}.
 */
export interface IThrottleDebouncer<T> extends IDisposable {
	queue(task: ITask<Promise<T>>, delay?: DelayType): Promise<T>;
	onSchedule(): boolean;
	unschedule(): void;
	dispose(): void;
}

/**
 * @class Represents a combined throttling and debouncing mechanism. It 
 * integrates both {@link Throttler} and a {@link Debouncer} to offer two key
 * features:
 * 		1. Introduces delays between the executions of queued tasks, ensuring 
 * 		     tasks are spaced out.
 * 		2. Ensures that tasks are not executed concurrently in succession.
 * 
 * @template T The type of the return value of the queued tasks.
 */
export class ThrottleDebouncer<T> extends Disposable implements IThrottleDebouncer<T> {
	
	private readonly debouncer: Debouncer<Promise<T>>;
	private readonly throttler: Throttler;

	constructor(defaultDelay: Time) {
		super();
		this.debouncer = this.__register(new Debouncer(defaultDelay));
		this.throttler = new Throttler();
	}

	/**
     * @description Queues a task for execution. The task will be debounced and 
	 * throttled based on the set delay.
     * 
     * @param task - The task to be executed.
     * @param {DelayType} [delay] - Optional delay duration overriding the default.
     * @returns A promise resolving to the result of the executed task.
     */
	public queue(task: ITask<Promise<T>>, delay?: DelayType): Promise<T> {
		return <Promise<T>>this.debouncer.queue(() => this.throttler.queue(task), delay);
	}

	public onSchedule(): boolean {
		return this.debouncer.onSchedule();
	}

	public unschedule(): void {
		this.debouncer.unschedule();
	}
}

/**
 * @description A timer that runs at a set interval, and can be cancelled or 
 * disposed of.
 */
export class IntervalTimer extends Disposable {

    private _handle?: any = undefined;

    constructor() {
		super();
	}

	/**
     * @description Sets the timer with a new callback and interval duration. If 
	 * 				the timer is currently active, it will be cancelled before 
	 * 				being set.
	 * @param time The interval duration.
     * @param callback The callback function to be run at each interval.
     */
    public set(time: Time, callback: () => void): void {
        this.cancel();
        this._handle = setInterval(() => callback(), time.toMs().time);
    }

	/**
     * @description Cancels the timer if it is currently active.
     */
    public cancel(): void {
        if (this._handle) {
            clearInterval(this._handle);
            this._handle = undefined;
        }
    }

    public override dispose(): void {
        this.cancel();
    }
}