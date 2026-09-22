import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import {
	Object_getPrototypeOf,
	Object_keys,
	Reflect_defineProperty,
	Reflect_deleteProperty,
	Reflect_get,
	Reflect_getOwnPropertyDescriptor,
	Reflect_ownKeys,
	Reflect_set,
	String_startsWith,
	String_substring,
	_Set,
	_WeakMap,
} from "@/shared/snapshot";

export const enabled = (_client: ScramjetClient, self: Self) =>
	"Storage" in self && "localStorage" in self;

export default function (client: ScramjetClient, self: Self) {
	// `scopeOrigin` rather than `url.origin`: an about:blank frame's storage
	// area is its creator's, and its own URL has no origin to key on - so every
	// one of them on every site would otherwise share the single "" namespace,
	// which is a cross-site read and write of both areas. The whole origin and
	// not the host, so that `http://x` and `https://x` get one area each the
	// way a browser gives them one, and so that this keys the same way
	// `caches.ts`, `indexeddb.ts` and `opfs.ts` do.
	//
	// The separator is always included, never the bare origin.
	// `startsWith(origin)` would also match another site's keys whenever one
	// origin is a prefix of another - "https://a.com" against
	// "https://a.com.evil@secret" - and each of those was then chopped at
	// `origin.length + 1` and handed over as this site's own. "@" makes the
	// boundary unambiguous, because an origin cannot contain one.
	const prefix = () => `${client.scopeOrigin}@`;

	/**
	 * The real storage area behind a receiver.
	 *
	 * The page never holds one directly - it holds the wrapper below - and the
	 * native members brand-check, so a wrapper has to be mapped back before it
	 * is handed to one. Anything else is passed through untouched so that the
	 * native raises its own "Illegal invocation".
	 */
	const areaOf = (that: any): any => client.box.unproxy.get(that) ?? that;

	/**
	 * This site's keys, as they are stored - namespace included.
	 *
	 * An indexed loop rather than `Array.prototype.filter`, which is
	 * page-writable: replacing it hands `length`, `key()` and `clear()` a list
	 * of some other site's keys, and `clear()` acts on whatever it is given.
	 */
	const scopedKeys = (area: Storage) => {
		const scope = prefix();
		const all = Object_keys(area);
		const mine: string[] = [];

		for (let i = 0; i < all.length; i++) {
			if (String_startsWith(all[i], scope)) mine[mine.length] = all[i];
		}

		return mine;
	};

	// https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface
	//
	// The members live on `Storage.prototype` because that is where a browser
	// keeps them, so they are ordinary intercepted members - not arrows minted
	// per read by the wrapper's `get` trap, which would differ from a native
	// one in identity, `name` and `Function.prototype.toString`.
	//
	// Every member below reaches the native through `new client.native.Storage(
	// areaOf(this))`. `areaOf` maps the wrapper the page holds back to the real
	// area and passes anything else through untouched, so a receiver that is
	// not a Storage still reaches the native and still gets its "Illegal
	// invocation". The lint rule only recognises a literal `this`, so it cannot
	// see a receiver that went through a helper - hence a disable per member.
	client.Intercept(class extends Storage {
		@Type("unsigned long")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		get length(): number {
			const area = areaOf(this);
			// reached on every path, so a receiver that is not a Storage gets
			// the native's own "Illegal invocation" rather than a count
			void new client.native.Storage(area).length;

			return scopedKeys(area).length;
		}

		@Arguments("unsigned long")
		@Returns("DOMString?")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		key(index: number): string | null {
			const area = areaOf(this);
			// before the range test rather than inside it: a receiver that is
			// not a Storage owes the native's "Illegal invocation" whatever the
			// index is. Gated on the out-of-range branch,
			// `key.call({ "https://a.example@x": 1 }, 0)` answered "x"
			void new client.native.Storage(area).length;

			// the *name*, not the value, and with the namespace taken off -
			// this is what a page iterating `localStorage.key(i)` and feeding
			// the result back to `getItem` needs. Out of range is null
			const keys = scopedKeys(area);
			if (index < 0 || index >= keys.length) return null;

			return String_substring(keys[index], prefix().length);
		}

		@Arguments("DOMString")
		@Returns("DOMString?")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		getItem(key: string): string | null {
			return new client.native.Storage(areaOf(this)).getItem(prefix() + key);
		}

		@Arguments("DOMString", "DOMString")
		@Returns("undefined")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		setItem(key: string, value: string): void {
			new client.native.Storage(areaOf(this)).setItem(prefix() + key, value);
		}

		@Arguments("DOMString")
		@Returns("undefined")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		removeItem(key: string): void {
			new client.native.Storage(areaOf(this)).removeItem(prefix() + key);
		}

		@Arguments()
		@Returns("undefined")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- reaches the native through `areaOf(this)`
		clear(): void {
			const area = areaOf(this);
			const nArea = new client.native.Storage(area);

			// this site's entries only, never the whole area. `Object_keys`
			// snapshots, so removing while iterating is safe
			for (const key of scopedKeys(area)) {
				nArea.removeItem(key);
			}
		}
	});

	/**
	 * Whether `prop` is a member of the interface rather than a stored item.
	 *
	 * `Storage` has no `[LegacyOverrideBuiltIns]`, so a named property never
	 * shadows a built-in: `localStorage.getItem` is the method even when an
	 * item of that name exists. Taken from the prototype chain once, so the
	 * list cannot drift.
	 */
	const memberNames = new _Set<string>();
	for (
		let proto = self.Storage.prototype as any;
		proto;
		proto = Object_getPrototypeOf(proto)
	) {
		const keys = Reflect_ownKeys(proto);
		for (let i = 0; i < keys.length; i++) {
			if (typeof keys[i] === "string") memberNames.add(keys[i] as string);
		}
	}

	const isMember = (prop: string | symbol): boolean =>
		typeof prop === "symbol" || memberNames.has(prop);

	const item = (area: Storage, prop: string): string | null =>
		new client.native.Storage(area).getItem(prefix() + prop);

	/**
	 * The named-property half of `Storage`, which has no prototype member to
	 * intercept: `localStorage.foo` is the item "foo".
	 */
	const handler: ProxyHandler<Storage> = {
		get(target, prop) {
			if (isMember(prop)) return Reflect_get(target, prop);

			// undefined, not null: a named property that is not there is
			// absent, and `getItem`'s null is `getItem`'s alone.
			// `localStorage.nope` answered null where a browser answers
			// undefined, so `?? fallback` and `=== undefined` both misread it
			const value = item(target, prop as string);

			return value === null ? undefined : value;
		},

		set(target, prop, value) {
			if (isMember(prop)) return Reflect_set(target, prop, value);

			new client.native.Storage(target).setItem(
				prefix() + (prop as string),
				value
			);

			return true;
		},

		has(target, prop) {
			if (isMember(prop)) return prop in target;

			return item(target, prop as string) !== null;
		},

		deleteProperty(target, prop) {
			// `Storage` has a deleter, so `delete localStorage.x` removes the
			// item. Without this the delete went to the *unscoped* key, which
			// never exists, so it answered true and removed nothing
			if (isMember(prop)) return Reflect_deleteProperty(target, prop);

			new client.native.Storage(target).removeItem(prefix() + (prop as string));

			return true;
		},

		ownKeys(target) {
			const scope = prefix();
			const keys: string[] = [];
			const own = Reflect_ownKeys(target);

			for (let i = 0; i < own.length; i++) {
				const key = own[i];
				if (typeof key !== "string" || !String_startsWith(key, scope)) continue;
				keys[keys.length] = String_substring(key, scope.length);
			}

			return keys;
		},

		getOwnPropertyDescriptor(target, property) {
			if (isMember(property)) {
				return Reflect_getOwnPropertyDescriptor(target, property);
			}

			const value = item(target, property as string);
			if (value === null) return undefined;

			return {
				value,
				enumerable: true,
				configurable: true,
				writable: true,
			};
		},

		defineProperty(target, property, attributes) {
			// a member name (or a symbol) is not a named property, so it takes
			// the ordinary definition
			if (isMember(property)) {
				return Reflect_defineProperty(target, property, attributes);
			}

			// https://webidl.spec.whatwg.org/#legacy-platform-object-defineownproperty
			// - a named property setter takes data descriptors only and
			// refuses an accessor, which is a false here and so a TypeError
			// out of `Object.defineProperty`. Falling through to
			// `Reflect_defineProperty` installed a real getter on the area
			// every proxied site shares
			if (!("value" in attributes)) return false;

			new client.native.Storage(target).setItem(
				prefix() + (property as string),
				attributes.value
			);

			return true;
		},
	};

	/**
	 * One wrapper per area, minted on the first read and kept.
	 *
	 * `localStorage === localStorage` has to hold, and the wrapper also has to
	 * be findable from a receiver - see {@link areaOf} - which is what the
	 * `unproxy` entry is for.
	 */
	const wrappers = new _WeakMap<Storage, Storage>();
	const wrap = (area: Storage): Storage => {
		const existing = wrappers.get(area);
		if (existing) return existing;

		const proxy = new Proxy(area, handler);
		wrappers.set(area, proxy);
		client.box.unproxy.set(proxy, area);

		return proxy;
	};

	// Through `Trap`, not `delete self.localStorage` followed by an assignment:
	// the attribute stays a readonly accessor rather than becoming a data
	// property, and keeps its place in the window's own key order. `ctx.get()`
	// also keeps the native's brand check and its SecurityError for a document
	// that may not use storage.
	client.Trap(["localStorage", "sessionStorage"], {
		get(ctx) {
			return wrap(ctx.get() as Storage);
		},
	});
}
