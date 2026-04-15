// this is a place for storing stateless globals that will be used by shared/
// this is NOT a place for putting dom apis

export const String = globalThis.String;
export const Number = globalThis.Number;
export const String_fromCodePoint = globalThis.String.fromCodePoint;
export const String_fromCharCode = globalThis.String.fromCharCode;

export const Object_keys = globalThis.Object.keys;
export const Object_values = globalThis.Object.values;
export const Object_entries = globalThis.Object.entries;
export const Object_hasOwn = globalThis.Object.hasOwn;
export const Object_getOwnPropertyNames = globalThis.Object.getOwnPropertyNames;
export const Object_getOwnPropertyDescriptor =
	globalThis.Object.getOwnPropertyDescriptor;
export const Object_getOwnPropertyDescriptors =
	globalThis.Object.getOwnPropertyDescriptors;
export const Object_getOwnPropertySymbols =
	globalThis.Object.getOwnPropertySymbols;
export const Object_defineProperty = globalThis.Object.defineProperty;
export const Object_defineProperties = globalThis.Object.defineProperties;
export const Object_setPrototypeOf = globalThis.Object.setPrototypeOf;

export const Reflect_get = globalThis.Reflect.get;
export const Reflect_set = globalThis.Reflect.set;
export const Reflect_has = globalThis.Reflect.has;
export const Reflect_ownKeys = globalThis.Reflect.ownKeys;
export const Reflect_construct = globalThis.Reflect.construct;
export const Reflect_apply = globalThis.Reflect.apply;

export const Array_from = globalThis.Array.from;
export const Array_isArray = globalThis.Array.isArray;
export const Array_of = globalThis.Array.of;

export const JSON_parse = globalThis.JSON.parse;
export const JSON_stringify = globalThis.JSON.stringify;

const textEncoder = new TextEncoder();
export const TextEncoder_encode = textEncoder.encode.bind(textEncoder);

const textDecoder = new TextDecoder();
export const TextDecoder_decode = textDecoder.decode.bind(textDecoder);

const performance = globalThis.performance;
export const Performance_now = performance.now.bind(performance);

export const btoa = globalThis.btoa;
export const atob = globalThis.atob;
export const URL_createObjectURL = globalThis.URL.createObjectURL.bind(
	globalThis.URL
);
export const URL_revokeObjectURL = globalThis.URL.revokeObjectURL.bind(
	globalThis.URL
);

export const Error = globalThis.Error;
export const Math_random = globalThis.Math.random;
export const Math_min = globalThis.Math.min;

export const Promise_all = globalThis.Promise.all;
export const Promise_race = globalThis.Promise.race;
export const Promise_resolve = globalThis.Promise.resolve;
export const Promise_reject = globalThis.Promise.reject;
export const Promise_allSettled = globalThis.Promise.allSettled;
export const Promise_any = globalThis.Promise.any;

export const Symbol_for = globalThis.Symbol.for;

declare const WrappedBrand: unique symbol;

type WrappedInstance<T> = T extends object ? Wrapped<T> : T;

export type Wrapped<T> = T extends abstract new (
	...args: infer Args
) => infer Instance
	? Omit<T, "prototype"> & {
			new (...args: Args): WrappedInstance<Instance>;
			prototype: WrappedInstance<Instance>;
			readonly [WrappedBrand]: T;
		}
	: T & {
			readonly [WrappedBrand]: T;
		};

export const _URL = makeWrap(globalThis.URL);
export type _URL = Wrapped<URL>;
export const _Headers = makeWrap(globalThis.Headers);
export type _Headers = Wrapped<Headers>;
export const _Date = makeWrap(globalThis.Date);
export type _Date = Wrapped<Date>;
export const _URLSearchParams = makeWrap(globalThis.URLSearchParams);
export type _URLSearchParams = Wrapped<URLSearchParams>;
export const _RegExp = makeWrap(globalThis.RegExp);
export type _RegExp = Wrapped<RegExp>;
export const _Set = makeWrap(globalThis.Set);
export type _Set<T> = Wrapped<Set<T>>;
export const _Map = makeWrap(globalThis.Map);
export type _Map<K, V> = Wrapped<Map<K, V>>;
export const _WeakSet = makeWrap(globalThis.WeakSet);
export type _WeakSet<T extends object> = Wrapped<WeakSet<T>>;
export const _WeakMap = makeWrap(globalThis.WeakMap);
export type _WeakMap<K extends object, V extends object> = Wrapped<
	WeakMap<K, V>
>;
export const _Uint8Array = makeWrap(globalThis.Uint8Array);
export type _Uint8Array = Wrapped<Uint8Array>;
export const _TextDecoder = makeWrap(globalThis.TextDecoder);
export type _TextDecoder = Wrapped<TextDecoder>;
export const _TextEncoder = makeWrap(globalThis.TextEncoder);
export type _TextEncoder = Wrapped<TextEncoder>;

export function makeWrap<T extends object>(source: T): Wrapped<T> {
	// Constructable builtins like Set/Map/URL need to retain their [[Construct]]
	// behavior; cloning them into plain objects breaks `new _Set(...)`.
	if (typeof source === "function") {
		return new Proxy(source, {}) as Wrapped<T>;
	}

	function getAllPropertyDescriptors(obj: object) {
		const descriptors: PropertyDescriptorMap = {};

		for (const key of Object.getOwnPropertyNames(obj)) {
			descriptors[key] = Object.getOwnPropertyDescriptor(obj, key)!;
		}
		for (const sym of Object.getOwnPropertySymbols(obj)) {
			descriptors[sym as any] = Object.getOwnPropertyDescriptor(obj, sym)!;
		}
		return descriptors;
	}

	// Recursively clone prototype chain
	function clonePrototypeChain(obj: object | null): object | null {
		if (obj === null) return null;
		const proto = Object.getPrototypeOf(obj);
		// The chain ends at null (root), otherwise recursively clone up the chain
		const clonedProto = clonePrototypeChain(proto);
		// Clone current object's own props and set prototype to cloned parent
		const clone = Object.create(clonedProto, getAllPropertyDescriptors(obj));
		return clone;
	}

	// Actually clone the source itself (including own properties)
	const wrapped = Object.create(
		clonePrototypeChain(Object.getPrototypeOf(source)),
		getAllPropertyDescriptors(source)
	);

	return wrapped as Wrapped<T>;
}
