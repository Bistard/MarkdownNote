import { Callable, Constructor, NonEmptyArray, Or, isFunction, isObject } from "src/base/common/utilities/type";
import { IDisposable, toDisposable } from "src/base/common/dispose";
import { Arrays } from "src/base/common/utilities/array";
import { getCurrTimeStamp } from "src/base/common/date";
import { mixin } from "src/base/common/utilities/object";
import { Stacktrace } from "src/base/common/error";

/**
 * {@link Observable}
 * {@link observe}
 * {@link observable}
 */

/**
 * An interface only for {@link Observable}.
 */
export interface IObservable<T extends object> {

    /**
     * @description Returns the proxy object that can be observed.
     * @note Changes on the original object WILL NOT trigger the changes.
     */
    getProxy(): T;

    /**
     * @description Registers an observer callback for a specific property and 
     * operation type.
     * 
     * @template TKey The type of the keys of the properties to observe.
     * @param type The type of operation to observe.
     * @param propKey The property key to observe. When '' is given, it will 
     *                 observe on any propKey on the given TType.
     * @param cb The callback to be invoked when a change is detected.
     * @returns An IDisposable object that can be used to unregister the observer.
     */
    on<TType extends ObserveType, TKey extends keyof T | null>(type: TType, propKey: TKey, cb: GetObserver<TType, T, TKey>): IDisposable;

    /**
     * @description Cleans up the observable by removing all observers. After 
     * calling `dispose`, the observable should no longer notify any observers 
     * of changes.
     */
    dispose(): void;
}

/**
 * Defines the shape of a callback function that observers can use to listen to 
 * changes in an {@link Observable}.
 * @template T The type of the observed value.
 * @note Will be invoked when a change is observed.
 */
export interface IObserver<T> {
    (prevVal: T, newVal: T): void;
}

/**
 * Enumerates the types of operations that can be observed on an {@link Observable} 
 * object.
 */
export type ObserveType = 'set' | 'get' | 'call';

/**
 * A very complex type, which essentially returns a type that represents a 
 * callback (observer). Given different {@link TType}, returns different callback
 * type.
 * 
 * In additions, if {@link TKey} is null, which means the observer is watching
 * changes in any properties. Every type of callback will have an extra 
 * parameter called `propKey` that indicates the changing property name.
 */
export type GetObserver<TType extends ObserveType, T extends object, TKey extends keyof T | null> = ObserverType<TType, T[Or<NonNullable<TKey>, keyof T>], TKey>;
type ObserverType<TType extends ObserveType, T, TKey> = 
    TKey extends null
    ? TType extends 'set'
        ? (propKey: string, oldValue: T, newValue: T) => void
        : TType extends 'get'
            ? (propKey: string, value: T) => void
            : TType extends 'call'
                ? (T extends Callable<any, any> ? Callable<[propKey: string, ret: ReturnType<T>, ...rest: Parameters<T>], void> : never)
                : never
    : TType extends 'set'
        ? (oldValue: T, newValue: T) => void
        : TType extends 'get'
            ? (value: T) => void
            : TType extends 'call'
                ? (T extends Callable<any, any> ? Callable<[ret: ReturnType<T>, ...rest: Parameters<T>], void> : never)
                : never;

/**
 * @class Implements an observable object that allows clients to listen to 
 * changes on an underlying object of its direct properties.
 * 
 * @template T The type of the underlying object being observed.
 * @note Changes in the original object WILL NOT trigger the changes.
 * 
 * @example
 * ```ts
 * interface IUser {
 *   name: string;
 *   age: number;
 * }
 * 
 * const observable = new Observable<IUser>({ name: 'John Doe', age: 30 });
 * const user = observable.getProxy();
 * 
 * observable.on('set', 'name', (oldName, newName) => {
 *   console.log(`User name changed from ${oldName} to ${newName}`);
 * });
 * 
 * // Triggers the callback and logs: "User name changed from John Doe to Jane Doe"
 * user.name = 'Jane Doe';
 * ```
 */
export class Observable<T extends {}> implements IObservable<T> {

    // [fields]

    /**
     * Mapping from: 
     *      compositeKey (e.g. `propName:{@link ObserveType}`, or `foo:call` 
     *                    which means observing on function call on the method 
     *                    named foo)
     * to
     *      callback functions (e.g. {@link ObserverType})
     */
    private _observers: Map<string, any[]>;
    private readonly _proxy: T;

    // [constructor]

    constructor(obj: T) {
        this._observers = new Map();
        this._proxy = this.__createProxy(obj);
    }

    // [getter]

    public getProxy(): T {
        return this._proxy;
    }

    // [public methods]

    public on<TType extends ObserveType, TKey extends keyof T | null>(type: TType, propKey: TKey, cb: GetObserver<TType, T, TKey>): IDisposable {
        
        // composite key
        const composite = `${String(propKey)}:${type}`;

        let ob = this._observers.get(composite);
        if (!ob) {
            ob = [];
            this._observers.set(composite, ob);
        }
        ob.push(cb);
        
        return toDisposable(() => {
            const ob = this._observers.get(composite);
            if (ob) {
                Arrays.remove(ob!, cb);
            }
        });
    }

    public dispose(): void {
        this._observers.clear();
    }

    // [private helper methods]

    private __createProxy(target: T): T {

        return new Proxy<T>(target, {
            
            set: (obj: T, prop: string | symbol, value: any, receiver: any): boolean => {
                const prevVal = Reflect.get(obj, prop, receiver);
                const result = Reflect.set(obj, prop, value, receiver);
                this.__notify('set', prop, prevVal, value);
                return result;
            },
            
            get: (obj: T, prop: string | symbol, receiver: any): any => {
                const value = Reflect.get(obj, prop, receiver);
                
                // function proxy
                if (isFunction(value)) {
                    return (...args: any[]) => {
                        const ret = value.apply(receiver, args);
                        this.__notify('call', prop, ret, args);
                        return ret;
                    };
                }

                this.__notify('get', prop, value);
                return value;
            },
        });
    }

    private __notify(type: ObserveType, propKey: string | symbol, ...args: any[]): void {
        const compositeKey = `${String(propKey)}:${type}`;
        
        for (const [registeredKey, observers] of this._observers.entries()) {
            
            // universal observer
            if (registeredKey === `${String(null)}:${type}`) {
                for (const observer of observers) {
                    observer(String(propKey), ...args);
                }
                continue;
            }
            
            if (registeredKey !== compositeKey) {
                continue;
            }

            for (const observer of observers) {
                observer(...args);
            }
        }
    }
}

/**
 * Options for {@link observable} construction.
 */
export interface IObservableOptions {

    /**
     * Callback function when observing. A custom observer function that 
     * overrides the default behavior for handling observed property changes. 
     * It receives information about the class name, property being observed, 
     * the type of observation, and the parameters involved in the observation.
     * @default DEFAULT_OBSERVER
     */
    observer?: typeof DEFAULT_OBSERVER;

    /**
     * If set to true, this option excludes functions with names starting with 
     * `_` from observation.
     * @default true
     */
    ignoreUnderscores?: boolean;

    /**
     * Enable stacktrace when observing.
     * @default false
     */
    stackTrace?: boolean;
}

const OB_KEY = '$OB$properties';
type ObserveList = { propKey: string, types: ObserveType[] }[];

export const DEFAULT_OBSERVER = createDefaultObserver();
const DEFAULT_OBSERVABLE_OPTS: IObservableOptions = {
    observer: DEFAULT_OBSERVER,
    ignoreUnderscores: true,
    stackTrace: false,
};

/**
 * @description Decorator function for tagging class properties that should be 
 * observed. 
 * 
 * @param types - An array of {@link ObserveType} to be observed on the property.
 * @returns A decorator function that takes a target class and a property key 
 *          and applies the observation configuration to it.
 * 
 * @example
 * ```ts
 * @observable()
 * class MyClass {
 *   @observe(['set', 'get'])
 *   myProperty = {};
 * }
 * 
 * // The 'myProperty' will be observed for 'set' and 'get' operations.
 * ```
 */
export function observe(types: NonEmptyArray<ObserveType>) {
    const unique = Arrays.unique(types);
    
    return function(target: any, propKey: string | symbol): void {
        if (!target[OB_KEY]) {
            target[OB_KEY] = [];
        }
        target[OB_KEY].push({ propKey: String(propKey), types: unique });
    };
}

/**
 * @description Class decorator function that transforms the specified class to 
 * make its properties observable based on the {@link observe} decorator. 
 * 
 * @note It replaces direct object properties marked with {@link observe} with 
 * {@link Observable} instances, allowing changes to these properties to be 
 * observed.
 * @returns A class decorator function that takes a target class and returns a 
 *          new class with observable properties.
 * 
 * @example
 * ```ts
 * @observable()
 * class MyClass {
 *   @observe(['set'])
 *   myProperty = {};
 *   @observe(['get'])
 *   mySecondProperty = 5;
 * }
 * 
 * // Instances of MyClass will have 'myProperty' as an observable property, 
 * // observing 'set' operations.
 * ```
 */
export function observable<T extends Constructor>(options: IObservableOptions = DEFAULT_OBSERVABLE_OPTS) {

    const opts = mixin<Required<IObservableOptions>>(options, DEFAULT_OBSERVABLE_OPTS, { overwrite: false });
    const observer = opts.observer;
    function isFnIgnored(propKey: string): boolean {
        return opts.ignoreUnderscores && propKey.startsWith('_');
    }

    // return decorator
    return function(ctor: T): T {
        const className = ctor.toString().match(/\w+/g)?.[1] || 'UnknownClass';

        return class extends ctor {
            constructor(...args: any[]) {
                super(...args);

                /**
                 * Base constructor completed, we will check every object property 
                 * that is tagged by {@link observe}. Replace those plain objects 
                 * with {@link Observable}.
                 */
                const observeList: ObserveList = this[OB_KEY] ?? [];
                const isTagged = (propKey: string, type: ObserveType) => {
                    return !!observeList.find(observed => observed.propKey === propKey && observed.types.includes(type));
                };

                for (const { propKey, types } of observeList) {
                    const propValue = Reflect.get(this, propKey);

                    if (!isObject(propValue)) {
                        continue;
                    }

                    const ob = new Observable(propValue);
                    Reflect.set(this, propKey, ob.getProxy());

                    Arrays.exist(types, 'set') && ob.on('set', null, (subKey, oldVal, newVal) => {
                        observer(opts, className, `${propKey}.${subKey}`, 'set', [oldVal, newVal]);
                    });
                    
                    Arrays.exist(types, 'get') && ob.on('get', null, (subKey, val) => {
                        observer(opts, className, `${propKey}.${subKey}`, 'get', [val]);
                    });

                    Arrays.exist(types, 'call') && ob.on('call', null, <any>((fn: string, ret: any, ...rest: any[]) => {
                        if (isFnIgnored(fn)) {
                            return;
                        }
                        
                        observer(opts, className, `${propKey}.${fn}`, 'call', [ret, ...rest]);
                    }));
                }

                // proxy instance over the original instance
                return new Proxy(this, {
                    
                    set: (target: this, propKey: string | symbol, value: any, receiver: any): boolean => {
                        const key = String(propKey);

                        if (isTagged(key, 'set')) {
                            const oldValue = Reflect.get(target, propKey, receiver);
                            observer(opts, className, key, 'set', [oldValue, value]);
                        }
                        
                        const result = Reflect.set(target, propKey, value, receiver);
                        return result;
                    },

                    get: (target: this, propKey: string | symbol, receiver: any): any => {
                        const key = String(propKey);
                        const value: any = Reflect.get(target, propKey, receiver);

                        if (isFunction(value) && isTagged(key, 'call') && !isFnIgnored(key)) {
                            return (...args: any[]) => {
                                const ret = value.apply(receiver, args);
                                observer(opts, className, key, 'call', [ret, args]);
                                return ret;
                            };
                        }
        
                        if (isTagged(key, 'get')) {
                            observer(opts, className, key, 'get', [value]);
                        }

                        return value;
                    },
                });
            }

            /**
             * @internal
             * @defaults Testing purpose
             */
            public __getObserveList(): ObserveList {
                return this[OB_KEY];
            }
        };
    };
}

export function createDefaultObserver (handleMessage?: (opts: IObservableOptions, message: string, ...args: any[]) => void) { 
    return function defaultObserver<TType extends ObserveType>(opts: IObservableOptions, className: string, property: string, type: TType, param: any[]): void {
        
        let message = `[${getCurrTimeStamp().slice(0, -4)}] [${className}] `;

        if (type === 'get') {
            const value = param[0];

            /**
             * Any direct property of an {@link observable} class that is an 
             * object gets converted into an {@link Observable}. This conversion 
             * invokes `Symbol(Symbol.toPrimitive)` when attempting to stringify 
             * the object. 
             * 
             * To ensure clean and readable logging, objects will not be printed 
             * under any cases.
             */
            const stringify = isObject(value) ? '[object Object]' : value;
            message += `[GET] Property: '${property}' value: '${stringify}'`;
        }

        else if (type === 'set') {
            const oldValue = param[0];
            const newValue = param[1];
            message += `[SET] Property: '${property}' From: '${oldValue}' To: '${newValue}'`;
        }

        else if (type === 'call') {
            const returnValue = param[0];
            const params = param.slice(1);
            message += `[CALL] Function: '${property}' Arguments: [${params}] Return: ${returnValue}`;
        }
        
        // not provided message, we simply print it.
        if (!handleMessage) {
            console.log(message);
            if (opts.stackTrace === true) {
                console.log(`    Stacktrace:\n`, new Stacktrace().getRawTrace());
            }
            return;
        }
        
        // handler provided, we pass the data to it.
        handleMessage(opts, message, className, property, type, ...param);
    };
}