import { basicTest } from "../../testcommon.ts";

// `location`, `top`, `parent` and `eval` are the rewriter's UNSAFE_GLOBALS, so
// *every* `.location` / `.top` / `.parent` / `.eval` property access in a page
// is redirected through the $scramjet__<name> accessor pair installed on
// Object.prototype (see client/shared/wrap.ts).
//
// That means ordinary objects that happen to carry one of those keys - weather
// data with a `location`, a DOMRect-ish `{top}`, a tree node with a `parent` -
// take the same path. These tests pin down that the redirection stays
// invisible to the page.

export default [
	basicTest({
		name: "unsafeprops-read-write-plain-object",
		js: `
			const o = { location: "paris", top: 1, parent: 2, eval: 3, safe: 4 };
			assertEqual(o.location, "paris", "read location");
			assertEqual(o.top, 1, "read top");
			assertEqual(o.parent, 2, "read parent");
			assertEqual(o.eval, 3, "read eval");
			assertEqual(o["location"], "paris", "computed read");
			o.location = "london";
			assertEqual(o.location, "london", "write then read");
			o.top++;
			assertEqual(o.top, 2, "increment");
			o.parent += 10;
			assertEqual(o.parent, 12, "compound assignment");
			assertDeepEqual(Object.keys(o), ["location", "top", "parent", "eval", "safe"], "keys are untouched");
			assertEqual(JSON.stringify(o), '{"location":"london","top":2,"parent":12,"eval":3,"safe":4}', "JSON round trip");
		`,
	}),
	basicTest({
		name: "unsafeprops-dynamic-assignment",
		js: `
			const bag = {};
			for (const k of ["location", "top", "parent", "eval", "safe"]) bag[k] = k + "!";
			assertDeepEqual(Object.keys(bag), ["location", "top", "parent", "eval", "safe"], "dynamically assigned keys");
			assertEqual(bag.location, "location!", "read back");
			assertEqual(Object.entries(bag).length, 5, "entries");
			let seen = [];
			for (const k in bag) seen.push(k);
			assertDeepEqual(seen, ["location", "top", "parent", "eval", "safe"], "for-in");
		`,
	}),
	basicTest({
		name: "unsafeprops-json-parse",
		js: `
			const o = JSON.parse('{"location":"paris","top":1}');
			assertEqual(o.location, "paris", "parsed location");
			assertEqual(o["location"], "paris", "computed access");
			assertEqual(JSON.stringify(o), '{"location":"paris","top":1}', "restringify");
			const c = structuredClone(o);
			assertEqual(c.location, "paris", "structuredClone value");
			assertDeepEqual(Object.keys(c), ["location", "top"], "structuredClone keys");
		`,
	}),
	basicTest({
		name: "unsafeprops-accessor-invocation-count",
		js: `
			// the $scramjet__location getter reads this.location, so a page-level
			// accessor must not be invoked more than once per access
			let gets = 0, sets = 0, lastSet;
			const o = {
				get location() { gets++; return "g"; },
				set location(v) { sets++; lastSet = v; },
			};
			assertEqual(o.location, "g", "getter value");
			assertEqual(gets, 1, "getter called once");
			o.location = "s";
			assertEqual(sets, 1, "setter called once");
			assertEqual(lastSet, "s", "setter received the value");
		`,
	}),
	basicTest({
		name: "unsafeprops-defineproperty",
		js: `
			const o = {};
			Object.defineProperty(o, "location", { value: 7, enumerable: true, configurable: true });
			assertEqual(o.location, 7, "read a defined property");
			assertEqual(Object.getOwnPropertyDescriptor(o, "location").value, 7, "descriptor");
			Object.defineProperty(o, "top", { get: () => 8, configurable: true });
			assertEqual(o.top, 8, "defined getter");
		`,
	}),
	basicTest({
		name: "unsafeprops-optional-chaining",
		js: `
			const o = { location: { href: "h" } };
			assertEqual(o?.location?.href, "h", "optional chain");
			assertEqual(null?.location, undefined, "short circuit on null");
			assertEqual(o.location?.missing?.deep, undefined, "deep short circuit");
			assertEqual(o.top?.deep, undefined, "missing intermediate");
		`,
	}),
	basicTest({
		name: "unsafeprops-class-members",
		js: `
			class C {
				location() { return "m"; }
				top = 5;
				#p = 1;
				get parent() { return this.#p; }
			}
			const c = new C();
			assertEqual(c.location(), "m", "method named location");
			assertEqual(c.top, 5, "field named top");
			c.top++;
			assertEqual(c.top, 6, "increment a field named top");
			assertEqual(c.parent, 1, "getter named parent");
		`,
	}),
	basicTest({
		name: "unsafeprops-host-objects",
		js: `
			// DOMRect.top and CSSStyleDeclaration.top are on hot paths for every
			// layout-reading library on the web
			const d = document.createElement("div");
			d.style.cssText = "position:absolute;top:10px;left:20px;width:30px;height:40px";
			document.body.appendChild(d);
			const r = d.getBoundingClientRect();
			assertEqual(r.top, 10, "DOMRect.top");
			assertEqual(typeof r.top, "number", "DOMRect.top is a number");
			d.style.top = "50px";
			assertEqual(d.style.top, "50px", "style.top round trip");
			assertEqual(getComputedStyle(d).top, "50px", "computed style top");
			assertEqual(d.parentNode, document.body, "parentNode still works");
		`,
	}),

	// ------------------------------------------------------------------
	// where the redirection becomes observable
	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: the trap sees $scramjet__location instead of location,
		// and is entered twice (once for the mangled name, once for the read the
		// accessor performs). Every Proxy-based reactivity system - Vue 3, MobX,
		// immer - keys its dependency tracking on exactly this argument, so a
		// reactive object with a `location` field silently stops updating.
		name: "unsafeprops-proxy-get-trap-key",
		js: `
			const log = [];
			const p = new Proxy({ location: "x", top: 1, other: 3 }, {
				get(t, k, r) { log.push(k); return Reflect.get(t, k, r); },
			});
			assertEqual(p.other, 3, "control");
			assertEqual(p.location, "x", "value still arrives");
			assertEqual(p.top, 1, "top value still arrives");
			assertDeepEqual(log, ["other", "location", "top"], "get trap must see the real keys");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same, for writes.
		name: "unsafeprops-proxy-set-trap-key",
		js: `
			const log = [];
			const p = new Proxy({}, {
				set(t, k, v, r) { log.push(k); return Reflect.set(t, k, v, r); },
			});
			p.other = 1;
			p.location = 2;
			p.top = 3;
			assertDeepEqual(log, ["other", "location", "top"], "set trap must see the real keys");
			assertEqual(p.location, 2, "value round trips");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the accessor lives on Object.prototype, so an object
		// with a null prototype never reaches it - the write lands in an own
		// property literally called $scramjet__location. Null-prototype
		// dictionaries are the standard shape for parsed query strings, i18n
		// tables and JSON maps.
		name: "unsafeprops-null-prototype",
		js: `
			const o = Object.create(null);
			o.location = "x";
			o.top = "y";
			assertDeepEqual(Object.keys(o), ["location", "top"], "keys on a null-prototype object");
			assertEqual(JSON.stringify(o), '{"location":"x","top":"y"}', "JSON round trip");
			assertDeepEqual(Object.keys({ ...o }), ["location", "top"], "spread copies the real keys");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: rewritten to `delete o.$scramjet__location`, which
		// removes nothing and still reports success. `delete node.parent` is a
		// standard way to break reference cycles before serializing a tree.
		name: "unsafeprops-delete",
		js: `
			const o = { location: 1, top: 2, parent: 3, eval: 4, keep: 5 };
			assertEqual(delete o.location, true, "delete reports success");
			delete o.top;
			delete o.parent;
			delete o.eval;
			assertDeepEqual(Object.keys(o), ["keep"], "delete must actually remove the properties");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: the write is absorbed by the Object.prototype setter,
		// which reassigns in sloppy mode, so the strict-mode TypeError is lost.
		name: "unsafeprops-frozen-strict-assign",
		js: `
			"use strict";
			const o = Object.freeze({ location: 1 });
			let threw = false;
			try { o.location = 2; } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "strict assignment to a frozen property must throw");
			assertEqual(o.location, 1, "value unchanged");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: `super.location` becomes `super.$scramjet__location`,
		// which finds the Object.prototype accessor; its getter then reads
		// `this.location`, so the lookup collapses onto the instance's own
		// property instead of continuing up the prototype chain.
		name: "unsafeprops-super",
		js: `
			class B { constructor() { this.location = "own"; } get top() { return "protoTop"; } }
			class D extends B {
				readLoc() { return super.location; }
				readTop() { return super.top; }
			}
			const d = new D();
			assertEqual(d.readTop(), "protoTop", "super.top");
			assertEqual(d.readLoc(), undefined, "super.location must not see the instance's own property");
		`,
	}),
];
