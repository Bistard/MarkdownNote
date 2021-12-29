import { IDisposable, toDisposable } from "./dispose";
import { List } from "src/base/common/list";

/** @deprecated Use Emitter instead */
export interface IEventEmitter {
    /**
     * @description register an event.
     * 
     * to avoid losing 'this' scope, please pass the callback using an arrow 
     * wrapper function such as: '_eventEmitter.register(id, (...params) => callback(params));'
     */
    register(id: string, callback: (...params: any[]) => any): boolean;
    
    /**
     * @description emits an event, returns an array of return values for each registered callbacks.
     */
    emit(id: string, ...params: any[]): any[] | any;
}

/** @deprecated Use Emitter instead */
export class EventEmitter implements IEventEmitter {

    private _events: { 
        [key: string]: { (): any }[]
    };

    constructor() {
        this._events = {};
    }
    
    public register(id: string, callback: (...params: any[]) => any): boolean {
        if (this._events[id]) {
            this._events[id]!.push(callback);
        } else {
            this._events[id] = [callback];
        }
        return true;
    }

    public emit(id: string, ...params: any[]): any[] | any {
        const returnValues: any[] = [];
        if (this._events[id]) {
            this._events[id]!.forEach(callback => {
                const res = callback.apply(null, params as []);
                if (res) {
                    returnValues.push(res);
                }
            });
        }
        if (returnValues.length === 1) {
            return returnValues[0];
        }
        return returnValues;
    }

}

/** 
 * @readonly A listener is a callback function that once the callback is invoked,
 * the required event type will be returned as a parameter.
 */
export type Listener<T> = (e: T) => any;

/**
 * @readonly A register is essentially a function that registers a listener to 
 * the event type T.
 * 
 * @param listener The `listener` to be registered.
 * @param disposables The `disposables` is used to store all the `listener`s as 
 * disposables after registrations.
 */
export interface Register<T> {
	(listener: Listener<T>, disposables?: IDisposable[]): IDisposable;
}

/**
 * @readonly An event emitter binds to a specific event T. All the listeners who 
 * is listening to the event T will be notified once the event occurs.
 * 
 * To listen to this event T, use this.register(listener) where `listener` is a
 * callback function.
 * 
 * To trigger the event occurs and notifies all the listeners, use this.fire(event) 
 * where `event` is the type T.
 */
export class Emitter<T> implements IDisposable {
    
    private _disposed: boolean = false;
    private _register?: Register<T>;
	protected _listeners?: List<Listener<T>>;

    /**
     * @description For the purpose of registering new listener.
     * 
     * @returns A register (a function) that requires a listener (callback) to 
     * be registered.
     */
    get register(): Register<T> {
        if (this._disposed) {
            throw new Error('emitter is already disposed, cannot register a new listener');
        }

        if (!this._register) {
			this._register = (listener: Listener<T>, disposables?: IDisposable[]) => {
				if (!this._listeners) {
					this._listeners = new List<Listener<T>>();
				}

				const node = this._listeners.push_back(listener);
                let removed = false;

				const result = toDisposable(() => {
					if (!this._disposed && removed === false) {
						this._listeners?.remove(node);
                        removed = true;
					}
				});

				if (disposables) {
					disposables.push(result);
				}

				return result;
			};
		}
		return this._register;
    }

    /**
     * @description Fires the event T and notifies all the registered listeners.
     * 
     * @note fire() guarantees all the registered listeners (callback) will be 
     * invoked / notified. Any errors will be stored and returned as an array.
     * 
     * @param event The event T to be notified to all listeners.
     * @returns An array of errors.
     */
    public fire(event: T): any[] {
		const errors: any[] = [];

        if (this._listeners) {

            for (const listener of this._listeners) {
				try {
                    listener(event);
				} catch (e) {
					errors.push(e);
				}
			}

		}

        return errors;
	}

    /**
     * @description Disposes the whole event emitter. All the registered 
     * listeners will be cleaned. 
     * 
     * @warn Registering a listener after dispose() is invoked will throw an 
     * error.
     */
    public dispose(): void {
		if (!this._disposed) {
			this._disposed = true;
			this._listeners?.clear();
		}
	}
}

/** @deprecated Use Emitter instead */
export const EVENT_EMITTER = new EventEmitter();
