/**
 * WebIDL -> TypeScript type resolution.
 *
 * This is the type layer that makes `@Arguments`/`@Returns`/`@Type` on an
 * {@link Interceptor} check out. Every decorator argument is a literal slice of
 * WebIDL grammar (`"ByteString"`, `"USVString?"`, `"sequence<DOMString>"`,
 * `"(DOMString or Blob)"`, `"optional boolean async = true"`) and this file
 * turns those strings into the TS types they denote so the decorator can
 * verify the member it's attached to.
 *
 * The grammar handled here is the subset of
 * https://webidl.spec.whatwg.org/#idl-types that shows up in real specs:
 *
 *   type          := extAttrs? ( primitive | named | parameterized | union ) "?"?
 *   parameterized := ( "sequence" | "FrozenArray" | "ObservableArray" | "Promise" ) "<" type ">"
 *                  | "record" "<" stringType "," type ">"
 *   union         := "(" type ( " or " type )+ ")"
 *   argument      := extAttrs? "optional"? type "..."? identifier? ( " = " default )?
 *
 * Names that aren't primitives are resolved against {@link IDLNamedTypes}
 * first, then against the global scope (every `[Exposed]` interface has an
 * interface object, so `Blob` -> `typeof Blob` -> `Blob`). Dictionaries,
 * enums, typedefs and callback interfaces have no interface object, so they
 * have to live in {@link IDLNamedTypes} — add an entry when you hit one.
 *
 * NOTE: decorators here are the 2022-03 standard proposal, not the legacy
 * TS ones. swc needs `jsc.parser.decorators: true` and
 * `jsc.transform.decoratorVersion: "2022-03"` to compile them.
 */

import {
	_WeakMap,
	ArrayBuffer_isView,
	ArrayBuffer_prototype_byteLength,
	BigInt,
	BigInt_asIntN,
	BigInt_asUintN,
	Math_floor,
	Math_fround,
	Math_trunc,
	Number,
	Number_isFinite,
	Number_isNaN,
	Object_keys,
	Object_getOwnPropertyDescriptor,
	Object_defineProperty,
	Reflect_ownKeys,
	Reflect_apply,
	String,
	String_charCodeAt,
	String_trim,
	SharedArrayBuffer_prototype_byteLength,
	String_fromCharCode,
	Symbol_iterator,
	TypeError,
	Error,
} from "@/shared/snapshot";
import type { AnyFunction } from "@/types";

// ---------------------------------------------------------------------------
// the actual name -> type table
// ---------------------------------------------------------------------------

/**
 * WebIDL primitive, string and buffer-alias types. These are the names that
 * can't be looked up in the global scope because they either aren't values at
 * all (`long`) or are typedefs with no interface object (`BufferSource`).
 */
export interface IDLPrimitives {
	// https://webidl.spec.whatwg.org/#idl-undefined
	undefined: undefined;
	/** legacy spelling, a handful of unmigrated specs still use it */
	void: undefined;

	// https://webidl.spec.whatwg.org/#idl-boolean
	boolean: boolean;

	// https://webidl.spec.whatwg.org/#idl-integer-types
	byte: number;
	octet: number;
	short: number;
	"unsigned short": number;
	long: number;
	"unsigned long": number;
	"long long": number;
	"unsigned long long": number;

	// https://webidl.spec.whatwg.org/#idl-floating-point-types
	float: number;
	"unrestricted float": number;
	double: number;
	"unrestricted double": number;
	/**
	 * hr-time's typedef for `double`. It lives here rather than in
	 * {@link IDLNamedTypes} because {@link IDL_PRIMITIVE_COERCERS} is keyed on
	 * this interface - a name known only to the type layer resolves for the
	 * decorator and then silently converts nothing at run time.
	 */
	DOMHighResTimeStamp: number;

	// https://webidl.spec.whatwg.org/#idl-bigint
	bigint: bigint;

	// https://webidl.spec.whatwg.org/#idl-string-types
	// all three are `string` in JS; the distinction is *coercion* behavior
	// (ByteString throws outside latin1, USVString replaces lone surrogates),
	// which is a runtime concern, not a type-level one
	DOMString: string;
	ByteString: string;
	USVString: string;
	/** cssom's typedef for DOMString */
	CSSOMString: string;

	// https://webidl.spec.whatwg.org/#idl-object
	object: object;
	// https://webidl.spec.whatwg.org/#idl-symbol
	symbol: symbol;
	// https://webidl.spec.whatwg.org/#idl-any
	any: any;

	// https://webidl.spec.whatwg.org/#common-BufferSource — typedefs, no
	// interface object, so they'd otherwise fail to resolve
	BufferSource: ArrayBufferView | ArrayBuffer;
	/** css font loading's spelling of the same thing */
	BinaryData: ArrayBufferView | ArrayBuffer;
	AllowSharedBufferSource: ArrayBufferView | ArrayBuffer | SharedArrayBuffer;
	ArrayBufferView: ArrayBufferView;
}

/**
 * The values of every enum a {@link dictionaryReader} member is declared with.
 *
 * An enum has no interface object and no conversion `compileIDLType` can do on
 * its own - it needs the value list - so a reader that reimplements a
 * dictionary rather than handing it to the native has to be given them.
 *
 * Add an entry when a reader names an enum that isn't here; the reader throws
 * at install time rather than passing the value through unchecked.
 */
export const IDL_ENUM_VALUES: Record<string, readonly string[]> = {
	RequestCredentials: ["omit", "same-origin", "include"],
	WorkerType: ["classic", "module"],
	CookieSameSite: ["strict", "lax", "none"],
};

/**
 * Dictionaries, enums, typedefs and callback interfaces. None of these have an
 * interface object, so the global-scope fallback can't find them and they have
 * to be listed by hand.
 *
 * Seeded with what the client modules currently touch. If `FromIDL` hands you
 * an {@link IDLUnresolved} for a name that really does exist in a spec, the fix
 * is an entry here.
 */
export interface IDLNamedTypes {
	// --- trusted types ----------------------------------------------------
	// from @types/trusted-types, which declares these globally. they have no
	// interface object, so the global-scope fallback can't reach them
	TrustedHTML: TrustedHTML;
	TrustedScript: TrustedScript;
	TrustedScriptURL: TrustedScriptURL;

	// --- callback interfaces / callback functions -------------------------
	EventListener: EventListener;
	EventHandler: ((event: Event) => any) | null;
	EventHandlerNonNull: (event: Event) => any;
	Function: AnyFunction;
	VoidFunction: () => void;
	QueuingStrategySize: (chunk: any) => number;

	/**
	 * html's sanitizer options, the second argument to `parseHTMLUnsafe` and
	 * `setHTMLUnsafe`. A dictionary, so no interface object, and lib.dom does
	 * not model it yet - it is only ever forwarded to the native.
	 */
	SetHTMLUnsafeOptions: object;

	// --- typedefs --------------------------------------------------------
	XMLHttpRequestBodyInit:
		| Blob
		| BufferSource
		| FormData
		| URLSearchParams
		| string;
	BodyInit: ReadableStream | XMLHttpRequestBodyInit;
	HeadersInit: [string, string][] | Record<string, string> | Headers;
	RequestInfo: Request | string;
	BlobPart: BufferSource | Blob | string;
	Transferable: ArrayBuffer | MessagePort | ImageBitmap | OffscreenCanvas;
	TimerHandler: string | AnyFunction;
	MessageEventSource: WindowProxy | MessagePort | ServiceWorker;
	WindowProxy: Window;
	CookieList: CookieList;

	// --- websockets ------------------------------------------------------
	// declared in global.d.ts. dictionaries are interfaces, not values, so
	// unlike `WebSocketStream` itself they never reach `keyof GlobalThis`
	WebSocketCloseInfo: WebSocketCloseInfo;
	WebSocketOpenInfo: WebSocketOpenInfo;
	WebSocketStreamOptions: WebSocketStreamOptions;

	// --- cssom's CSSStyleDeclaration subclasses ---------------------------
	// the type of every `style` attribute. lib.dom knows none of them and
	// models them all as CSSStyleDeclaration, which they inherit from, so the
	// global-scope fallback has nothing to find
	CSSStyleProperties: CSSStyleDeclaration;
	CSSFontFaceDescriptors: CSSStyleDeclaration;
	CSSMarginDescriptors: CSSStyleDeclaration;
	CSSPositionTryDescriptors: CSSStyleDeclaration;

	// --- enums (lib.dom models these as string literal unions) -----------
	RequestMode: RequestMode;
	RequestCredentials: RequestCredentials;
	RequestCache: RequestCache;
	RequestRedirect: RequestRedirect;
	RequestDestination: RequestDestination;
	ReferrerPolicy: ReferrerPolicy;
	ResponseType: ResponseType;
	XMLHttpRequestResponseType: XMLHttpRequestResponseType;
	BinaryType: BinaryType;
	WorkerType: WorkerType;
	ShadowRootMode: ShadowRootMode;
	InsertPosition: InsertPosition;
	DocumentReadyState: DocumentReadyState;
	ScrollBehavior: ScrollBehavior;
	CookieSameSite: CookieSameSite;

	// --- dictionaries ----------------------------------------------------
	RequestInit: RequestInit;
	ResponseInit: ResponseInit;
	CacheQueryOptions: CacheQueryOptions;
	MultiCacheQueryOptions: MultiCacheQueryOptions;
	BlobPropertyBag: BlobPropertyBag;
	WorkerOptions: WorkerOptions;
	WorkletOptions: WorkletOptions;
	RegistrationOptions: RegistrationOptions;
	EventInit: EventInit;
	CustomEventInit: CustomEventInit;
	MessageEventInit: MessageEventInit;
	AddEventListenerOptions: AddEventListenerOptions;
	EventListenerOptions: EventListenerOptions;
	StructuredSerializeOptions: StructuredSerializeOptions;
	WindowPostMessageOptions: WindowPostMessageOptions;
	ShadowRootInit: ShadowRootInit;
	GetRootNodeOptions: GetRootNodeOptions;
	ScrollIntoViewOptions: ScrollIntoViewOptions;
	CookieInit: CookieInit;
	CookieListItem: CookieListItem;
	/** indexeddb's `databases()` entry - a dictionary, so no interface object */
	IDBDatabaseInfo: IDBDatabaseInfo;
	CookieStoreGetOptions: CookieStoreGetOptions;
	CookieStoreDeleteOptions: CookieStoreDeleteOptions;
	EventSourceInit: EventSourceInit;
	FontFaceDescriptors: FontFaceDescriptors;
}

// ---------------------------------------------------------------------------
// type-level string helpers
// ---------------------------------------------------------------------------

type Whitespace = " " | "\n" | "\t";

type Trim<S extends string> = S extends `${Whitespace}${infer R}`
	? Trim<R>
	: S extends `${infer R}${Whitespace}`
		? Trim<R>
		: S;

/** Number of occurrences of `C` in `S`. */
type Count<
	S extends string,
	C extends string,
	N extends readonly 0[] = [],
> = S extends `${infer _}${C}${infer Rest}`
	? Count<Rest, C, [...N, 0]>
	: N["length"];

/**
 * Whether every `<` and `(` in `S` is closed. Used to tell a real ` or `
 * separator from one nested inside a parameterized type — `(long or
 * sequence<(DOMString or Blob)>)` has three ` or `s but only one of them is
 * the top-level separator.
 */
type Balanced<S extends string> =
	Count<S, "<"> extends Count<S, ">">
		? Count<S, "("> extends Count<S, ")">
			? true
			: false
		: false;

/** `"unsigned long size"` -> `["unsigned long", "size"]`, splitting on the *last* space. */
type SplitLastWord<
	S extends string,
	Head extends string = "",
> = S extends `${infer Word} ${infer Rest}`
	? SplitLastWord<Rest, Head extends "" ? Word : `${Head} ${Word}`>
	: [Head, S];

/** A bare identifier — no type punctuation, so it can only be an argument name. */
type IsPlainIdentifier<S extends string> = S extends ""
	? false
	: S extends `${string}${"<" | ">" | "(" | ")" | "?" | "," | "." | "[" | "]" | " "}${string}`
		? false
		: true;

/** The primitives whose *own* spelling contains a space. */
type MultiWordPrimitive =
	| "unsigned short"
	| "unsigned long"
	| "long long"
	| "unsigned long long"
	| "unrestricted float"
	| "unrestricted double";

/**
 * Drop a trailing argument name: `"USVString"` -> `"USVString"`.
 *
 * Has to be careful in three directions — `"unsigned long"` is a type whose
 * last word looks like a name, `"record<DOMString, DOMString>"` contains a
 * space that isn't a name boundary, and `"DOMString..."` has no name at all.
 */
type StripArgumentName<S extends string> = S extends MultiWordPrimitive
	? S
	: SplitLastWord<S> extends [
				infer Head extends string,
				infer Last extends string,
		  ]
		? Head extends ""
			? S
			: IsPlainIdentifier<Last> extends true
				? Balanced<Head> extends true
					? Trim<Head>
					: S
				: S
		: S;

/** `"[EnforceRange] unsigned long x"` -> `"unsigned long x"` */
type StripExtendedAttributes<S extends string> =
	S extends `[${string}]${infer Rest}` ? Trim<Rest> : S;

/** `"boolean async = true"` -> `"boolean async"` */
type StripDefault<S extends string> = S extends `${infer T} = ${string}`
	? Trim<T>
	: S;

type StripOptional<S extends string> = S extends `optional ${infer T}`
	? Trim<T>
	: S;

type StripVariadic<S extends string> = S extends `${infer T}...` ? Trim<T> : S;

// ---------------------------------------------------------------------------
// FromIDL — the resolver
// ---------------------------------------------------------------------------

/**
 * Marker returned for a name that resolves to nothing. It's a distinct branded
 * type rather than `unknown` so a typo shows up in the tooltip instead of
 * silently widening.
 */
export interface IDLUnresolved<Name extends string> {
	readonly __idlUnresolved: Name;
}

/**
 * Which way a value is crossing the IDL boundary.
 *
 * WebIDL's ES type mapping is written for values coming *in* — an argument
 * being converted to an IDL type — and that's the direction `"in"` models. A
 * return type is checked the other way round: the member hands a value back,
 * and the declaration only has to *accept* what it produces. TypeScript spells
 * two of those outbound types more loosely than the spec does, so checking a
 * return against the inbound resolution rejects correct code:
 *
 *   - `undefined` is `void`. A method with no `return` types as `void`, and
 *     lib.dom writes `Promise<void>` where the IDL says `Promise<undefined>`
 *     (`Cache.add`, `Cache.put`, ...). `void` is not assignable to `undefined`.
 *   - `sequence<T>` is `readonly T[]`. The spec's sequence is a fresh mutable
 *     array, but a member is free to hand back a readonly view of one, and
 *     lib.dom does exactly that for `Cache.matchAll` and `Cache.keys`.
 *     `readonly T[]` is not assignable to `T[]`.
 *
 * Both differences are widenings — every `T[]` is a `readonly T[]`, every
 * `undefined` is a `void` — so `"out"` accepts everything `"in"` does and
 * nothing beyond those two shapes.
 *
 * One caveat comes with the `undefined` -> `void` mapping: TypeScript lets a
 * function returning anything satisfy a `=> void` constraint, so a top-level
 * `@Returns("undefined")` stops constraining the return type. That is the same
 * hole every `=> void` constraint has, and it only opens at the top level —
 * inside `Promise<...>` the type argument is checked exactly.
 */
type IDLDirection = "in" | "out";

/**
 * Resolve a WebIDL type string to the TypeScript type it denotes.
 *
 * ```ts
 * FromIDL<"ByteString">                  // string
 * FromIDL<"ByteString?">                 // string | null
 * FromIDL<"unsigned long long">          // number
 * FromIDL<"sequence<USVString>">         // string[]
 * FromIDL<"Promise<undefined>">          // Promise<undefined>
 * FromIDL<"record<DOMString, any>">      // Record<string, any>
 * FromIDL<"(DOMString or Blob)?">        // string | Blob | null
 * FromIDL<"FrozenArray<Element>">        // readonly Element[]
 * ```
 *
 * Pass `"out"` for a type in return position — see {@link IDLDirection}.
 *
 * ```ts
 * FromIDL<"Promise<undefined>", "out">        // Promise<void>
 * FromIDL<"Promise<sequence<Response>>", "out">  // Promise<readonly Response[]>
 * ```
 */
export type FromIDL<
	S extends string,
	D extends IDLDirection = "in",
> = ResolveType<StripExtendedAttributes<Trim<S>>, D>;

type ResolveType<S extends string, D extends IDLDirection> =
	// nullable — anchored at the end, so `sequence<DOMString?>` isn't caught here
	S extends `${infer Inner}?`
		? ResolveType<Trim<Inner>, D> | null
		: // union
			S extends `(${infer Inner})`
			? Balanced<Inner> extends true
				? ResolveUnion<SplitUnionMembers<Trim<Inner>>, D>
				: IDLUnresolved<S>
			: // parameterized
				S extends `sequence<${infer T}>`
				? D extends "out"
					? readonly FromIDL<T, D>[]
					: FromIDL<T, D>[]
				: S extends `FrozenArray<${infer T}>`
					? readonly FromIDL<T, D>[]
					: // an ObservableArray is only ever an attribute's type, and its
						// setter takes a real mutable array, so it stays mutable both ways
						S extends `ObservableArray<${infer T}>`
						? FromIDL<T, D>[]
						: S extends `Promise<${infer T}>`
							? Promise<FromIDL<T, D>>
							: // a record's key type is a string type whichever way it's
								// crossing, so only the value follows the direction
								S extends `record<${infer K},${infer V}>`
								? Record<Extract<FromIDL<K>, PropertyKey>, FromIDL<V, D>>
								: ResolveName<S, D>;

/**
 * Split the inside of a union on top-level ` or `. Takes the leftmost ` or `
 * and only treats it as a separator once the accumulated left side is
 * balanced, otherwise it belongs to a nested type.
 */
type SplitUnionMembers<
	S extends string,
	Pending extends string = "",
	Acc extends readonly string[] = [],
> = S extends `${infer Head} or ${infer Rest}`
	? Balanced<`${Pending}${Head}`> extends true
		? SplitUnionMembers<Rest, "", [...Acc, `${Pending}${Head}`]>
		: SplitUnionMembers<Rest, `${Pending}${Head} or `, Acc>
	: [...Acc, `${Pending}${S}`];

/**
 * Whether `S` has a ` or ` at its own level — i.e. whether it is a union
 * written without its parentheses.
 *
 * Testing for ` or ` anywhere is not enough: `sequence<(Request or USVString)>`
 * is a perfectly parenthesized union nested inside a parameterized type, and
 * neither is checking for a leading `(`, which misses that same case.
 * {@link SplitUnionMembers} already knows how to tell a real separator from a
 * nested one, and it yields a single member exactly when there is none.
 */
type HasTopLevelUnion<S extends string> =
	SplitUnionMembers<S> extends readonly [string] ? false : true;

type ResolveUnion<
	M extends readonly string[],
	D extends IDLDirection,
> = M extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? FromIDL<H, D> | ResolveUnion<R, D>
	: never;

/**
 * Resolve an identifier. Primitives, then the hand-maintained table, then the
 * global scope — an interface's IDL name is its interface object's name, so
 * `"HTMLIFrameElement"` finds `typeof HTMLIFrameElement` and unwraps to the
 * instance type.
 */
type ResolveName<S extends string, D extends IDLDirection> = S extends
	| "undefined"
	| "void"
	? D extends "out"
		? void
		: undefined
	: S extends keyof IDLPrimitives
		? IDLPrimitives[S]
		: S extends keyof IDLNamedTypes
			? IDLNamedTypes[S]
			: S extends keyof GlobalThis
				? InterfaceInstance<GlobalThis[S]>
				: IDLUnresolved<S>;

type InterfaceInstance<Ctor> = Ctor extends abstract new (
	...args: never
) => infer I
	? I
	: Ctor extends { prototype: infer P }
		? P
		: Ctor;

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

/**
 * The names in `S` that don't resolve, or `never` if the whole string is
 * understood. Kept separate from {@link FromIDL} rather than sniffing the
 * result for {@link IDLUnresolved} — `FromIDL<"any">` is `any`, which absorbs
 * any such check.
 */
export type UnresolvedIDLNames<S extends string> = CheckType<
	StripExtendedAttributes<Trim<S>>
>;

type CheckType<S extends string> = S extends `${infer Inner}?`
	? CheckType<Trim<Inner>>
	: S extends `(${infer Inner})`
		? Balanced<Inner> extends true
			? CheckUnion<SplitUnionMembers<Trim<Inner>>>
			: S
		: S extends `sequence<${infer T}>`
			? UnresolvedIDLNames<T>
			: S extends `FrozenArray<${infer T}>`
				? UnresolvedIDLNames<T>
				: S extends `ObservableArray<${infer T}>`
					? UnresolvedIDLNames<T>
					: S extends `Promise<${infer T}>`
						? UnresolvedIDLNames<T>
						: S extends `record<${infer K},${infer V}>`
							? UnresolvedIDLNames<K> | UnresolvedIDLNames<V>
							: S extends
										| keyof IDLPrimitives
										| keyof IDLNamedTypes
										| keyof GlobalThis
								? never
								: // a top-level ` or ` this far down means the parentheses
									// were left off, which is easy to do when copying a
									// member's IDL out of a spec, where it's written inline
									HasTopLevelUnion<S> extends true
									? `${S}  <- a union needs parentheses: "(${S})"`
									: S;

type CheckUnion<M extends readonly string[]> = M extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? UnresolvedIDLNames<H> | CheckUnion<R>
	: never;

/**
 * What a decorator factory returns when one of its IDL strings is garbage.
 * It has no call signature, so the decorator position reports
 * `This expression is not callable` and the tooltip names the bad type.
 */
export interface IDLTypeError<Name extends string> {
	readonly __unknownWebIDLType: Name;
}

/** `Decorator` when every name in `S` resolves, an {@link IDLTypeError} otherwise. */
type Checked<S extends string, Decorator> = [UnresolvedIDLNames<S>] extends [
	never,
]
	? Decorator
	: IDLTypeError<UnresolvedIDLNames<S>>;

/** As {@link Checked}, but over a whole argument list. */
type CheckedAll<A extends readonly string[], Decorator> = [
	UnresolvedIDLArgumentNames<A[number]>,
] extends [never]
	? Decorator
	: IDLTypeError<UnresolvedIDLArgumentNames<A[number]>>;

/** An argument declaration with `optional` and any extended attributes removed. */
type ArgumentBody<S extends string> = StripOptional<
	StripExtendedAttributes<Trim<S>>
>;

/**
 * As {@link UnresolvedIDLNames}, but for a whole argument *declaration* rather
 * than a bare type — `@Arguments` is given things like `"optional DOMString"`
 * and `"USVString..."`, neither of which is a type.
 * {@link ArgumentType} reduces one to the type it declares.
 */
export type UnresolvedIDLArgumentNames<S extends string> =
	// the missing-parentheses case has to be caught before the argument name is
	// stripped, or the suggested spelling comes back mangled: the name-stripper
	// reads the last word of `TrustedHTML or DOMString` as an argument name
	HasTopLevelUnion<ArgumentBody<S>> extends true
		? `${ArgumentBody<S>}  <- a union needs parentheses: "(${ArgumentBody<S>})"`
		: UnresolvedIDLNames<ArgumentType<S>>;

// ---------------------------------------------------------------------------
// argument lists
// ---------------------------------------------------------------------------

/** `"optional [Clamp] unsigned long n = 0"` -> `"unsigned long"` */
export type ArgumentType<S extends string> = StripVariadic<
	StripArgumentName<
		StripDefault<StripExtendedAttributes<StripOptional<Trim<S>>>>
	>
>;

type IsOptionalArg<S extends string> =
	StripExtendedAttributes<Trim<S>> extends `optional ${string}` ? true : false;

type IsVariadicArg<S extends string> =
	StripArgumentName<
		StripDefault<StripExtendedAttributes<StripOptional<Trim<S>>>>
	> extends `${string}...`
		? true
		: false;

/**
 * Turn a list of WebIDL argument declarations into a TS parameter tuple.
 *
 * Argument names and defaults are tolerated so a declaration can be pasted
 * straight out of a spec, but neither is read — the name is discarded, and a
 * default only marks the argument optional, which `optional` already did. By
 * convention call sites write neither: the name lives on the method parameter
 * and the default lives in the method signature, where they actually do
 * something.
 *
 * ```ts
 * IDLArguments<["ByteString", "USVString"]>
 * //   [string, string]
 * IDLArguments<["ByteString", "USVString", "optional boolean"]>
 * //   [string, string, (boolean | undefined)?]
 * IDLArguments<["USVString... urls"]>
 * //   string[]
 * ```
 *
 * WebIDL forbids a required argument after an optional one, so once an
 * `optional` is seen the whole remaining tail is optional — which is exactly
 * `Partial` over the mapped tail.
 */
export type IDLArguments<A extends readonly string[]> = A extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? IsVariadicArg<H> extends true
		? FromIDL<ArgumentType<H>>[]
		: IsOptionalArg<H> extends true
			? Partial<MapArguments<A>>
			: [FromIDL<ArgumentType<H>>, ...IDLArguments<R>]
	: [];

type MapArguments<A extends readonly string[]> = {
	-readonly [K in keyof A]: FromIDL<ArgumentType<Extract<A[K], string>>>;
};

// ---------------------------------------------------------------------------
// decorators
// ---------------------------------------------------------------------------

/**
 * The IDL a member declared about itself, recorded for whatever installs the
 * interceptor — argument coercion, overload dispatch, arity errors.
 */
export type IDLMemberSignature = {
	/** one entry per declared argument, verbatim */
	arguments?: readonly string[];
	/** operation return type */
	returns?: string;
	/** attribute type */
	type?: string;
	/** this member is the interface's constructor, whatever it is named */
	construct?: boolean;
};

// keyed on the function object rather than `context.metadata`, which swc
// doesn't implement for 2022-03 decorators
const signatures = new _WeakMap([]) as WeakMap<AnyFunction, IDLMemberSignature>;

function record(fn: AnyFunction, patch: IDLMemberSignature) {
	const existing = signatures.get(fn);
	if (existing) {
		signatures.set(fn, { ...existing, ...patch });
	} else {
		signatures.set(fn, patch);
	}
}

/**
 * The IDL declared on `fn` by the decorators above, if any. `fn` is the raw
 * method / getter / setter off the interceptor's prototype — read it out of a
 * property descriptor, not off the instance.
 */
export function idlSignature(fn: AnyFunction): IDLMemberSignature | undefined {
	return signatures.get(fn);
}

/**
 * Mark a static member as the interface's constructor, and declare the
 * constructor's argument types. This is {@link Arguments} plus the tag — a
 * constructor never wants one without the other.
 *
 * A class body can only have one `constructor`, and TypeScript refuses to
 * decorate it (TS1206: decorators are not valid here), which is why the
 * constructor is declared as an ordinary static and tagged instead. The name
 * is arbitrary — `Intercept` finds it by the tag and installs it as a construct
 * trap on the interface object rather than as a member on the prototype.
 *
 * It has to be `static` so `this` types as the class constructor, which is what
 * makes `new this(...)` typecheck. At runtime `this` is the *native*
 * constructor, so `new this(...)` reaches the real one without going back
 * through the proxy.
 *
 * ```ts
 * @Constructor("optional DOMString")
 * static konstructor(src?: string) {
 *   return new this(client.rewriteUrl(src));
 * }
 * ```
 *
 * Returning nothing constructs normally with the arguments as coerced here,
 * which is usually what you want once they've been checked.
 */
export function Constructor<const A extends readonly string[]>(
	...types: A
): CheckedAll<
	A,
	<This, Value extends (...args: IDLArguments<A>) => any>(
		value: Value,
		context: ClassMethodDecoratorContext<This, Value>
	) => void
> {
	return ((value: AnyFunction) => {
		record(value, { arguments: types, construct: true });
	}) as never;
}

/** Whether `fn` was tagged {@link Constructor}. */
export function isConstructorMember(fn: unknown): boolean {
	return (
		typeof fn === "function" &&
		signatures.get(fn as AnyFunction)?.construct === true
	);
}

/**
 * Declare an operation's argument types.
 *
 * ```ts
 * @Arguments("ByteString", "USVString")
 * override open(method, url) { ... }
 * ```
 *
 * Constrains the decorated method to accept {@link IDLArguments} of what was
 * declared, so the declaration can't drift from the signature `Interceptor`
 * inherited from the real interface.
 */
export function Arguments<const A extends readonly string[]>(
	...types: A
): CheckedAll<
	A,
	<This, Value extends (...args: IDLArguments<A>) => any>(
		value: Value,
		context: ClassMethodDecoratorContext<This, Value>
	) => void
> {
	return ((value: AnyFunction) => {
		record(value, { arguments: types });
	}) as never;
}

/**
 * Declare an operation's return type.
 *
 * ```ts
 * @Returns("ByteString?")
 * override getResponseHeader(name) { ... }
 * ```
 *
 * The declared type only has to *accept* what the member returns, so it is
 * resolved in the `"out"` direction — see {@link IDLDirection}.
 */
export function Returns<const S extends string>(
	type: S
): Checked<
	S,
	<This, Value extends (...args: never) => FromIDL<S, "out">>(
		value: Value,
		context: ClassMethodDecoratorContext<This, Value>
	) => void
> {
	return ((value: AnyFunction) => {
		record(value, { returns: type });
	}) as never;
}

/**
 * Declare an attribute's type. Goes on the getter, the setter, or both.
 *
 * ```ts
 * @Type("USVString")
 * override get responseURL() { ... }
 * ```
 */
export function Type<const S extends string>(
	type: S
): Checked<
	S,
	{
		<This, Value extends FromIDL<S>>(
			value: (this: This) => Value,
			context: ClassGetterDecoratorContext<This, Value>
		): void;
		<This, Value extends FromIDL<S>>(
			value: (this: This, value: Value) => void,
			context: ClassSetterDecoratorContext<This, Value>
		): void;
	}
> {
	return ((value: AnyFunction) => {
		record(value, { type });
	}) as never;
}

// ---------------------------------------------------------------------------
// runtime validation and coercion
//
// The type layer above checks the IDL against the TS signature at build time.
// This is the other half: at call time, coerce a real argument list per the
// same declarations.
//
// Why this exists at all: ES-to-IDL conversion invokes page code (`toString`,
// `valueOf`, `Symbol.iterator`). If an interceptor body reads an argument raw
// and then hands that same raw value to the native, the page's code runs twice
// where a real browser runs it once — observable as a fingerprint, and
// exploitable, because the second call can return something other than what we
// validated and rewrote. Coercing up front means the body only ever sees
// primitives, and the native only ever sees what the body approved.
//
// https://webidl.spec.whatwg.org/#es-type-mapping
// ---------------------------------------------------------------------------

/**
 * Coerces `args` in place and returns whether they satisfy the declared IDL.
 *
 * `false` delegates a rejection to the native, retaining any converted
 * arguments. Composite conversions throw instead: retrying the original
 * iterable or record would run page code again and could succeed on retry.
 */
export type IDLValidator = (args: unknown[]) => boolean;

/** Just the slice of `SingletonBox` needed to brand-check interface arguments. */
export type IDLBrandChecker = {
	ctors: Record<string, unknown>;
	instanceof(value: unknown, name: string): boolean;
};

/** Converts one argument, or calls `idlReject`. */
type IDLCoerce = (value: unknown) => unknown;

type IDLParameter = {
	optional: boolean;
	variadic: boolean;
	coerce: IDLCoerce;
};

/**
 * Thrown by a coercer to unwind out of a conversion. Deliberately not an Error
 * — it must be distinguishable from a genuine throw out of page code, which
 * has to propagate rather than being turned into a fall-through.
 *
 * `converted` carries how far the conversion got before it gave up, for the
 * coercers that have to run page code to find out that the value is invalid.
 * See {@link idlRejectPartial}.
 */
const IDL_REJECTED = {
	scramjet: "idl-rejected",
	/** whether {@link converted} was set by the throw being unwound */
	partial: false,
	converted: undefined as unknown,
};

function idlReject(): never {
	IDL_REJECTED.partial = false;
	IDL_REJECTED.converted = undefined;

	throw IDL_REJECTED;
}

/**
 * Reject, but hand back the intermediate the conversion had already produced.
 *
 * `ByteString`, `float` and `double` all have to finish an ES conversion -
 * `ToString`, `ToNumber` - before they can tell that the result is out of
 * range, and those run page code. The validator writes this value back over
 * the argument so that the native, which is about to convert the same list
 * again, rejects the *primitive* rather than re-entering the page's
 * `toString`. Converting a primitive runs nothing, and the error the native
 * raises is the same one either way.
 */
function idlRejectPartial(converted: unknown): never {
	IDL_REJECTED.partial = true;
	IDL_REJECTED.converted = converted;

	throw IDL_REJECTED;
}

/**
 * A composite conversion cannot safely fall back to native conversion of its
 * original input. Preserve page exceptions, but turn our rejection sentinel
 * into a TypeError before it can reach the argument validator's fallback.
 */
function idlRejectInner(err: unknown): never {
	if (err === IDL_REJECTED) {
		IDL_REJECTED.partial = false;
		IDL_REJECTED.converted = undefined;
		throw new TypeError("Invalid value in Web IDL sequence or record.");
	}

	throw err;
}

/** The primitives whose own spelling contains a space. */
const IDL_MULTIWORD_PRIMITIVES = [
	"unsigned short",
	"unsigned long",
	"long long",
	"unsigned long long",
	"unrestricted float",
	"unrestricted double",
];

const idlPassthrough: IDLCoerce = (value) => value;

/**
 * Compile a declared IDL argument list into a validator.
 *
 * Compile once when the member is installed, never per call — the result
 * closes over a prebuilt array of coercers, but building it parses IDL.
 *
 * ```ts
 * const validate = compileIDLValidator(client.box, [
 *   "ByteString",
 *   "USVString",
 *   "optional boolean async = true",
 * ]);
 * if (!validate(args)) return Function_apply(native, that, args);
 * ```
 */
export function compileIDLValidator(
	box: IDLBrandChecker,
	idl: readonly string[]
): IDLValidator {
	const params: IDLParameter[] = [];
	// WebIDL forbids a required argument after an optional one, so the required
	// count is just the position of the last non-optional
	let required = 0;

	for (let i = 0; i < idl.length; i++) {
		const param = parseIDLArgument(box, idl[i]);
		params[i] = param;
		if (!param.optional && !param.variadic) required = i + 1;
	}

	return (args: unknown[]) => {
		if (args.length < required) return false;

		// Nothing is restored on the way out. A coercion that throws never
		// assigns, so the rejected argument and everything after it are still
		// exactly as the page wrote them, and the ones before it hold converted
		// *primitives*. Handing those to the native is what keeps a hostile
		// `valueOf` to one call: re-converting an already-converted value runs
		// no page code, where restoring the original would run it a second time.
		// That double call is observable, and the second answer need not match
		// the first, which is the whole reason this front-runs the conversion.
		let rejected = -1;

		try {
			for (let i = 0; i < params.length; i++) {
				const param = params[i];

				if (param.variadic) {
					for (let j = i; j < args.length; j++) {
						rejected = j;
						args[j] = param.coerce(args[j]);
					}

					return true;
				}

				if (i >= args.length) return true;
				// an optional argument explicitly passed as undefined is "not
				// present" per spec, and the native fills in the IDL default.
				// coercing would turn that into a real value and lose the default
				if (param.optional && args[i] === undefined) continue;

				rejected = i;
				args[i] = param.coerce(args[i]);
			}

			return true;
		} catch (err) {
			// a throw out of the page's own toString/valueOf is not a rejection;
			// it's the call's real outcome and has to keep going up
			if (err !== IDL_REJECTED) throw err;

			// the coercer got as far as a primitive before it gave up. leave that
			// behind rather than the original, so the native rejects it without
			// re-running the conversion that produced it
			if (IDL_REJECTED.partial && rejected !== -1) {
				args[rejected] = IDL_REJECTED.converted;
			}
			IDL_REJECTED.partial = false;
			IDL_REJECTED.converted = undefined;

			return false;
		}
	};
}

/**
 * The validator for one interceptor member, or `undefined` if it declared no
 * IDL. Pass `setter` for the write half of an attribute, whose single argument
 * is the attribute's own `@Type`.
 */
export function memberValidator(
	box: IDLBrandChecker,
	fn: AnyFunction | undefined,
	setter?: boolean
): IDLValidator | undefined {
	if (!fn) return undefined;

	const signature = signatures.get(fn);
	if (!signature) return undefined;

	if (setter) {
		return signature.type
			? compileIDLValidator(box, [signature.type])
			: undefined;
	}

	return signature.arguments
		? compileIDLValidator(box, signature.arguments)
		: undefined;
}

// --- IDL string parsing, the runtime mirror of the type layer above ---------

function idlBalanced(s: string): boolean {
	let depth = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "<" || c === "(") depth++;
		else if (c === ">" || c === ")") depth--;
	}

	return depth === 0;
}

/** A bare identifier, so it can only be an argument name and not part of a type. */
function idlPlainIdentifier(s: string): boolean {
	if (!s) return false;

	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (
			c === "<" ||
			c === ">" ||
			c === "(" ||
			c === ")" ||
			c === "?" ||
			c === "," ||
			c === "." ||
			c === "[" ||
			c === "]"
		) {
			return false;
		}
	}

	return true;
}

/** `"[EnforceRange] unsigned long x"` -> `"unsigned long x"` */
function stripIDLExtendedAttributes(s: string): string {
	if (s[0] !== "[") return s;

	const end = s.indexOf("]");
	if (end === -1) return s;

	return s.slice(end + 1).trim();
}

function hasIDLExtendedAttribute(s: string, name: string): boolean {
	if (s[0] !== "[") return false;

	const end = s.indexOf("]");

	return end !== -1 && s.slice(1, end).indexOf(name) !== -1;
}

/**
 * Interfaces a union member may name that an engine is allowed not to have.
 *
 * `box.ctors` is built from every function-valued global, so a name missing
 * from it is a name this realm does not have. But a name can also be missing
 * because it is a dictionary or an enum - which have no interface object, and
 * whose disambiguation needs type information the declaration does not carry -
 * and dropping one of *those* would send an object down the string member and
 * stringify it. So only the names listed here are dropped on sight.
 *
 * Trusted types is the whole list today, and it is the one that matters:
 * `(TrustedHTML or [LegacyNullToEmptyString] DOMString)` is the type of
 * `innerHTML`, `outerHTML`, `srcdoc` and `document.write`, and abandoning the
 * union took `[LegacyNullToEmptyString]` down with the brand check - so
 * `el.innerHTML = null` wrote the text "null" on every engine without trusted
 * types where it should have cleared the element.
 */
const IDL_OPTIONAL_INTERFACES = [
	"TrustedHTML",
	"TrustedScript",
	"TrustedScriptURL",
];

/** The string types, the only ones a union can fall back to unambiguously. */
const IDL_STRING_TYPES = [
	"DOMString",
	"ByteString",
	"USVString",
	"CSSOMString",
];

/** Split the inside of a union on top-level ` or `. */
function splitIDLUnionMembers(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;

	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "<" || c === "(") depth++;
		else if (c === ">" || c === ")") depth--;
		else if (depth === 0 && c === " " && s.slice(i, i + 4) === " or ") {
			out[out.length] = s.slice(start, i);
			i += 3;
			start = i + 1;
		}
	}
	out[out.length] = s.slice(start);

	return out;
}

/**
 * The general IDL union algorithm needs the full type of every member, but the
 * shape that actually shows up in the sinks we intercept is
 * `(SomeInterface or DOMString)` — `innerHTML`, `srcdoc`, `document.write` and
 * friends are all `(TrustedHTML or DOMString)`. That one is unambiguous: brand
 * check each interface member in order, and anything else is the string.
 *
 * This is worth doing rather than passing through, because these are exactly
 * the members whose bodies stringify the value and then hand it to the native.
 * Without coercion here, a hostile `toString` runs twice and the second call
 * can return markup the rewriter never saw.
 *
 * Anything more complicated than one string member falls back to passthrough.
 */
function compileIDLUnion(box: IDLBrandChecker, inner: string): IDLCoerce {
	const members = splitIDLUnionMembers(inner);
	const interfaces: string[] = [];
	let fallback: IDLCoerce | undefined;

	for (let i = 0; i < members.length; i++) {
		const raw = members[i].trim();
		const name = stripIDLExtendedAttributes(raw);

		if (IDL_STRING_TYPES.indexOf(name) !== -1) {
			// two string members can't be told apart, so give up
			if (fallback) return idlPassthrough;
			fallback = compileIDLType(box, raw);
			continue;
		}

		if (box.ctors[name]) {
			interfaces[interfaces.length] = name;
			continue;
		}

		// an interface this realm does not have at all: nothing can be an
		// instance of it, so the member is dropped and the rest of the union
		// still gets converted
		if (IDL_OPTIONAL_INTERFACES.indexOf(name) !== -1) continue;

		// a dictionary, enum, sequence, numeric or unknown member — the spec's
		// disambiguation rules for those need more type information than we have
		return idlPassthrough;
	}

	if (!fallback) return idlPassthrough;

	const stringify = fallback;

	return (value) => {
		for (let i = 0; i < interfaces.length; i++) {
			if (box.instanceof(value, interfaces[i])) return value;
		}

		return stringify(value);
	};
}

/**
 * Drop a trailing argument name: `"USVString"` -> `"USVString"`.
 *
 * Careful in three directions — `"unsigned long"` is a type whose last word
 * looks like a name, `"record<DOMString, DOMString>"` has a space that isn't a
 * name boundary, and `"DOMString..."` has no name at all.
 */
function stripIDLArgumentName(s: string): string {
	if (IDL_MULTIWORD_PRIMITIVES.indexOf(s) !== -1) return s;

	const space = s.lastIndexOf(" ");
	if (space <= 0) return s;

	const head = s.slice(0, space);
	if (!idlPlainIdentifier(s.slice(space + 1))) return s;
	if (!idlBalanced(head)) return s;

	return head.trim();
}

function parseIDLArgument(
	box: IDLBrandChecker,
	declaration: string
): IDLParameter {
	const raw = declaration.trim();
	// the attribute has to be read before it is stripped. it can't be left on
	// for compileIDLType, because stripIDLArgumentName would then mistake the
	// last word of `[Clamp] unsigned long` for an argument name
	let nullToEmpty = hasIDLExtendedAttribute(raw, "LegacyNullToEmptyString");
	let enforceRange = hasIDLExtendedAttribute(raw, "EnforceRange");
	let clamp = hasIDLExtendedAttribute(raw, "Clamp");
	let s = stripIDLExtendedAttributes(raw);

	let optional = false;
	if (s.startsWith("optional ")) {
		optional = true;
		nullToEmpty ||= hasIDLExtendedAttribute(
			s.slice(9).trim(),
			"LegacyNullToEmptyString"
		);
		enforceRange ||= hasIDLExtendedAttribute(s.slice(9).trim(), "EnforceRange");
		clamp ||= hasIDLExtendedAttribute(s.slice(9).trim(), "Clamp");
		s = stripIDLExtendedAttributes(s.slice(9).trim());
	}

	const defaulted = s.indexOf(" = ");
	if (defaulted !== -1) {
		optional = true;
		s = s.slice(0, defaulted).trim();
	}

	s = stripIDLArgumentName(s);

	let variadic = false;
	if (s.endsWith("...")) {
		variadic = true;
		s = s.slice(0, -3).trim();
	}

	return {
		optional,
		variadic,
		coerce: compileIDLType(box, s, nullToEmpty, enforceRange, clamp),
	};
}

function compileIDLType(
	box: IDLBrandChecker,
	idl: string,
	inheritedNullToEmpty?: boolean,
	enforceRange?: boolean,
	inheritedClamp?: boolean
): IDLCoerce {
	const raw = idl.trim();
	// https://webidl.spec.whatwg.org/#Clamp
	const clamp = inheritedClamp || hasIDLExtendedAttribute(raw, "Clamp");
	// https://webidl.spec.whatwg.org/#LegacyNullToEmptyString — null becomes ""
	// instead of "null". `innerHTML = null` clearing an element rather than
	// writing the text "null" is this attribute, so it is not cosmetic
	const nullToEmpty =
		inheritedNullToEmpty ||
		hasIDLExtendedAttribute(raw, "LegacyNullToEmptyString");
	const s = stripIDLExtendedAttributes(raw);

	if (s.endsWith("?")) {
		const inner = compileIDLType(
			box,
			s.slice(0, -1),
			nullToEmpty,
			enforceRange,
			clamp
		);

		return (value) =>
			value === null || value === undefined ? null : inner(value);
	}

	if (s[0] === "(" && s.endsWith(")")) {
		return compileIDLUnion(box, s.slice(1, -1));
	}

	// Promise<T> conversion is just "resolve it", which the native does anyway
	if (s.startsWith("Promise<")) return idlPassthrough;

	const generic = s.indexOf("<");
	if (generic !== -1 && s.endsWith(">")) {
		const name = s.slice(0, generic);
		const parameters = s.slice(generic + 1, -1);

		if (
			name === "sequence" ||
			name === "FrozenArray" ||
			name === "ObservableArray"
		) {
			const item = compileIDLType(box, parameters);

			return (value) => coerceIDLSequence(value, item);
		}

		if (name === "record") {
			// the key is always a string type, so the first comma is the split
			const comma = parameters.indexOf(",");
			if (comma !== -1) {
				const key = compileIDLType(box, parameters.slice(0, comma));
				const item = compileIDLType(box, parameters.slice(comma + 1));

				return (value) => coerceIDLRecord(value, key, item);
			}
		}

		return idlPassthrough;
	}

	const primitive = IDL_PRIMITIVE_COERCERS[s];
	if (primitive) {
		// https://webidl.spec.whatwg.org/#Clamp — the value is pinned to the
		// type's range rather than reduced modulo it, and only then rounded.
		// Without this the attribute parsed and then did nothing, so the
		// ordinary modular coercion ran: `ws.close(70000)` wrapped to 4464,
		// which is inside the allowed close-code range, where clamping to
		// 65535 is outside it and owes the page an InvalidAccessError.
		if (clamp) {
			const bounds = IDL_CLAMP_BOUNDS[s];
			if (bounds) return (value) => clampToIDLInteger(value, bounds);
		}

		// EnforceRange failures must throw after a single ToNumber. A validator
		// rejection delegates to the native binding and would otherwise repeat a
		// page-controlled valueOf(), so leave this conversion entirely to native.
		// https://webidl.spec.whatwg.org/#EnforceRange
		if (enforceRange) return idlPassthrough;

		// the extended attribute is only ever spec'd on string types
		if (nullToEmpty && IDL_STRING_TYPES.indexOf(s) !== -1) {
			return (value) => (value === null ? "" : primitive(value));
		}

		return primitive;
	}

	// an interface type is a brand check, not a conversion, so no page code runs
	if (box.ctors[s]) {
		return (value) => (box.instanceof(value, s) ? value : idlReject());
	}

	// a dictionary, enum, callback, typedef or something we don't model. the
	// native still enforces it, we just can't front-run the conversion
	return idlPassthrough;
}

// --- the conversions themselves --------------------------------------------

/** https://webidl.spec.whatwg.org/#es-DOMString */
function toIDLDOMString(value: unknown): string {
	// String(symbol) is special-cased to succeed in JS, but IDL says throw
	if (typeof value === "symbol") idlReject();

	return String(value);
}

/** https://webidl.spec.whatwg.org/#es-USVString — lone surrogates become U+FFFD */
function toIDLScalarValueString(s: string): string {
	let surrogate = false;
	for (let i = 0; i < s.length; i++) {
		const c = String_charCodeAt(s, i);
		if (c >= 0xd800 && c <= 0xdfff) {
			surrogate = true;
			break;
		}
	}
	if (!surrogate) return s;

	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = String_charCodeAt(s, i);

		if (c < 0xd800 || c > 0xdfff) {
			out += String_fromCharCode(c);
			continue;
		}

		if (c <= 0xdbff && i + 1 < s.length) {
			const low = String_charCodeAt(s, i + 1);
			if (low >= 0xdc00 && low <= 0xdfff) {
				out += String_fromCharCode(c, low);
				i++;
				continue;
			}
		}

		out += "�";
	}

	return out;
}

/**
 * https://webidl.spec.whatwg.org/#js-long-long — 32 bits and under fall out of
 * the bitwise operators, but 64 needs real modular arithmetic.
 */
// Unary + implements ToNumber, including rejecting BigInt primitives produced
// by objects. Number(value) would accept them.
// https://tc39.es/ecma262/#sec-tonumber
function toIDLInt64(value: unknown, signed: boolean): number {
	let x = +(value as number);
	// covers NaN and both infinities
	if (!Number_isFinite(x)) return 0;

	x = Math_trunc(x);
	if (x === 0) return 0;

	const big = BigInt(x);

	return Number(signed ? BigInt_asIntN(64, big) : BigInt_asUintN(64, big));
}

/** Whether `value` is an Object in the ES sense, which a callable also is. */
function idlIsObject(value: unknown): boolean {
	return (
		value !== null && (typeof value === "object" || typeof value === "function")
	);
}

function coerceIDLSequence(value: unknown, item: IDLCoerce): unknown[] {
	try {
		if (!idlIsObject(value)) idlReject();

		const method = (value as any)[Symbol_iterator];
		if (typeof method !== "function") idlReject();

		const iterator = Reflect_apply(method, value, []) as any;
		if (!idlIsObject(iterator)) idlReject();

		// GetIterator reads `next` once, when it builds the iterator record, and
		// calls that same function for every step. Looking it up per step instead
		// is observable on a page-controlled iterator with an accessor `next`
		const next = iterator.next;
		if (typeof next !== "function") idlReject();

		const out: unknown[] = [];

		for (;;) {
			const step = Reflect_apply(next, iterator, []) as any;
			// IteratorNext: a result that is not an Object is a TypeError, not the
			// end of the iteration. Reading `done` off a primitive answers
			// undefined, which left this spinning forever on `{ next: () => 0 }`
			if (!idlIsObject(step)) idlReject();
			if (step.done) break;

			// not out.push — Array.prototype is page-reachable
			out[out.length] = item(step.value);
		}

		return out;
	} catch (err) {
		idlRejectInner(err);
	}
}

function coerceIDLRecord(
	value: unknown,
	key: IDLCoerce,
	item: IDLCoerce
): Record<string, unknown> {
	try {
		if (!idlIsObject(value)) idlReject();

		const keys = Reflect_ownKeys(value as object);
		const out: Record<string, unknown> = {};

		for (let i = 0; i < keys.length; i++) {
			// https://webidl.spec.whatwg.org/#es-record
			const desc = Object_getOwnPropertyDescriptor(value, keys[i]);
			if (!desc?.enumerable) continue;
			// Convert the key before reading and converting its value.
			const typedKey = key(keys[i]) as string;
			// CreateDataProperty preserves __proto__ and bypasses inherited setters.
			// https://webidl.spec.whatwg.org/#es-record
			const descriptor = {
				__proto__: null,
				value: item((value as any)[keys[i]]),
				writable: true,
				enumerable: true,
				configurable: true,
			};
			Object_defineProperty(out, typedKey, descriptor);
		}

		return out;
	} catch (err) {
		idlRejectInner(err);
	}
}

/**
 * The inclusive range of each integer type, for {@link clampToIDLInteger}.
 * https://webidl.spec.whatwg.org/#idl-integer-types
 */
const IDL_CLAMP_BOUNDS: Record<string, [number, number]> = {
	byte: [-128, 127],
	octet: [0, 255],
	short: [-32768, 32767],
	"unsigned short": [0, 65535],
	long: [-2147483648, 2147483647],
	"unsigned long": [0, 4294967295],
	// a double cannot represent either 64-bit bound exactly, and writing them
	// as literals is a `no-loss-of-precision` error for exactly that reason.
	// The rounding is not observable: every value close enough to a bound to
	// be clamped is already past the point where doubles are spaced more than
	// one apart, so the clamp and the conversion agree
	"long long": [-(2 ** 63), 2 ** 63 - 1],
	"unsigned long long": [0, 2 ** 64 - 1],
};

/**
 * https://webidl.spec.whatwg.org/#abstract-opdef-converttoint, the `[Clamp]`
 * branch: ToNumber, NaN to +0, pin to the type's range, then round to the
 * nearest integer - choosing the *even* one on an exact half, which is not
 * what `Math.round` does.
 */
export function clampToIDLInteger(
	value: unknown,
	bounds: [number, number]
): number {
	let x = +(value as number);
	if (Number_isNaN(x)) return 0;

	if (x < bounds[0]) x = bounds[0];
	else if (x > bounds[1]) x = bounds[1];

	const floor = Math_floor(x);
	const fraction = x - floor;
	if (fraction > 0.5) return floor + 1;
	if (fraction < 0.5) return floor;

	// exactly halfway: round to even
	return floor % 2 === 0 ? floor : floor + 1;
}

const idlRestrictedDouble: IDLCoerce = (value) => {
	const x = +(value as number);
	// the number, not the original: ToNumber has already run the page's
	// `valueOf` and the native is about to convert this same argument
	if (!Number_isFinite(x)) idlRejectPartial(x);

	return x;
};

/**
 * https://webidl.spec.whatwg.org/#js-type-mapping
 *
 * Typed on `keyof IDLPrimitives` so that a name the decorators accept cannot
 * be missing a conversion. `DOMHighResTimeStamp` was: it resolved at the type
 * level, so `expires: "DOMHighResTimeStamp? = null"` type-checked, and then
 * fell through to `idlPassthrough` at run time and wrote `Max-Age=NaN` where
 * the `double` conversion owes the page a TypeError.
 */
const IDL_PRIMITIVE_COERCERS: Record<keyof IDLPrimitives, IDLCoerce> &
	Record<string, IDLCoerce> = {
	any: idlPassthrough,
	undefined: () => undefined,
	// legacy spelling, still in a few unmigrated specs
	void: () => undefined,

	boolean: (value) => !!value,

	// the bitwise operators already implement ToInt32/ToUint32, which is exactly
	// the spec's ToNumber -> NaN and infinities to 0 -> truncate -> modulo 2^n.
	// each runs ToNumber exactly once
	byte: (value: any) => (value << 24) >> 24,
	octet: (value: any) => value & 0xff,
	short: (value: any) => (value << 16) >> 16,
	"unsigned short": (value: any) => value & 0xffff,
	long: (value: any) => value | 0,
	"unsigned long": (value: any) => value >>> 0,
	"long long": (value) => toIDLInt64(value, true),
	"unsigned long long": (value) => toIDLInt64(value, false),

	float: (value) => {
		const x = +(value as number);
		if (!Number_isFinite(x)) idlRejectPartial(x);

		const rounded = Math_fround(x);
		// a finite double can still round out of single-precision range
		if (!Number_isFinite(rounded)) idlRejectPartial(x);

		return rounded;
	},
	"unrestricted float": (value) => Math_fround(+(value as number)),
	double: idlRestrictedDouble,
	"unrestricted double": (value) => +(value as number),
	// hr-time's typedef for `double`, and restricted like it
	DOMHighResTimeStamp: idlRestrictedDouble,

	bigint: (value) => {
		// ToBigInt, which the `BigInt` constructor is not. They agree on every
		// primitive and part company on an object: ToBigInt runs ToPrimitive
		// and throws a TypeError for a Number result, where `BigInt(object)`
		// reaches NumberToBigInt and throws a RangeError for a non-integer one.
		// ToPrimitive cannot be run here without running the page's code, so an
		// object goes to the native, which performs the authentic conversion
		if (idlIsObject(value)) idlReject();
		// ToBigInt rejects Numbers, unlike the BigInt constructor
		if (typeof value === "number") idlReject();

		return BigInt(value as any);
	},

	DOMString: (value) => toIDLDOMString(value),
	CSSOMString: (value) => toIDLDOMString(value),
	USVString: (value) => toIDLScalarValueString(toIDLDOMString(value)),
	ByteString: (value) => {
		const s = toIDLDOMString(value);
		for (let i = 0; i < s.length; i++) {
			// the string, not the original: `toIDLDOMString` has already run the
			// page's `toString` and the native would otherwise run it again
			if (String_charCodeAt(s, i) > 0xff) idlRejectPartial(s);
		}

		return s;
	},

	object: (value) => {
		if (
			value === null ||
			(typeof value !== "object" && typeof value !== "function")
		) {
			idlReject();
		}

		return value;
	},
	symbol: (value) => (typeof value === "symbol" ? value : idlReject()),

	// The buffer typedefs discriminate on internal slots, which is a brand
	// check and not a conversion, and the native binding performs it either
	// way. Listed so the table stays exhaustive over `IDLPrimitives` rather
	// than reaching passthrough by falling off the end of it.
	BufferSource: idlPassthrough,
	BinaryData: idlPassthrough,
	AllowSharedBufferSource: idlPassthrough,
	ArrayBufferView: idlPassthrough,
};

// ---------------------------------------------------------------------------
// conversions for a member that reimplements rather than delegates
//
// `compileIDLValidator` front-runs the ES-to-IDL conversion so an interceptor
// body only ever sees converted values — but it can't do that for a dictionary
// argument. Telling `{name: x}` from `{name: y}` needs the dictionary's own
// member types, which the decorator's string doesn't carry, so a dictionary is
// passed through raw and the native binding converts it.
//
// That works for a body that hands the dictionary onward. A body that reads
// the members itself and never calls the native — `CookieStore`, whose whole
// state lives in the cookie jar rather than in the browser — has no native
// conversion to inherit, so it has to run these itself.
//
// They throw a real TypeError rather than the validator's rejection sentinel:
// a rejection means "let the native throw the authentic error instead", and
// here there is no native call left to delegate to.
//
// The one rule that matters when calling these: a dictionary member is a
// page-controlled getter, so read it into a local exactly once, and read the
// members in the order WebIDL converts them (lexicographic by name, inherited
// dictionaries first).
// https://webidl.spec.whatwg.org/#es-dictionary
// ---------------------------------------------------------------------------

/** https://webidl.spec.whatwg.org/#es-DOMString */
export function idlDOMString(value: unknown): string {
	// String(symbol) is special-cased to succeed in JS, but IDL says throw
	if (typeof value === "symbol") {
		throw new TypeError("Cannot convert a Symbol value to a string");
	}

	return String(value);
}

/** https://webidl.spec.whatwg.org/#es-USVString */
export function idlUSVString(value: unknown): string {
	return toIDLScalarValueString(idlDOMString(value));
}

/** https://webidl.spec.whatwg.org/#es-boolean */
export function idlBoolean(value: unknown): boolean {
	return !!value;
}

/**
 * https://webidl.spec.whatwg.org/#es-double — `double` is restricted, so a
 * non-finite value is a TypeError rather than a NaN. `DOMHighResTimeStamp` is
 * a typedef for it.
 */
export function idlDouble(value: unknown): number {
	const x = +(value as number);
	if (!Number_isFinite(x)) {
		throw new TypeError("The provided double value is non-finite.");
	}

	return x;
}

/** https://webidl.spec.whatwg.org/#es-enumeration */
export function idlEnum<T extends string>(
	value: unknown,
	values: readonly T[],
	name: string
): T {
	const s = idlDOMString(value);
	for (let i = 0; i < values.length; i++) {
		if (values[i] === s) return values[i];
	}

	throw new TypeError(
		`The provided value '${s}' is not a valid enum value of type ${name}.`
	);
}

/**
 * https://webidl.spec.whatwg.org/#es-dictionary — undefined and null are both
 * the empty dictionary, anything else non-object is a TypeError. The members
 * themselves are still raw; convert each one with the helpers above.
 */
export function idlDictionary(
	value: unknown,
	name: string
): Record<string, unknown> {
	if (value === undefined || value === null) return {};

	if (typeof value !== "object" && typeof value !== "function") {
		throw new TypeError(`The provided value is not of type '${name}'.`);
	}

	return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// dictionary readers
// ---------------------------------------------------------------------------

/** One member's declaration: the same grammar `@Arguments` takes, plus `required`. */
type StripRequired<S extends string> = S extends `required ${infer T}`
	? Trim<T>
	: S;

/** A member is present in the result if it is required or has a default. */
type IsRequiredMember<S extends string> =
	Trim<S> extends `required ${string}`
		? true
		: Trim<S> extends `${string} = ${string}`
			? true
			: false;

type MemberType<S extends string> = FromIDL<
	StripDefault<StripRequired<StripExtendedAttributes<Trim<S>>>>
>;

/** `{ [K]: T }` for the members that always come back, `{ [K]?: T }` for the rest. */
export type IDLDictionaryOf<M extends Record<string, string>> = {
	[K in keyof M as IsRequiredMember<M[K]> extends true ? K : never]: MemberType<
		M[K]
	>;
} & {
	[K in keyof M as IsRequiredMember<M[K]> extends true
		? never
		: K]?: MemberType<M[K]>;
};

type CompiledMember = {
	key: string;
	/** null when the member has no default and is not required */
	fallback: (() => unknown) | null;
	required: boolean;
	coerce: (value: unknown) => unknown;
};

/**
 * `"strict"` -> `() => "strict"`. A thunk rather than a value so `[]` and `{}`
 * hand out a fresh one per read instead of one shared mutable default.
 */
function compileIDLDefault(
	name: string,
	key: string,
	raw: string
): () => unknown {
	const s = String_trim(raw);

	if (s === "null") return () => null;
	if (s === "true") return () => true;
	if (s === "false") return () => false;
	if (s === "[]") return () => [];
	if (s === "{}") return () => ({});
	const quote = String_fromCharCode(0x22);
	if (s.length >= 2 && s[0] === quote && s[s.length - 1] === quote) {
		const value = s.slice(1, -1);

		return () => value;
	}

	const number = Number(s);
	if (s !== "" && !Number_isNaN(number)) return () => number;

	throw new Error(`${name}.${key}: cannot read the IDL default \`${raw}\``);
}

/**
 * Build a reader for one dictionary from its members, written in the same IDL
 * the decorators take.
 *
 * ```ts
 * const readWorkerOptions = dictionaryReader("WorkerOptions", {
 *   credentials: `RequestCredentials = "same-origin"`,
 *   name: `DOMString = ""`,
 *   type: `WorkerType = "classic"`,
 * });
 * ```
 *
 * Why a reader rather than passing the object to the native: every member is a
 * page-controlled getter, so a body that peeks at one and then hands the *same
 * object* onward runs that getter twice, and the second run can answer
 * something other than what the body decided on. See the note above
 * {@link idlDictionary}.
 *
 * What the generator buys over writing that out by hand is the *order*. WebIDL
 * converts members lexicographically by name, and a hand-written reader has to
 * be kept in that order by whoever edits it - get it wrong and page getters run
 * in a sequence a browser would never produce, which is the exact thing reading
 * once was for. The keys are sorted here, at install time, so it stops being
 * something a reviewer has to check.
 *
 * TODO: no inherited dictionaries. WebIDL converts a parent's members before
 * the child's, and expressing that needs the parent named here; nothing scramjet
 * reads inherits today, so this throws rather than guessing if one ever does.
 */
export function dictionaryReader<const M extends Record<string, string>>(
	name: string,
	members: M
): (value: unknown) => IDLDictionaryOf<M> {
	const keys = Object_keys(members);

	// insertion sort rather than `Array.prototype.sort`: this runs at module
	// scope, so the intrinsic is still pristine, but not depending on that is
	// free here
	for (let i = 1; i < keys.length; i++) {
		const key = keys[i];
		let j = i - 1;
		while (j >= 0 && keys[j] > key) {
			keys[j + 1] = keys[j];
			j--;
		}
		keys[j + 1] = key;
	}

	const compiled: CompiledMember[] = [];
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		const raw = String_trim(members[key]);

		let declaration = raw;
		let required = false;
		if (declaration.startsWith("required ")) {
			required = true;
			declaration = String_trim(declaration.slice(9));
		}

		let fallback: (() => unknown) | null = null;
		const defaulted = declaration.indexOf(" = ");
		if (defaulted !== -1) {
			if (required) {
				throw new Error(
					`${name}.${key}: a required member cannot have a default`
				);
			}
			fallback = compileIDLDefault(name, key, declaration.slice(defaulted + 3));
			declaration = String_trim(declaration.slice(0, defaulted));
		}

		const type = stripIDLExtendedAttributes(declaration);
		const nullable = type.endsWith("?");
		const bare = nullable ? String_trim(type.slice(0, -1)) : type;
		const values = IDL_ENUM_VALUES[bare];

		let coerce: (value: unknown) => unknown;
		if (values) {
			// an enum's conversion is a membership test, which `compileIDLType`
			// cannot do without the values
			coerce = nullable
				? (value) => (value === null ? null : idlEnum(value, values, bare))
				: (value) => idlEnum(value, values, bare);
		} else {
			const compile = compileIDLType(
				{ ctors: {}, instanceof: () => false },
				type
			);
			// the shared coercers signal a rejection by throwing a sentinel,
			// which is right for an argument list that can fall through to the
			// native and wrong here, where there is nothing to fall through to
			coerce = (value) => {
				try {
					return compile(value);
				} catch (err) {
					if (err === IDL_REJECTED) {
						throw new TypeError(
							`Failed to read the '${key}' property from '${name}': the provided value is not of type '${type}'.`
						);
					}

					throw err;
				}
			};
		}

		compiled[compiled.length] = { key, fallback, required, coerce };
	}

	return (value: unknown) => {
		const dict = idlDictionary(value, name);
		const out: Record<string, unknown> = {};

		for (let i = 0; i < compiled.length; i++) {
			const member = compiled[i];
			// read once, into a local, in sorted order - the whole point
			const raw = dict[member.key];

			if (raw === undefined) {
				if (member.required) {
					throw new TypeError(`${name} requires the member '${member.key}'.`);
				}
				if (member.fallback) out[member.key] = member.fallback();

				continue;
			}

			out[member.key] = member.coerce(raw);
		}

		return out as IDLDictionaryOf<M>;
	};
}

/**
 * Whether `value` takes the buffer branch of a union like
 * `(DOMString or BinaryData)`.
 *
 * The discrimination is on internal slots, and `instanceof` does not test those.
 * A prototype is settable, so
 *
 *     Object.setPrototypeOf({ toString: () => "url(...)" }, ArrayBuffer.prototype)
 *
 * satisfies an instanceof check while the binding still sends it down the
 * string member and runs that toString. Skipping a rewrite on the strength of
 * an instanceof and then handing the value to the native is therefore a bypass
 * rather than a missed optimisation - the native produces the page's string and
 * uses it unrewritten. Reading the slots cannot be spoofed that way.
 *
 * A SharedArrayBuffer answers true here even though `BinaryData` rejects it.
 * That is deliberate: it carries [[ArrayBufferData]], so the union sends it to
 * the buffer member and the conversion *there* is what throws. Answering false
 * would stringify it instead, and the page would see a parse error from
 * "[object SharedArrayBuffer]" rather than the TypeError it is owed.
 * https://webidl.spec.whatwg.org/#es-union
 */
export function idlIsBufferSource(value: unknown): boolean {
	if (ArrayBuffer_isView(value)) return true;

	try {
		Reflect_apply(ArrayBuffer_prototype_byteLength, value, []);

		return true;
	} catch {
		// not an ArrayBuffer
	}

	if (SharedArrayBuffer_prototype_byteLength) {
		try {
			Reflect_apply(SharedArrayBuffer_prototype_byteLength, value, []);

			return true;
		} catch {
			// nor a SharedArrayBuffer
		}
	}

	return false;
}
