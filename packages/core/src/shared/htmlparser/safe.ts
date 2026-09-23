/**
 * Containers the vendored parser uses in place of `Set`, `Map` and bare arrays.
 *
 * The parser runs inside the page's realm (every markup sink rewrites through
 * it), so every global and every builtin prototype is the page's to rewrite.
 * A `Set` would dispatch `has` through `Set.prototype`, a `[]` would dispatch
 * `push` through `Array.prototype` - and even `arr[arr.length] = x` walks the
 * prototype chain looking for a setter on that index. Everything here roots
 * its prototype chain in `null`, so the only lookups that can happen are on
 * objects the page never sees.
 *
 * `SafeSet` and `SafeMap` mirror the builtins they replace, so upstream code
 * like `voidElements.has(name)` stays textually identical. Arrays can't be
 * mirrored without giving them a prototype, so their call sites are
 * rewritten to the snapshot's `Array_*` functions instead.
 */
import {
	Object_create,
	Object_freeze,
	Object_getPrototypeOf,
	Object_keys,
	Object_setPrototypeOf,
} from "../snapshot";

/**
 * A string- or number-keyed dictionary with no prototype. Reads of absent keys
 * return `undefined` rather than whatever the page defined on
 * `Object.prototype`, and writes can't hit an inherited setter.
 */
export type NullRecord<V> = { [key: string]: V };

export function nullRecord<V>(): NullRecord<V> {
	return Object_create(null);
}

/**
 * Copy an object's own enumerable string keys into a {@link NullRecord}, or
 * return it as-is when it already has no prototype.
 */
export function toNullRecord<V>(source: { [key: string]: V }): NullRecord<V> {
	if (Object_getPrototypeOf(source) === null) return source;

	const record = nullRecord<V>();
	const keys = Object_keys(source);
	for (let index = 0; index < keys.length; index++) {
		record[keys[index]] = source[keys[index]];
	}

	return record;
}

/**
 * An array with no prototype. Out-of-range reads come back `undefined` and
 * stores to new indices can't reach a setter, where on an ordinary array both
 * would go to the page's `Array.prototype`. It has no methods either: use the
 * call-bound `Array_push`/`Array_shift`/... from the snapshot, and indexed
 * loops rather than iteration.
 */
export type NullArray<T> = { length: number; [index: number]: T };

/** Strip the prototype from `items`, a fresh array literal. */
export function nullArray<T>(items: T[] = []): NullArray<T> {
	return Object_setPrototypeOf(items, null);
}

/**
 * A frozen, prototype-less array of numbers - stands in for the tokenizer's
 * `Uint8Array` sequences, whose `length` is a getter on the page's
 * `%TypedArray%.prototype`.
 */
export type Sequence = readonly number[];

export function sequence(bytes: number[]): Sequence {
	return Object_freeze(Object_setPrototypeOf(bytes, null));
}

/** `Set<string>`, backed by a {@link NullRecord}. */
export class SafeSet {
	private readonly values: NullRecord<true> = nullRecord();

	constructor(values: readonly string[]) {
		for (let index = 0; index < values.length; index++) {
			this.values[values[index]] = true;
		}
	}

	has(value: string): boolean {
		return value in this.values;
	}
}

/** `Map<string | number, V>`, backed by a {@link NullRecord}. */
export class SafeMap<K extends string | number, V> {
	private readonly entries: NullRecord<V> = nullRecord();

	constructor(entries: readonly (readonly [K, V])[]) {
		for (let index = 0; index < entries.length; index++) {
			this.entries[entries[index][0]] = entries[index][1];
		}
	}

	get(key: K): V | undefined {
		return this.entries[key];
	}

	has(key: K): boolean {
		return key in this.entries;
	}
}

Object_setPrototypeOf(SafeSet.prototype, null);
Object_setPrototypeOf(SafeMap.prototype, null);
