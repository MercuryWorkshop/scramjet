import { basicTest } from "../../testcommon.ts";

// client/shared/function.ts intercepts the Function constructor, stringifies
// the function the real constructor produced, rewrites `return <source>` and
// evaluates that. It's a hot path: Alpine compiles every directive with
// `new Function`, Vue 2 compiles render functions with it, and lodash/underscore
// templates and most CSP-unsafe expression evaluators do the same.

export default [
	basicTest({
		name: "functionctor-basic",
		js: `
			const f = new Function("a", "b", "return a + b");
			assertEqual(f(1, 2), 3, "call");
			assertEqual(f.length, 2, "length");
			assertEqual(f.name, "anonymous", "name");
			assertEqual(typeof f, "function", "typeof");
			assertEqual(new Function("return 42")(), 42, "no parameters");
			assertEqual(new Function()(), undefined, "no arguments at all");
			assertEqual(Function("return 7")(), 7, "called without new");
			assertEqual(new Function("a,b", "return a*b")(3, 4), 12, "comma-joined parameter list");
			assertEqual(new Function(...["a", "return a"])(5), 5, "spread arguments");
		`,
	}),
	basicTest({
		name: "functionctor-scope",
		js: `
			const notVisible = 5;
			assertEqual(new Function("return typeof notVisible")(), "undefined", "no closure over the creating scope");
			assertEqual(new Function("return this")(), window, "this is the global");
			assertEqual(new Function("'use strict'; return this")(), undefined, "strict body");
			assertEqual(new Function("return arguments.length")(1, 2, 3), 3, "arguments");
			assertEqual(new Function("return typeof new.target")(), "undefined", "new.target when called plainly");
			window.fnGlobal = 9;
			assertEqual(new Function("return fnGlobal")(), 9, "reads globals");
			delete window.fnGlobal;
		`,
	}),
	basicTest({
		name: "functionctor-params",
		js: `
			assertEqual(new Function("a = 5", "return a")(), 5, "default parameter");
			assertEqual(new Function("...rest", "return rest.length")(1, 2), 2, "rest parameter");
			assertEqual(new Function("{ x }", "return x")({ x: 3 }), 3, "destructured parameter");
			assertEqual(new Function("[a, b]", "return a + b")([1, 2]), 3, "array destructured parameter");
			assertEqual(new Function("a = 5", "return a").length, 0, "length stops at the first default");
			assertEqual(new Function("a", "b = a", "return b")(4), 4, "later default sees an earlier parameter");
		`,
	}),
	basicTest({
		name: "functionctor-rewritten-body",
		js: `
			assertEqual(new Function("return location.href")(), location.href, "location inside the body");
			assertEqual(new Function("return window.location.href")(), location.href, "window.location inside the body");
			assertEqual(new Function("location", "return location")(5), 5, "a parameter named location shadows");
			assertEqual(new Function("return document.baseURI")(), document.baseURI, "document.baseURI");
		`,
	}),
	basicTest({
		name: "functionctor-globals-rewritten",
		js: `
			new Function("checkglobal(top)")();
			new Function("checkglobal(parent)")();
			new Function("checkglobal(eval)")();
			Function("checkglobal(top)")();
			new Function("a", "checkglobal(top)")(1);
			checkglobal(new Function("return top")());
			checkglobal(new Function("return window.top")());
		`,
	}),
	basicTest({
		name: "functionctor-syntax-errors",
		js: `
			let e1;
			try { new Function("return ]"); } catch (e) { e1 = e; }
			assert(e1 instanceof SyntaxError, "a bad body must be a SyntaxError, got " + e1);
			let e2;
			try { new Function("1bad", "return 1"); } catch (e) { e2 = e; }
			assert(e2 instanceof SyntaxError, "a bad parameter name must be a SyntaxError, got " + e2);
			let e3;
			try { new Function("return await 1"); } catch (e) { e3 = e; }
			assert(e3 instanceof SyntaxError, "await in a sync body must be a SyntaxError, got " + e3);
		`,
	}),
	basicTest({
		name: "functionctor-tostring",
		js: `
			const f = new Function("a", "return a + 1");
			const s = f.toString();
			assert(!s.includes("scramjet"), "must not stringify to rewritten source: " + s);
			assert(s.includes("return a + 1"), "the body must round trip: " + s);
			assert(s.startsWith("function anonymous"), "shape: " + s);
		`,
	}),
	basicTest({
		name: "functionctor-call-forms",
		js: `
			const f = new Function("x", "return x * 2");
			assertEqual([1, 2, 3].map(f).join(), "2,4,6", "reused as a callback");
			assertEqual(f.call(null, 5), 10, "call");
			assertEqual(f.apply(null, [5]), 10, "apply");
			assertEqual(f.bind(null, 6)(), 12, "bind");
			assertEqual(Reflect.apply(f, null, [7]), 14, "Reflect.apply");
			assertEqual(new Function("return this.v").call({ v: "V" }), "V", "explicit receiver");
		`,
	}),
	basicTest({
		name: "functionctor-as-constructor",
		js: `
			const Ctor = new Function("this.x = 1");
			const inst = new Ctor();
			assertEqual(inst.x, 1, "used as a constructor");
			assert(inst instanceof Ctor, "instanceof");
			Ctor.prototype.m = function () { return "m"; };
			assertEqual(new Ctor().m(), "m", "prototype methods");
		`,
	}),
	basicTest({
		name: "functionctor-with-expression-compiler",
		js: `
			// how Alpine- and Vue2-style expression compilers build accessors
			const compile = (expr) => new Function("$data", "with ($data) { return (" + expr + "); }");
			assertEqual(compile("a + b")({ a: 1, b: 2 }), 3, "with-scoped expression");
			assertEqual(compile("items.length")({ items: [1, 2, 3] }), 3, "member access");
			assertEqual(compile("location")({ location: "paris" }), "paris", "a data key named location");
			assertEqual(compile("top")({ top: 10 }), 10, "a data key named top");
			assertEqual(compile("a ? b : c")({ a: 1, b: "y", c: "n" }), "y", "conditional");
		`,
	}),
	basicTest({
		name: "functionctor-flavor-names",
		js: `
			assertEqual((async function () {}).constructor.name, "AsyncFunction", "AsyncFunction.name");
			assertEqual((function* () {}).constructor.name, "GeneratorFunction", "GeneratorFunction.name");
			assertEqual((async function* () {}).constructor.name, "AsyncGeneratorFunction", "AsyncGeneratorFunction.name");
			assertEqual(Object.getPrototypeOf(async function () {}).constructor.name, "AsyncFunction", "via getPrototypeOf");
		`,
	}),

	// ------------------------------------------------------------------
	// the .constructor route into the Function family
	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: the global Function is replaced by one proxy and
		// Function.prototype.constructor by a different one, so the two are no
		// longer the same object. `x.constructor === Function` is a standard
		// type test (lodash, jQuery, Angular DI all use some variant).
		name: "functionctor-prototype-constructor-identity",
		js: `
			assertEqual((function () {}).constructor, Function, "Function.prototype.constructor === Function");
			assertEqual(Function.prototype.constructor, Function, "read directly off the prototype");
			assertEqual((() => {}).constructor, Function, "arrow function constructor");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: for the async/generator constructors the interceptor
		// evaluates `return <source>` *inside a function of the same flavor*, so
		// what comes back is a Promise (or a generator) that wraps the function
		// instead of the function itself.
		name: "functionctor-async-flavor",
		js: `
			const AsyncFunction = (async function () {}).constructor;
			const f = new AsyncFunction("return 1");
			assertEqual(typeof f, "function", "AsyncFunction must produce a function");
			assertEqual(await f(), 1, "and it must resolve to the body's value");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "functionctor-generator-flavor",
		js: `
			const GeneratorFunction = (function* () {}).constructor;
			const f = new GeneratorFunction("yield 1; yield 2");
			assertEqual(typeof f, "function", "GeneratorFunction must produce a function");
			assertDeepEqual([...f()], [1, 2], "and it must be iterable");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "functionctor-asyncgenerator-flavor",
		js: `
			const AsyncGeneratorFunction = (async function* () {}).constructor;
			const f = new AsyncGeneratorFunction("yield 1");
			assertEqual(typeof f, "function", "AsyncGeneratorFunction must produce a function");
			assertEqual((await f().next()).value, 1, "first yielded value");
		`,
	}),
];
