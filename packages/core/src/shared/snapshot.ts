// this is a place for storing stateless globals that will be used by shared/
// this is NOT a place for putting dom apis

export const Function_prototype_call = globalThis.Function.prototype.call;
export const Function_prototype_apply = globalThis.Function.prototype.apply;
export const Function_prototype_bind = globalThis.Function.prototype.bind;
export const Function_call = Function_prototype_call.bind(
	Function_prototype_call
);
export const Function_apply = Function_prototype_call.bind(
	Function_prototype_apply
);
export const Function_bind = Function_prototype_call.bind(
	Function_prototype_bind
);

export const String = globalThis.String;
export const String_fromCodePoint = globalThis.String.fromCodePoint;
export const String_fromCharCode = globalThis.String.fromCharCode;
export const String_prototype_toLowerCase =
	globalThis.String.prototype.toLowerCase;
export const String_prototype_split = globalThis.String.prototype.split;
export const String_prototype_trim = globalThis.String.prototype.trim;
export const String_prototype_startsWith =
	globalThis.String.prototype.startsWith;
export const String_prototype_indexOf = globalThis.String.prototype.indexOf;
export const String_prototype_substring = globalThis.String.prototype.substring;
export const String_prototype_charCodeAt =
	globalThis.String.prototype.charCodeAt;
export const String_toLowerCase = Function_prototype_call.bind(
	String_prototype_toLowerCase
);
export const String_charCodeAt = Function_prototype_call.bind(
	String_prototype_charCodeAt
);
export const String_split = Function_prototype_call.bind(
	String_prototype_split
);
export const String_trim = Function_prototype_call.bind(String_prototype_trim);
export const String_startsWith = Function_prototype_call.bind(
	String_prototype_startsWith
);
export const String_prototype_endsWith = globalThis.String.prototype.endsWith;
export const String_endsWith = Function_prototype_call.bind(
	String_prototype_endsWith
) as (s: string, search: string) => boolean;
export const String_indexOf = Function_prototype_call.bind(
	String_prototype_indexOf
);
export const String_substring = Function_prototype_call.bind(
	String_prototype_substring
);
export const String_prototype_replace = globalThis.String.prototype.replace;
export const String_replace = Function_prototype_call.bind(
	String_prototype_replace
);
export const String_slice = Function_prototype_call.bind(
	globalThis.String.prototype.slice
) as (s: string, start?: number, end?: number) => string;
export const String_codePointAt = Function_prototype_call.bind(
	globalThis.String.prototype.codePointAt
) as (s: string, index: number) => number | undefined;

/**
 * `String.prototype.replace` with a regex is not enough to be safe from the
 * page: it dispatches to `RegExp.prototype[Symbol.replace]`, looked up at call
 * time on a prototype the page shares with us and can overwrite. `exec` is the
 * primitive underneath, and snapshotting it means a page cannot see - or
 * rewrite - what any of our own regexes are matching against.
 */
export const RegExp_prototype_exec = globalThis.RegExp.prototype.exec;
export const RegExp_exec = Function_prototype_call.bind(
	RegExp_prototype_exec
) as (regex: RegExp, s: string) => RegExpExecArray | null;

export const Number = globalThis.Number;
export const Number_parseInt = globalThis.Number.parseInt;
export const Number_isSafeInteger = globalThis.Number.isSafeInteger;
export const Number_isFinite = globalThis.Number.isFinite;
export const Number_isNaN = globalThis.Number.isNaN;
export const Number_isInteger = globalThis.Number.isInteger;
export const Number_toString = Function_prototype_call.bind(
	globalThis.Number.prototype.toString
) as (n: number, radix?: number) => string;

export const BigInt = globalThis.BigInt;
export const BigInt_asIntN = globalThis.BigInt.asIntN;
export const BigInt_asUintN = globalThis.BigInt.asUintN;

export const encodeURIComponent = globalThis.encodeURIComponent;

export const Symbol_iterator = globalThis.Symbol.iterator;
/**
 * `OrdinaryHasInstance`, as `Function.prototype[Symbol.hasInstance]` exposes
 * it. Called directly rather than through `instanceof`, which consults the
 * right-hand side's own `Symbol.hasInstance` first - and a page can define one
 * on any interface object it likes.
 */
export const Function_hasInstance = Function_prototype_call.bind(
	globalThis.Function.prototype[globalThis.Symbol.hasInstance]
) as (ctor: object, value: unknown) => boolean;

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
export const Object_getPrototypeOf = globalThis.Object.getPrototypeOf;
export const Object_create = globalThis.Object.create;
export const Object_assign = globalThis.Object.assign;
export const Object_freeze = globalThis.Object.freeze;

export const Reflect_get = globalThis.Reflect.get;
export const Reflect_set = globalThis.Reflect.set;
export const Reflect_has = globalThis.Reflect.has;
export const Reflect_ownKeys = globalThis.Reflect.ownKeys;
export const Reflect_construct = globalThis.Reflect.construct;
export const Reflect_apply = globalThis.Reflect.apply;
export const Reflect_defineProperty = globalThis.Reflect.defineProperty;
export const Reflect_deleteProperty = globalThis.Reflect.deleteProperty;
export const Reflect_getOwnPropertyDescriptor =
	globalThis.Reflect.getOwnPropertyDescriptor;

// %AsyncFunction.prototype%, the only runtime signal distinguishing a member
// declared `async` from one that merely happens to return a promise. Requires
// the bundle's jsc.target to stay at es2017 or later: lower it and swc lowers
// async functions to generators, and every async member silently stops matching
export const AsyncFunction_prototype = globalThis.Object.getPrototypeOf(
	async function () {}
);
export const ArrayBuffer_isView = globalThis.ArrayBuffer.isView;
export const WebAssembly_Module = globalThis.WebAssembly.Module;
// taken before page code runs: `self` is [Replaceable] on a window, so a page
// can shadow it. the Location itself is [LegacyUnforgeable]. undefined outside
// a browser (the rewriter's node tests)
export const selfLocation: Location | WorkerLocation | undefined =
	globalThis.location;
// WebIDL discriminates buffer types on internal slots, and the byteLength
// getters are the only reachable test for those slots. Unlike `instanceof` they
// are realm-independent and cannot be forged with a Symbol.toStringTag
export const ArrayBuffer_prototype_byteLength = Object_getOwnPropertyDescriptor(
	globalThis.ArrayBuffer.prototype,
	"byteLength"
)!.get!;
/**
 * %TypedArray%.prototype's `byteLength` getter, taken through `Uint8Array`'s
 * prototype chain. `view.byteLength` would go through the page-writable
 * accessor; this is the slot itself.
 */
export const TypedArray_prototype_byteLength = Object_getOwnPropertyDescriptor(
	Object_getPrototypeOf(globalThis.Uint8Array.prototype),
	"byteLength"
)!.get!;
// absent unless the page is cross-origin isolated
export const SharedArrayBuffer_prototype_byteLength =
	typeof globalThis.SharedArrayBuffer === "function"
		? Object_getOwnPropertyDescriptor(
				globalThis.SharedArrayBuffer.prototype,
				"byteLength"
			)?.get
		: undefined;
/**
 * The mutating array methods. Calling one on an ordinary array is still not
 * safe from the page: `push` stores with [[Set]], which finds a setter the page
 * put on `Array.prototype[n]`. Use them on arrays with no prototype (see
 * `nullArray` in shared/htmlparser/safe.ts).
 */
type ArrayOf<T> = { length: number; [index: number]: T };
export const Array_push = Function_prototype_call.bind(
	globalThis.Array.prototype.push
) as <T>(array: ArrayOf<T>, ...items: T[]) => number;
export const Array_pop = Function_prototype_call.bind(
	globalThis.Array.prototype.pop
) as <T>(array: ArrayOf<T>) => T | undefined;
export const Array_shift = Function_prototype_call.bind(
	globalThis.Array.prototype.shift
) as <T>(array: ArrayOf<T>) => T | undefined;
export const Array_unshift = Function_prototype_call.bind(
	globalThis.Array.prototype.unshift
) as <T>(array: ArrayOf<T>, ...items: T[]) => number;
export const Array_includes = Function_prototype_call.bind(
	globalThis.Array.prototype.includes
) as <T>(array: ArrayOf<T>, search: unknown, from?: number) => boolean;
export const Uint16Array = globalThis.Uint16Array;
export const Array_from = globalThis.Array.from;
export const Array_isArray = globalThis.Array.isArray;
export const Array_of = globalThis.Array.of;
export const Array_sort = Function_prototype_call.bind(
	globalThis.Array.prototype.sort
) as <T>(array: T[], compare?: (a: T, b: T) => number) => T[];
export const Array_join = Function_prototype_call.bind(
	globalThis.Array.prototype.join
) as (array: unknown[], separator?: string) => string;
export const Array_indexOf = Function_prototype_call.bind(
	globalThis.Array.prototype.indexOf
) as <T>(
	array: readonly T[] | { length: number; [index: number]: T },
	search: unknown,
	from?: number
) => number;

export const JSON_parse = globalThis.JSON.parse;
export const JSON_stringify = globalThis.JSON.stringify;

const textEncoder = new TextEncoder();
export const TextEncoder_encode = textEncoder.encode.bind(textEncoder);

const textDecoder = new TextDecoder();
export const TextDecoder_decode = textDecoder.decode.bind(textDecoder);

const performance = globalThis.performance;
export const Performance_now = performance.now.bind(performance);

const crypto = globalThis.crypto;
export const Crypto_getRandomValues = crypto.getRandomValues.bind(crypto);

export const btoa = globalThis.btoa;
export const atob = globalThis.atob;
export const URL_createObjectURL = globalThis.URL.createObjectURL.bind(
	globalThis.URL
);
export const URL_revokeObjectURL = globalThis.URL.revokeObjectURL.bind(
	globalThis.URL
);

export const Error = globalThis.Error;
// V8 writes a stack's header line with exactly this, for a DOMException as much
// as for an Error, so a hand-built stack has to use it too
export const Error_prototype_toString = globalThis.Error.prototype.toString;
export const TypeError = globalThis.TypeError;
export const Math_random = globalThis.Math.random;
export const Math_min = globalThis.Math.min;
export const Math_max = globalThis.Math.max;
export const Math_floor = globalThis.Math.floor;
export const Math_trunc = globalThis.Math.trunc;
export const Math_fround = globalThis.Math.fround;

export const Promise_all = globalThis.Promise.all.bind(globalThis.Promise);
export const Promise_race = globalThis.Promise.race.bind(globalThis.Promise);
export const Promise_resolve = globalThis.Promise.resolve.bind(
	globalThis.Promise
);
export const Promise_reject = globalThis.Promise.reject.bind(
	globalThis.Promise
);
export const Promise_allSettled = globalThis.Promise.allSettled.bind(
	globalThis.Promise
);
export const Promise_any = globalThis.Promise.any.bind(globalThis.Promise);
export const Promise_then = Function_prototype_call.bind(
	globalThis.Promise.prototype.then
);

export const Symbol_for = globalThis.Symbol.for;

declare const WrappedBrand: unique symbol;

type WrappedInstance<T> = T extends object ? Wrapped<T> : T;

type ConstructorPrototype<T> = T extends { prototype: infer P } ? P : never;

/**
 * Order matters in both pairs, because the weak collections are structural
 * subsets of the strong ones: `WeakSet` asks only for `add`/`has`/`delete`, all
 * of which `Set` has, so `Set<any> extends WeakSet<any>` is *true*. Testing the
 * weak one first therefore matches everything and types every `Set` as a
 * `WeakSet` — which is what constrained `_Set`'s member to `object`. The
 * reverse is not true (a `WeakSet` has no `size`/`forEach`/iterator), so
 * strong-first is unambiguous.
 */
type InstantiatePrototype<P, Params extends unknown[]> = Params extends [
	infer A,
	infer B,
]
	? P extends Map<any, any>
		? Map<A, B>
		: P extends WeakMap<any, any>
			? WeakMap<A & WeakKey, B>
			: P
	: Params extends [infer A]
		? P extends Set<any>
			? Set<A>
			: P extends WeakSet<any>
				? WeakSet<A & WeakKey>
				: P
		: P;

type WrappedCtorStatics<T> = Pick<T, Exclude<keyof T, "prototype">>;

type WrappedCtor<
	T,
	Params extends unknown[],
	New extends abstract new (...a: any) => any,
> = New &
	WrappedCtorStatics<T> & {
		prototype: Wrapped<InstantiatePrototype<ConstructorPrototype<T>, Params>>;
		readonly [WrappedBrand]: T;
	};

/**
 * The four collection constructors, and `Uint8Array`, get hand-written
 * signatures rather than `infer Args` off the source. Inferring from an
 * overloaded constructor picks one overload arbitrarily, which is how
 * `new _Map()` ended up demanding an argument and `new _Uint8Array(n)`
 * demanding none; writing them out keeps the initialiser optional and gives
 * the type parameter a default, so `new _Set()`, `new _Set<string>()` and
 * `new _Set(["a"])` all behave like the real thing.
 *
 * Strong collections are tested before weak ones - see InstantiatePrototype.
 */
type WrappedConstructor<T> =
	ConstructorPrototype<T> extends Map<any, any>
		? WrappedCtor<
				T,
				[unknown, unknown],
				{
					new <K = any, V = any>(
						entries?:
							| readonly (readonly [K, V])[]
							| Iterable<readonly [K, V]>
							| null
					): Wrapped<Map<K, V>>;
				}
			>
		: ConstructorPrototype<T> extends Set<any>
			? WrappedCtor<
					T,
					[unknown],
					{
						new <U = any>(
							values?: readonly U[] | Iterable<U> | null
						): Wrapped<Set<U>>;
					}
				>
			: ConstructorPrototype<T> extends WeakMap<any, any>
				? WrappedCtor<
						T,
						[WeakKey, unknown],
						{
							new <K extends WeakKey = WeakKey, V = any>(
								entries?: readonly (readonly [K, V])[] | null
							): Wrapped<WeakMap<K, V>>;
						}
					>
				: ConstructorPrototype<T> extends WeakSet<any>
					? WrappedCtor<
							T,
							[WeakKey],
							{
								new <U extends WeakKey = WeakKey>(
									values?: readonly U[] | null
								): Wrapped<WeakSet<U>>;
							}
						>
					: ConstructorPrototype<T> extends Uint8Array<ArrayBufferLike>
						? WrappedCtor<
								T,
								[],
								{
									new (length?: number): Wrapped<Uint8Array>;
									new (
										source: ArrayLike<number> | Iterable<number>
									): Wrapped<Uint8Array>;
									new (
										buffer: ArrayBufferLike,
										byteOffset?: number,
										length?: number
									): Wrapped<Uint8Array>;
								}
							>
						: T extends abstract new (...args: infer Args) => infer Instance
							? Omit<T, "prototype"> & {
									new (...args: Args): WrappedInstance<Instance>;
									prototype: WrappedInstance<Instance>;
									readonly [WrappedBrand]: T;
								}
							: never;

export type Wrapped<T> = T extends abstract new (...args: any) => any
	? WrappedConstructor<T>
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
export type _WeakSet<T extends WeakKey> = Wrapped<WeakSet<T>>;
export const _WeakMap = makeWrap(globalThis.WeakMap);
// only the *key* is weakly held, so the value takes no constraint
export type _WeakMap<K extends WeakKey, V> = Wrapped<WeakMap<K, V>>;
export const _Uint8Array = makeWrap(globalThis.Uint8Array);
export type _Uint8Array = Wrapped<Uint8Array>;
export const _TextDecoder = makeWrap(globalThis.TextDecoder);
export type _TextDecoder = Wrapped<TextDecoder>;
export const _TextEncoder = makeWrap(globalThis.TextEncoder);
export type _TextEncoder = Wrapped<TextEncoder>;
export const _Blob = makeWrap(globalThis.Blob);
export type _Blob = Wrapped<Blob>;

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
