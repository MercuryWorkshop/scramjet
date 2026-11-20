import { iswindow } from "@client/entry";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
// import { argdbg } from "@client/shared/err";
import {
	Object_defineProperty,
	Object_getOwnPropertyDescriptor,
	Reflect_ownKeys,
	drain,
	String_startsWith,
} from "@/shared/snapshot";

export function createWrapFn(client: ScramjetClient, self: GlobalThis) {
	let wrappedParent: Window | null = null;
	let wrappedTop: Window | null = null;
	if (iswindow) {
		const win = self as Self;
		try {
			if (SCRAMJETCLIENT in self.parent) {
				// ... then we're in a subframe, and the parent frame is also in a proxy context, so we should return its proxy
				wrappedParent = self.parent;
			} else {
				// ... then we should pretend we aren't nested and return the current window
				wrappedParent = win;
			}
		} catch {
			// accessing self.parent can throw if it's cross-origin, in which case we should also pretend we aren't nested
			wrappedParent = win;
		}
		// instead of returning top, we need to return the uppermost parent that's inside a scramjet context
		let current: Window = win;
		for (;;) {
			const test = current.parent.self;
			if (test === current) break; // there is no parent, actual or emulated.

			try {
				// ... then `test` represents a window outside of the proxy context, and therefore `current` is the topmost window in the proxy context
				if (!(SCRAMJETCLIENT in test)) break;
			} catch {
				// accessing test can throw if it's cross-origin, in which case we should also break
				break;
			}
			// test is also insde a proxy, so we should continue up the chain
			current = test;
		}
		wrappedTop = current;
	}

	return function (identifier: any) {
		if (identifier === self.location) return client.locationProxy;
		if (identifier === self.eval) {
			return client.indirectEval;
		}
		if (iswindow) {
			if (identifier === self.parent) {
				return wrappedParent;
			} else if (identifier === self.top) {
				return wrappedTop;
			}
		}
		return identifier;
	};
}

export const order = 4;
export default function (client: ScramjetClient, self: GlobalThis) {
	// a temporary slot that $call can use to store the receiver
	Object_defineProperty(self, client.config.globals.tempreceiverid, {
		value: undefined,
		writable: true,
		configurable: false,
		enumerable: false,
	});

	// the same, for the callee of an optional call, which has to be parked
	// before the arguments are evaluated so that a nullish one can skip them
	Object_defineProperty(self, client.config.globals.tempcalleeid, {
		value: undefined,
		writable: true,
		configurable: false,
		enumerable: false,
	});

	Object_defineProperty(self, client.config.globals.wrapfn, {
		value: client.wrapfn,
		writable: false,
		configurable: false,
		enumerable: false,
	});
	Object_defineProperty(self, client.config.globals.wrappropertyfn, {
		value: function (str) {
			if (
				str === "location" ||
				str === "parent" ||
				str === "top" ||
				str === "eval"
			)
				return client.config.globals.wrappropertybase + str;

			return str;
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
	Object_defineProperty(self, client.config.globals.cleanrestfn, {
		value: function (_obj) {
			// TODO
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});

	Object_defineProperty(
		self.Object.prototype,
		client.config.globals.wrappropertybase + "location",
		{
			get: function () {
				// if (this.location.constructor.toString().includes("Location")) {

				if (this === self || this === self.document) {
					return client.locationProxy;
				}

				return this.location;
			},
			set(value: any) {
				if (this === self || this === self.document) {
					client.url = value;

					return;
				}
				this.location = value;
			},
			configurable: false,
			enumerable: false,
		}
	);
	Object_defineProperty(
		self.Object.prototype,
		client.config.globals.wrappropertybase + "parent",
		{
			get: function () {
				return client.wrapfn(this.parent);
			},
			set(value: any) {
				// i guess??
				this.parent = value;
			},
			configurable: false,
			enumerable: false,
		}
	);
	Object_defineProperty(
		self.Object.prototype,
		client.config.globals.wrappropertybase + "top",
		{
			get: function () {
				return client.wrapfn(this.top);
			},
			set(value: any) {
				this.top = value;
			},
			configurable: false,
			enumerable: false,
		}
	);
	Object_defineProperty(
		self.Object.prototype,
		client.config.globals.wrappropertybase + "eval",
		{
			get: function () {
				return client.wrapfn(this.eval);
			},
			set(value: any) {
				this.eval = value;
			},
			configurable: false,
			enumerable: false,
		}
	);

	// location = "..." can't be rewritten as wrapfn(location) = ..., so instead it will actually be rewritten as
	// ((t)=>$scramjet$tryset(location,"+=",t)||location+=t)(...);
	// it has to be a discrete function because there's always the possibility that "location" is a local variable
	// we have to use an IIFE to avoid duplicating side-effects in the getter
	Object_defineProperty(self, client.config.globals.trysetfn, {
		value: function (lhs: any, op: string, rhs: any) {
			if (client.box.locations.has(lhs)) {
				lhs.href = rhs;
				return true;
			}

			return false;
		},
		writable: false,
		configurable: false,
	});

	// Hide the shim's own globals from key enumeration.
	//
	// They are defined non-enumerable, so `Object.keys` and `for-in` already
	// miss them -- but `getOwnPropertyNames` and `Reflect.ownKeys` report
	// non-enumerable properties too, and walking the global is the first thing
	// a fingerprinter does. A page reading
	// `Object.getOwnPropertyNames(window)` got `$scramjet`,
	// `$scramjetController`, `$scramjet$rewrite` and the rest back by name,
	// and `Object.prototype` handed over `$scramjet__location` and its
	// siblings -- none of which exist on any browser.
	//
	// `$scramjet` prefixes every one of them, and a page that has its own is
	// already broken under a proxy that claims the name. The one symbol on the
	// global, the client's own, goes the same way
	const isShimKey = (k: unknown) =>
		k === SCRAMJETCLIENT ||
		(typeof k === "string" && String_startsWith(k, "$scramjet"));
	// they are only ever defined on the global and on Object.prototype, and
	// every other object's keys are the page's own, whatever they are called
	const objectPrototype = self.Object.prototype;
	const carriesShimKeys = (target: unknown) =>
		target === self || target === objectPrototype;
	const filtered = {
		apply(ctx) {
			if (!carriesShimKeys(ctx.args[0])) return;
			// the browser's own array, compacted in place: it stays of the
			// page's realm, and nothing of the page's runs to make another
			const keys = ctx.call() as (string | symbol)[];
			let kept = 0;
			for (let i = 0; i < keys.length; i++) {
				if (!isShimKey(keys[i])) keys[kept++] = keys[i];
			}
			keys.length = kept;

			return ctx.return(keys);
		},
	};

	client.Proxy("Object.getOwnPropertyNames", filtered);
	client.Proxy("Object.getOwnPropertySymbols", filtered);
	client.Proxy("Reflect.ownKeys", filtered);

	client.Proxy("Object.getOwnPropertyDescriptors", {
		apply(ctx) {
			if (!carriesShimKeys(ctx.args[0])) return;
			const descs = ctx.call() as Record<string | symbol, unknown>;
			for (const k of drain(Reflect_ownKeys(descs))) {
				if (isShimKey(k)) delete descs[k];
			}

			return ctx.return(descs);
		},
	});

	// the bundles' own globals, `$scramjet` and `$scramjetController`, are
	// ordinary assignments, so enumerable: `Object.keys(window)` and for-in
	// would list them
	for (const k of drain(Reflect_ownKeys(self))) {
		if (typeof k !== "string" || !isShimKey(k)) continue;
		const descriptor = Object_getOwnPropertyDescriptor(self, k);
		if (descriptor?.enumerable && descriptor.configurable) {
			Object_defineProperty(self, k, { enumerable: false });
		}
	}
}
