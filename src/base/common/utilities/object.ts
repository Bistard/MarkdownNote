import { DeepReadonly, isNullable, isObject, isPrimitive } from "src/base/common/utilities/type";

/**
 * A generic type representing a reference to an data of type `T`.
 * @template T The type of the referenced data.
 * 
 * @note Act like 'reference' concept in C++.
 */
export type Ref<T> = {
	ref: T;
};

export function ref<T>(data: T): Ref<T> {
	return { ref: data };
}

/**
 * Copies all properties of source into destination. The optional parameter 
 * 'overwrite' allows to control if existing properties on the destination 
 * should be overwritten or not.
 * @default overwrite true
 * 
 * @note Non-object type will be ignored.
 */
export function mixin<T>(destination: any, source: any, overwrite: boolean = true): T {
	if (isObject(destination) === false) {
		return source;
	}

	if (!isObject(source)) {
		return destination;
	}

	const propNames = Object.keys(source);
	for (const propName of propNames) {
		const exist = propName in destination;

		// We copy the value since the property does not exist in the destination
		if (!exist) {
			destination[propName] = source[propName];
			continue;
		}
		
		// not able to overwrite, we do nothing
		if (!overwrite) {
			continue;
		}

		// see prototype-polluting https://github.com/Bistard/nota/issues/129
		if (Object.prototype.hasOwnProperty.call(source, propName) === false) {
			continue;
		}

		// recursive mixin when overwriting
		if (Object.prototype.hasOwnProperty.call(destination, propName) 
			&& isObject(destination[propName]) 
			&& isObject(source[propName])
		) {
			mixin(destination[propName], source[propName], overwrite);
			continue;
		}
		
		// primitive value, simply overwrite.
		destination[propName] = source[propName];
	}
    
	return destination;
}

/**
 * @description Iterate the properties and methods of the given object.
 * @param obj The given {@link object}.
 * @param fn The function that takes the string of the property and the ordinal 
 * index of the property in that object.
 * @param recursiveLevel How deep you want for recursive iteration. Default is 0. 
 * 						 Set to -1 if you need iterate to the deepest.
 */
export function iterProp(obj: any, fn: (propName: string, index: number) => any, recursiveLevel: number = 0): void {
    if (!isObject(obj)) {
		return;
	}

	let idx = 0;
	const __handler = (prototype: any, fn: (propName: string, index: number) => any, recursiveLevel: number) => {
		if (!prototype) {
			return;
		}

		if (recursiveLevel) {
			__handler(Object.getPrototypeOf(prototype), fn, recursiveLevel - 1);
		}
		
		for (const propName of Object.getOwnPropertyNames(prototype)) {
			fn(propName, idx++);
		}
	};

	__handler(Object.getPrototypeOf(obj), fn, recursiveLevel);
}

/**
 * @description Iterate the enumerable properties of the given object.
 * @param obj The given {@link Object}.
 * @param fn The function that takes the string of the property and the ordinal 
 * index of the property in that object.
 * @param recursiveLevel How deep you want for recursive iteration. Default is 0. 
 * 						 Set to -1 if you need iterate to the deepest.
 */
export function iterPropEnumerable(obj: any, fn: (propName: string, index: number) => any, recursiveLevel: number = 0): void {
    let idx = 0;
	for (const propName of Object.keys(obj)) {
		if (recursiveLevel) {
			const value = obj[propName];
			if (isObject(value)) {
				iterPropEnumerable(value, fn, recursiveLevel - 1);
			}
		}
		fn(propName, idx++);
	}
}

/**
 * @description Returns a deep copy version of the given object or array.
 */
export function deepCopy<T extends object | []>(obj: T): T {
	
	// return for nullity and non-object
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	
	if (obj instanceof RegExp) {
		return obj;
	}
	
	const copy: T = Array.isArray(obj) ? [] : Object.assign({});
	for (const propName of Object.keys(obj)) {
		const value = obj[propName]!;
		
		if (value && typeof value === 'object') {
			copy[propName] = deepCopy(value);
		} else {
			copy[propName] = value;
		}
	}

	return copy;
}

/**
 * @description Deep freezes an object or an array.
 * @note When an array is deep freezed, its element are also deep freezed.
 */
export function deepFreeze<T extends object | []>(obj: T): DeepReadonly<T> {

	// array handling
	if (Array.isArray(obj)) {
		for (const element of obj) {
			deepFreeze(element);
		}
		return <DeepReadonly<T>>Object.freeze(obj);
	}

	// object handling
	else {
		Object.getOwnPropertyNames(obj).forEach((propName) => {
			const prop = obj[propName];
			if (!isPrimitive(prop)) {
				deepFreeze(prop);
			}
		});

		return <DeepReadonly<T>>Object.freeze(obj);
	}
}

/**
 * @description This function performs a deep comparison between two values to 
 * determine if they are equivalent. It compares the types, structure, and 
 * individual values in the input.
 * 
 * @example
 * const obj1 = { a: 1, b: { c: 2 }};
 * const obj2 = { a: 1, b: { c: 2 }};
 * console.log(equals(obj1, obj2)); // true
 */
export function strictEquals(one: any, other: any): boolean {
	if (one === other) {
		return true;
	}

	if (isNullable(one) || isNullable(other)) {
		return false;
	}
	
	if (typeof one !== typeof other) {
		return false;
	}
	
	if (typeof one !== 'object') {
		return false;
	}
	
	if ((Array.isArray(one)) !== (Array.isArray(other))) {
		return false;
	}

	if (Array.isArray(one)) {
		// TODO: use Arrays.equals
		if (one.length !== other.length) {
			return false;
		}
		for (let i = 0; i < one.length; i++) {
			if (!strictEquals(one[i], other[i])) {
				return false;
			}
		}
	} 

	else {
		const oneKeys: string[] = [];
		for (const key in one) {
			oneKeys.push(key);
		}
		
		oneKeys.sort();
		const otherKeys: string[] = [];
		for (const key in other) {
			otherKeys.push(key);
		}
		
		otherKeys.sort();
		// TODO: use Arrays.equals
		if (!strictEquals(oneKeys, otherKeys)) {
			return false;
		}

		for (let i = 0; i < oneKeys.length; i++) {
			if (!strictEquals(one[oneKeys[i]!], other[oneKeys[i]!])) {
				return false;
			}
		}
	}

	return true;
}