import { basicTest } from "../../testcommon.ts";

// Differential cover for the shape of the patches themselves, rather than their
// behaviour. The bare harness is the oracle: every value here must be identical
// to what an unproxied browser produces.
//
// Three of these are known to be load-bearing:
//
//   - Function.prototype.toString does NOT survive a Proxy. A Proxy over a
//     native function stringifies as "function () { [native code] }", losing
//     the name that the real one carries.
//   - `delete prototype[key]` followed by defineProperty moves the key to the
//     END of the own-property order, so getOwnPropertyNames lists every
//     patched member clustered at the end in patch order.
//   - Web IDL defines @@iterator with the same value as entries, so patching
//     them separately breaks an identity that is one line to check.

const probe = (name: string, js: string) =>
	basicTest({
		name: `native-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name, message: error && error.message };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

const INTERFACES = [
	"Headers",
	"Request",
	"Response",
	"Cache",
	"CacheStorage",
	"URLSearchParams",
	"FormData",
];

// Own-property order on an interface prototype. This is the single cheapest
// tell for a delete-then-redefine patch: the order is spec-stable in a real
// browser and reshuffles the moment a member is re-added.
const orderProbes = INTERFACES.map((iface) =>
	probe(
		`proto-order-${iface.toLowerCase()}`,
		`(() => typeof ${iface} === "undefined" ? "absent"
			: Object.getOwnPropertyNames(${iface}.prototype).join(","))()`
	)
);

// Symbol-keyed members are dropped by an Object.entries-based walk, so they
// silently go un-patched - and their presence and order still shows here.
const symbolProbes = INTERFACES.map((iface) =>
	probe(
		`proto-symbols-${iface.toLowerCase()}`,
		`(() => typeof ${iface} === "undefined" ? "absent"
			: Object.getOwnPropertySymbols(${iface}.prototype).map(String).join(","))()`
	)
);

const MEMBERS: [string, string][] = [
	["Headers", "get"],
	["Headers", "has"],
	["Headers", "set"],
	["Headers", "append"],
	["Headers", "delete"],
	["Headers", "entries"],
	["Headers", "keys"],
	["Headers", "values"],
	["Headers", "forEach"],
	["Headers", "getSetCookie"],
	["Request", "clone"],
	["Response", "clone"],
	["Response", "json"],
	["Cache", "match"],
	["Cache", "matchAll"],
	["Cache", "put"],
	["Cache", "add"],
	["Cache", "addAll"],
	["Cache", "delete"],
	["Cache", "keys"],
	["CacheStorage", "open"],
	["CacheStorage", "has"],
	["CacheStorage", "match"],
	["CacheStorage", "delete"],
	["CacheStorage", "keys"],
];

// name / length / toString / descriptor flags / absence of .prototype, for
// every method the interceptors touch or sit next to.
const memberProbes = MEMBERS.map(([iface, member]) =>
	probe(
		`member-${iface.toLowerCase()}-${member.toLowerCase()}`,
		`(() => {
			if (typeof ${iface} === "undefined") return "absent";
			const d = Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(member)});
			if (!d) return "missing";
			const fn = d.value;
			return {
				type: typeof fn,
				name: fn && fn.name,
				length: fn && fn.length,
				str: fn && Function.prototype.toString.call(fn),
				hasPrototype: fn && Object.prototype.hasOwnProperty.call(fn, "prototype"),
				ownKeys: fn && Object.getOwnPropertyNames(fn).join(","),
				writable: d.writable,
				enumerable: d.enumerable,
				configurable: d.configurable,
				tag: Object.prototype.toString.call(fn),
			};
		})()`
	)
);

const ACCESSORS: [string, string][] = [
	["Request", "url"],
	["Request", "headers"],
	["Request", "method"],
	["Request", "mode"],
	["Request", "credentials"],
	["Request", "destination"],
	["Request", "signal"],
	["Request", "bodyUsed"],
	["Response", "url"],
	["Response", "headers"],
	["Response", "type"],
	["Response", "status"],
	["Response", "ok"],
	["Response", "redirected"],
	["Response", "bodyUsed"],
];

// An accessor that has been replaced with a data property, or that has grown a
// setter it never had, shows up here.
const accessorProbes = ACCESSORS.map(([iface, member]) =>
	probe(
		`accessor-${iface.toLowerCase()}-${member.toLowerCase()}`,
		`(() => {
			const d = Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(member)});
			if (!d) return "missing";
			return {
				kind: d.get ? "accessor" : "data",
				hasGet: !!d.get,
				hasSet: !!d.set,
				getName: d.get && d.get.name,
				getLength: d.get && d.get.length,
				getStr: d.get && Function.prototype.toString.call(d.get),
				enumerable: d.enumerable,
				configurable: d.configurable,
			};
		})()`
	)
);

export default [
	...orderProbes,
	...symbolProbes,
	...memberProbes,
	...accessorProbes,

	// --- identities that a naive per-member patch breaks --------------------

	probe(
		"iterator-identity",
		`(() => ["Headers", "URLSearchParams", "FormData"].map((n) =>
			n + "=" + (self[n].prototype[Symbol.iterator] === self[n].prototype.entries)).join(","))()`
	),

	probe(
		"iterator-prototype-shape",
		`(() => {
			const it = new Headers({ a: "1" }).entries();
			const proto = Object.getPrototypeOf(it);
			return {
				tag: Object.prototype.toString.call(it),
				sharedAcrossKinds: proto === Object.getPrototypeOf(new Headers().keys())
					&& proto === Object.getPrototypeOf(new Headers().values()),
				ownKeys: Object.getOwnPropertyNames(proto).join(","),
				symbols: Object.getOwnPropertySymbols(proto).map(String).join(","),
				inheritsIteratorPrototype: Object.getPrototypeOf(proto) ===
					Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())),
				nextStr: Function.prototype.toString.call(proto.next),
				nextName: proto.next.name,
			};
		})()`
	),

	// A method read off an instance must be the very same function object as the
	// one on the prototype - a per-instance wrapper is a giveaway and also breaks
	// every library that caches Headers.prototype.get.
	probe(
		"no-per-instance-wrappers",
		`(async () => {
			const r = await fetch("/script.js");
			const h = r.headers;
			return {
				headersGet: h.get === Headers.prototype.get,
				headersEntries: h.entries === Headers.prototype.entries,
				headersForEach: h.forEach === Headers.prototype.forEach,
				responseClone: r.clone === Response.prototype.clone,
				sameHeadersTwice: r.headers === r.headers,
			};
		})()`
	),

	// Detached methods must still work on a real receiver, and must still brand
	// check. A wrapper that closes over `this` fails the first; a Proxy without
	// an unwrapping apply trap fails on a proxied receiver.
	probe(
		"detached-method-call",
		`(async () => {
			const get = Headers.prototype.get;
			const h = (await fetch("/script.js")).headers;
			const out = { viaCall: get.call(h, "content-type") };
			try { get.call({}, "x"); out.onPlainObject = "no throw"; }
			catch (e) { out.onPlainObject = e.name; }
			try { get.call(null, "x"); out.onNull = "no throw"; }
			catch (e) { out.onNull = e.name; }
			return out;
		})()`
	),

	probe(
		"brand-checks",
		`(() => {
			const out = {};
			const probes = [
				["headers-get", () => Headers.prototype.get.call(new Request("/x"), "a")],
				["response-url", () => Object.getOwnPropertyDescriptor(Response.prototype, "url").get.call(new Request("/x"))],
				["request-url", () => Object.getOwnPropertyDescriptor(Request.prototype, "url").get.call(new Response("x"))],
				["response-clone", () => Response.prototype.clone.call({})],
				["cache-match", () => Cache.prototype.match.call({}, "/x")],
			];
			for (const [label, fn] of probes) {
				try { const v = fn(); out[label] = v && v.then ? "promise" : "no throw"; }
				catch (e) { out[label] = e.name; }
			}
			return out;
		})()`
	),

	// instanceof and Symbol.toStringTag on the objects themselves
	probe(
		"instance-brands",
		`(async () => {
			const r = await fetch("/script.js");
			const req = new Request("/x");
			return {
				respTag: Object.prototype.toString.call(r),
				reqTag: Object.prototype.toString.call(req),
				hdrTag: Object.prototype.toString.call(r.headers),
				cacheTag: Object.prototype.toString.call(caches),
				respInstance: r instanceof Response,
				reqInstance: req instanceof Request,
				hdrInstance: r.headers instanceof Headers,
				respProto: Object.getPrototypeOf(r) === Response.prototype,
				reqProto: Object.getPrototypeOf(req) === Request.prototype,
				hdrProto: Object.getPrototypeOf(r.headers) === Headers.prototype,
				respOwn: Object.getOwnPropertyNames(r).join(","),
				reqOwn: Object.getOwnPropertyNames(req).join(","),
				hdrOwn: Object.getOwnPropertyNames(r.headers).join(","),
			};
		})()`
	),

	// Constructor shape: arity and the prototype property's descriptor.
	probe(
		"constructor-shape",
		`(() => ["Headers", "Request", "Response", "Cache", "CacheStorage"].map((n) => {
			if (typeof self[n] === "undefined") return n + "=absent";
			const C = self[n];
			const d = Object.getOwnPropertyDescriptor(C, "prototype");
			return [
				n,
				C.name,
				C.length,
				Function.prototype.toString.call(C),
				"w" + d.writable + "e" + d.enumerable + "c" + d.configurable,
				Object.getOwnPropertyNames(C).join("|"),
			].join("=");
		}).join(" ~ "))()`
	),

	// Errors thrown by intercepted members: the constructor, the name, and
	// whether the message mentions anything it should not.
	probe(
		"error-shapes",
		`(async () => {
			const out = {};
			const probes = [
				["bad-url", () => new Request("http://")],
				["bad-method", () => new Request("/x", { method: "TRACE" })],
				["bad-header-name", () => new Headers({ "a b": "c" })],
				["bad-header-value", () => new Headers({ a: "\\u0000" })],
				["headers-set-invalid", () => new Headers().set("a b", "c")],
				["fetch-no-args", () => fetch()],
				["cache-open-no-args", () => caches.open()],
			];
			for (const [label, fn] of probes) {
				try {
					const v = fn();
					if (v && v.then) { await v; out[label] = "resolved"; }
					else out[label] = "no throw";
				} catch (e) {
					out[label] = {
						name: e.name,
						ctor: e.constructor && e.constructor.name,
						isTypeError: e instanceof TypeError,
						mentionsProxy: /~\\/sj\\/|scramjet/i.test(String(e.message)),
					};
				}
			}
			return out;
		})()`
	),

	// A stack captured inside a callback the interceptor invokes must not name
	// the proxy's own script. This is checked as a boolean, not a snapshot,
	// because real stacks differ between the two harnesses.
	basicTest({
		name: "native-callback-stack-is-clean",
		js: `
			const h = (await fetch("/script.js")).headers;
			let stack = null;
			h.forEach(() => { if (stack === null) stack = new Error().stack || ""; });
			assert(stack !== null, "forEach ran the callback");
			assert(!/scramjet/i.test(stack), "no proxy frames in a forEach callback stack:\\n" + stack);
			assert(!stack.includes("/~/sj/"), "no proxy URL in the stack:\\n" + stack);

			let promiseStack = null;
			await caches.open("native-stack").then(() => { promiseStack = new Error().stack || ""; });
			await caches.delete("native-stack");
			assert(!/scramjet/i.test(promiseStack), "no proxy frames in a promise continuation:\\n" + promiseStack);
		`,
	}),

	// Nothing on these prototypes may be an own property of the global, and no
	// scramjet-shaped name may be reachable from the interfaces we touch.
	basicTest({
		name: "native-no-scramjet-shaped-names",
		js: `
			const suspicious = [];
			for (const n of ["Headers", "Request", "Response", "Cache", "CacheStorage"]) {
				if (typeof self[n] === "undefined") continue;
				const names = [
					...Object.getOwnPropertyNames(self[n]),
					...Object.getOwnPropertyNames(self[n].prototype),
				];
				for (const k of names) {
					if (/scramjet|\\$scramjet|__sj/i.test(k)) suspicious.push(n + "." + k);
				}
			}
			assertEqual(suspicious.length, 0, "proxy-shaped members exposed: " + suspicious.join(", "));

			const globals = Object.getOwnPropertyNames(self).filter((k) => /scramjet/i.test(k));
			assertEqual(globals.length, 0, "proxy-shaped globals exposed: " + globals.join(", "));
		`,
	}),
];
