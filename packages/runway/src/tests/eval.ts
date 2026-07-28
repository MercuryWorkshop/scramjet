import { basicTest, htmlTest } from "../testcommon.ts";

// Coverage for packages/core/src/client/shared/eval.ts (the direct-eval
// rewritefn and the indirect-eval proxy) plus the rewriter's `eval` call-site
// handling in rewriter/js/src/visitor.rs.
//
// Two failure modes matter here:
//   1. escapes  - eval'd code that wasn't rewritten, so it can see the real
//                 `top`/`parent`/`location`/`eval`. Covered with checkglobal().
//   2. divergences - eval behaving differently than it does on the open web.
//                 Anything without checkglobal() runs in both the scramjet and
//                 the bare harness and must agree.

export default [
	basicTest({
		name: "eval-direct-sanity",
		autoPass: false,
		js: `
    	eval("pass()");
    `,
	}),
	basicTest({
		name: "eval-indirect-sanity",
		autoPass: false,
		js: `
	    (0,eval)("pass()");
	  `,
	}),
	basicTest({
		name: "eval-direct-rewritten",
		js: `
    	eval("checkglobal(top)");
    `,
	}),
	basicTest({
		name: "eval-indirect-rewritten",
		js: `
		  (0,eval)("checkglobal(top)");
		`,
	}),
	basicTest({
		name: "eval-direct-is-direct",
		js: `
			window.local = 231;
		  {
				let local = 514;
				eval("assertEqual(local, 514, 'direct eval should have local scope');");
				(0,eval)("assertEqual(local, 231, 'indirect eval should have global scope');");
			}
		`,
	}),
	basicTest({
		name: "eval-strict",
		js: `
			  function testStrictEval() {
					"use strict";
					eval("assert((function(){return !this;})() === true, 'strict function should be strict')")
				}
				function testSloppyEval() {
					eval("assert((function(){return !this;})() === false, 'sloppy function should be sloppy')")
				}
				function testIndirectEval() {
					"use strict";
					(0,eval)("assert((function(){return !this;})() === false, 'indirect eval should be sloppy even in strict context')")
				}
				testStrictEval();
				testSloppyEval();
				testIndirectEval();
			`,
	}),

	// ------------------------------------------------------------------
	// the indirect eval proxy as a function object
	//
	// createIndirectEval() is memoized per client, so every route to `eval`
	// has to hand back the *same* object and it has to keep looking like the
	// native eval. Fingerprinting scripts check all of this.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-indirect-identity-stable",
		js: `
			assertEqual((0,eval), (0,eval), "indirect eval must not be regenerated per access");
			assertEqual(window.eval, window.eval, "window.eval must be stable");
			assertEqual(window.eval, (0,eval), "window.eval and (0,eval) must be the same object");
		`,
	}),
	basicTest({
		name: "eval-indirect-identity-all-views",
		js: `
			// every one of these resolves through a different rewrite path
			// (wrapfn, the $scramjet__eval accessor, wrappropertyfn, and a
			// rewrite performed inside eval itself) and they must converge.
			const views = new Set([
				eval,
				window.eval,
				globalThis.eval,
				self.eval,
				window["eval"],
				window["ev" + "al"],
				eval("eval"),
				(0,eval)("eval"),
			]);
			assertEqual(views.size, 1, "all views of eval must be the same object");
		`,
	}),
	basicTest({
		name: "eval-indirect-function-shape",
		js: `
			assertEqual(typeof window.eval, "function", "typeof");
			assert(window.eval instanceof Function, "instanceof Function");
			assertEqual(Object.getPrototypeOf(window.eval), Function.prototype, "prototype chain");
			assertEqual(window.eval.name, "eval", "name");
			assertEqual(window.eval.length, 1, "length");
			assertEqual(window.eval.prototype, undefined, "eval must not have a .prototype");
			assert(Object.isExtensible(window.eval), "extensible");
			assertDeepEqual(
				Object.getOwnPropertyNames(window.eval).sort(),
				["length", "name"],
				"own property names"
			);
			const d = Object.getOwnPropertyDescriptor(window.eval, "name");
			assertEqual(d.value, "eval", "name descriptor value");
			assertEqual(d.writable, false, "name must not be writable");
			assertEqual(d.configurable, true, "name must be configurable");
		`,
	}),
	basicTest({
		name: "eval-indirect-not-a-constructor",
		js: `
			let threw = false;
			try { new (0,eval)("1"); } catch (e) { threw = e instanceof TypeError; }
			assert(threw, "new eval() must throw a TypeError");
		`,
	}),
	basicTest({
		name: "eval-indirect-call-apply-bind",
		js: `
			assertEqual((0,eval).call(undefined, "1+1"), 2, "Function.prototype.call");
			assertEqual((0,eval).apply(null, ["1+1"]), 2, "Function.prototype.apply");
			assertEqual(Reflect.apply(window.eval, null, ["1+1"]), 2, "Reflect.apply");
			assertEqual(window.eval.bind(null)("1+1"), 2, "Function.prototype.bind");
			assertEqual(["1+1"].map(window.eval)[0], 2, "used as a higher-order callback");
		`,
	}),
	basicTest({
		name: "eval-indirect-tostring-native",
		js: `
			const s = String(window.eval);
			assert(s.includes("native code"), "eval must stringify as native code, got: " + s);
			assert(
				Function.prototype.toString.call(window.eval).includes("native code"),
				"Function.prototype.toString.call(eval) must stringify as native code"
			);
		`,
	}),
	basicTest({
		// V8 renders Function.prototype.toString of a *proxied* function
		// without the target's name, so the indirect eval has to be registered
		// in box.unproxy for the toString trap in shared/sourcemaps.ts to swap
		// it back out. Regression test for that registration.
		name: "eval-indirect-tostring-preserves-name",
		js: `
			assertEqual(
				String(window.eval),
				"function eval() { [native code] }",
				"eval must stringify with its name"
			);
		`,
	}),

	// ------------------------------------------------------------------
	// argument handling
	//
	// > If the argument of eval() is not a string, eval() returns the argument
	// > unchanged
	// Both the rewritefn and the proxy's apply trap have to bail out early
	// without coercing, and they must not disturb the completion value.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-nonstring-passthrough",
		js: `
			const obj = {};
			const arr = [1];
			const fn = function () {};
			const sym = Symbol("s");
			for (const ev of [eval, (0,eval), window.eval]) {
				assertEqual(ev(42), 42, "number");
				assertEqual(ev(null), null, "null");
				assertEqual(ev(undefined), undefined, "undefined");
				assertEqual(ev(true), true, "boolean");
				assertEqual(ev(obj), obj, "object identity");
				assertEqual(ev(arr), arr, "array identity");
				assertEqual(ev(fn), fn, "function identity");
				assertEqual(ev(sym), sym, "symbol identity");
			}
		`,
	}),
	basicTest({
		name: "eval-nonstring-not-coerced",
		js: `
			const strObj = new String("1+1");
			assertEqual(eval(strObj), strObj, "direct eval of a String object returns it unchanged");
			assertEqual((0,eval)(strObj), strObj, "indirect eval of a String object returns it unchanged");
			const tricky = {
				toString() { fail("eval must not stringify its argument"); return "1+1"; },
				valueOf() { fail("eval must not coerce its argument"); return "1+1"; },
			};
			assertEqual(eval(tricky), tricky, "direct eval must not coerce");
			assertEqual((0,eval)(tricky), tricky, "indirect eval must not coerce");
		`,
	}),
	basicTest({
		name: "eval-empty-completion-values",
		js: `
			// a rewriter that prepends anything (a sourcemap registration, say)
			// to the rewritten source would change every one of these.
			assertEqual(eval(), undefined, "eval() with no arguments");
			assertEqual(eval(""), undefined, "empty string");
			assertEqual(eval(";"), undefined, "empty statement");
			assertEqual(eval("// nothing"), undefined, "line comment only");
			assertEqual(eval("/* nothing */"), undefined, "block comment only");
			assertEqual(eval("   "), undefined, "whitespace only");
			assertEqual((0,eval)(""), undefined, "indirect, empty string");
			assertEqual((0,eval)("/* nothing */"), undefined, "indirect, comment only");
		`,
	}),
	basicTest({
		name: "eval-directive-completion-value",
		js: `
			// a lone directive prologue is also an expression statement, so its
			// string is the completion value.
			assertEqual(eval("'use strict'"), "use strict", "lone directive");
			assertEqual((0,eval)("'use strict'"), "use strict", "indirect lone directive");
		`,
	}),
	basicTest({
		name: "eval-completion-values",
		js: `
			assertEqual(eval("1;2;"), 2, "last expression statement wins");
			assertEqual(eval("if (true) { 3 }"), 3, "through a block");
			assertEqual(eval("var v1 = 5"), undefined, "declarations have no completion value");
			assertEqual(eval("{}"), undefined, "empty block");
			assertEqual(typeof eval("({})"), "object", "parenthesized object literal");
			assertEqual(eval("for (let i = 0; i < 3; i++) { i }"), 2, "loop");
			assertEqual(eval("try { 1 } finally { 2 }"), 1, "try/finally");
			assertEqual(eval("switch (1) { case 1: 9 }"), 9, "switch");
			assertEqual(eval("l1: { 4; break l1; }"), 4, "labelled block");
			assertEqual(eval("1+1 // trailing comment"), 2, "trailing line comment");
			assertEqual(eval("1+1 /* trailing */"), 2, "trailing block comment");
			assertEqual(eval("1+1\\n//# sourceURL=eval-test.js"), 2, "trailing sourceURL comment");
		`,
	}),
	basicTest({
		name: "eval-extra-and-spread-args",
		js: `
			assertEqual(eval("1+1", "2+2"), 2, "extra arguments are ignored");
			assertEqual(eval(...["1+1"]), 2, "spread argument");
			assertEqual(eval("1+1",), 2, "trailing comma in the argument list");
			assertEqual((0,eval)("1+1", "2+2"), 2, "indirect, extra arguments ignored");
		`,
	}),
	basicTest({
		name: "eval-debugger-statement",
		js: `
			// the rewriter deletes debugger statements outright; that must not
			// change what the surrounding program evaluates to.
			assertEqual(eval("debugger; 5"), 5, "debugger followed by a value");
			assertEqual(eval("debugger"), undefined, "lone debugger statement");
		`,
	}),

	// ------------------------------------------------------------------
	// call-site syntax
	//
	// visit_call_expression() only rewrites `eval(...)` when the callee is a
	// bare, non-optional identifier, and it derives the argument span from the
	// callee's end offset. Both of those are easy to get wrong.
	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: the injected rewritefn call is placed at
		// `callee.span.end + 1`, so any whitespace between `eval` and `(`
		// leaves it outside the argument list: `eval $scramjet$rewrite(("x"))`.
		name: "eval-callee-whitespace",
		js: `
			assertEqual(eval ("1+1"), 2, "space between callee and argument list");
			assertEqual(eval\t("1+1"), 2, "tab between callee and argument list");
			assertEqual(eval
				("1+1"), 2, "newline between callee and argument list");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same offset arithmetic, except here the rewritefn
		// lands *inside* the comment: `eval/$scramjet$rewrite(*c*/("x"))`.
		name: "eval-callee-comment",
		js: `
			assertEqual(eval/* hi */("1+1"), 2, "comment between callee and argument list");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: parentheses around the callee are transparent, so this
		// is still a direct eval per spec, but the rewriter sees a plain
		// identifier reference and wraps it into the indirect eval instead.
		name: "eval-parenthesized-is-direct",
		js: `
			window.pv = 1;
			{
				let pv = 2;
				assertEqual((eval)("pv"), 2, "(eval)(...) is a direct eval");
				assertEqual(((eval))("pv"), 2, "((eval))(...) is a direct eval");
			}
			delete window.pv;
		`,
	}),
	basicTest({
		name: "eval-optional-call-is-indirect",
		js: `
			// eval?.() is an indirect eval, so it must not see the block scope.
			window.ov = 1;
			{
				let ov = 2;
				assertEqual(eval?.("ov"), 1, "eval?.() must resolve in global scope");
			}
			delete window.ov;
		`,
	}),
	basicTest({
		name: "eval-optional-call-rewritten",
		js: `
			eval?.("checkglobal(top)");
		`,
	}),
	basicTest({
		name: "eval-indirect-forms-rewritten",
		js: `
			// every way of reaching eval without a direct call still has to
			// route through the indirect eval proxy
			window.eval("checkglobal(top)");
			globalThis.eval("checkglobal(top)");
			self.eval("checkglobal(top)");
			window["eval"]("checkglobal(top)");
			window["ev" + "al"]("checkglobal(top)");
			top.eval("checkglobal(top)");
			parent.eval("checkglobal(top)");
			[eval][0]("checkglobal(top)");
			(1, 2, eval)("checkglobal(top)");
			void eval("checkglobal(top)");
			eval.call(null, "checkglobal(top)");
			eval.apply(null, ["checkglobal(top)"]);
			eval.bind(null)("checkglobal(top)");
			Reflect.apply(eval, null, ["checkglobal(top)"]);
			(function () { return eval; })()("checkglobal(top)");
			const { eval: destructured } = window;
			destructured("checkglobal(top)");
			const [fromArray] = [eval];
			fromArray("checkglobal(top)");
		`,
	}),
	basicTest({
		name: "eval-nested-forms-rewritten",
		js: `
			// the rewritefn and the wrapfn both have to be reachable from inside
			// already-eval'd code
			eval("eval('checkglobal(top)')");
			eval("(0,eval)('checkglobal(top)')");
			(0,eval)("eval('checkglobal(top)')");
			(0,eval)("(0,eval)('checkglobal(top)')");
			eval("window.eval('checkglobal(top)')");
			eval("eval(\\"eval('checkglobal(top)')\\")");
		`,
	}),
	basicTest({
		name: "eval-escaped-identifier-rewritten",
		js: `
			// unicode escapes in identifiers/property names are a classic way to
			// slip past a rewriter that matches on raw source text
			const bs = String.fromCharCode(92);
			eval("checkglobal(" + bs + "u0074op)");
			eval("window." + bs + "u0065val('checkglobal(top)')");
			eval('window["' + bs + 'u0065val"]("checkglobal(top)")');
		`,
	}),
	basicTest({
		name: "eval-function-ctor-returns-eval",
		js: `
			new Function("return eval")()("checkglobal(top)");
			eval("new Function('checkglobal(top)')()");
			eval("Function('checkglobal(top)')()");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: Reflect.get bypasses the $scramjet__eval accessor and
		// hands out the realm's real eval, whose output is never rewritten.
		name: "eval-reflect-get-leak",
		js: `
			Reflect.get(window, "eval")("checkglobal(top)");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same leak through a property descriptor.
		name: "eval-gopd-leak",
		js: `
			Object.getOwnPropertyDescriptor(window, "eval").value("checkglobal(top)");
		`,
	}),

	// ------------------------------------------------------------------
	// direct eval scope semantics
	//
	// The rewritefn must not turn a direct eval into anything else: the eval'd
	// code keeps the caller's variable environment, this-binding, new.target,
	// super-binding and strictness.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-direct-arguments",
		js: `
			assertEqual((function () { return eval("arguments[0]"); })(42), 42, "arguments object");
			assertEqual((function () { return eval("arguments.length"); })(1, 2, 3), 3, "arguments.length");
		`,
	}),
	basicTest({
		name: "eval-direct-this",
		js: `
			const obj = { m() { return eval("this"); } };
			assertEqual(obj.m(), obj, "this-binding of the calling method");
			assertEqual(eval("this"), window, "script-level this");
			const arrow = () => eval("this");
			assertEqual(arrow.call({ nope: 1 }), window, "arrow this stays lexical");
			assertEqual((function () { return eval("this"); }).call(obj), obj, "explicit this");
		`,
	}),
	basicTest({
		name: "eval-direct-new-target",
		js: `
			function F() { this.nt = eval("new.target"); }
			assertEqual(new F().nt, F, "new.target inside direct eval");
			const plain = {};
			F.call(plain);
			assertEqual(plain.nt, undefined, "new.target is undefined for a plain call");
		`,
	}),
	basicTest({
		name: "eval-direct-super",
		js: `
			class B { m() { return 1; } }
			class D extends B { m() { return eval("super.m()"); } }
			assertEqual(new D().m(), 1, "super property access inside direct eval");
			class B2 { constructor() { this.x = 7; } }
			class D2 extends B2 { constructor() { eval("super()"); } }
			assertEqual(new D2().x, 7, "super() callable from direct eval");
		`,
	}),
	basicTest({
		name: "eval-direct-function-hoisting",
		js: `
			assertEqual((function () {
				eval("function hoisted() { return 7; }");
				return hoisted();
			})(), 7, "function declarations hoist into the calling function scope");
		`,
	}),
	basicTest({
		name: "eval-direct-lexical-not-leaked",
		js: `
			eval("let lexLet = 1; const lexConst = 2; class LexClass {}");
			assertEqual(typeof lexLet, "undefined", "let must not escape eval");
			assertEqual(typeof lexConst, "undefined", "const must not escape eval");
			assertEqual(typeof LexClass, "undefined", "class must not escape eval");
			assertEqual(eval("class C2 {}; typeof C2"), "function", "class usable within eval");
		`,
	}),
	basicTest({
		name: "eval-direct-tdz",
		js: `
			let threw = false;
			{
				try { eval("tdzVar"); } catch (e) { threw = e instanceof ReferenceError; }
				let tdzVar = 1;
			}
			assert(threw, "direct eval must observe the TDZ of an enclosing let");
		`,
	}),
	basicTest({
		name: "eval-direct-default-param",
		js: `
			function f(a = eval("1+1")) { return a; }
			assertEqual(f(), 2, "eval in a default parameter initializer");
			function g(a, b = eval("a + 1")) { return b; }
			assertEqual(g(4), 5, "eval sees earlier parameters");
		`,
	}),
	basicTest({
		name: "eval-direct-class-body",
		js: `
			class C {
				static field = eval("1+1");
				static { this.blockField = eval("2+2"); }
				inst = eval("3+3");
			}
			assertEqual(C.field, 2, "static field initializer");
			assertEqual(C.blockField, 4, "static initialization block");
			assertEqual(new C().inst, 6, "instance field initializer");
		`,
	}),
	basicTest({
		name: "eval-direct-strict-var-no-leak",
		js: `
			function f() { "use strict"; eval("var sv = 1"); return typeof sv; }
			assertEqual(f(), "undefined", "a strict direct eval keeps var in its own scope");
			assertEqual(window.sv, undefined, "and definitely not on the global");
		`,
	}),
	basicTest({
		name: "eval-direct-with-scope",
		js: `
			const holder = { wv: 9 };
			with (holder) {
				assertEqual(eval("wv"), 9, "direct eval resolves with-scope bindings");
				assertEqual((0,eval)("typeof wv"), "undefined", "indirect eval must not");
			}
		`,
	}),
	basicTest({
		name: "eval-direct-closure-mutation",
		js: `
			const fn = eval("(function () { return 'from-eval'; })");
			assertEqual(fn(), "from-eval", "functions returned from eval are callable");
			let counter = 0;
			const bump = eval("(function () { return ++counter; })");
			assertEqual(bump(), 1, "closure captures the calling scope");
			assertEqual(counter, 1, "and actually mutates it");
		`,
	}),
	basicTest({
		name: "eval-nested-scope-chain",
		js: `
			let outer = 1;
			(function () {
				let mid = 2;
				eval("(function () { let inner = 3; eval('assertEqual(outer + mid + inner, 6, \\\\'nested direct evals must keep the whole scope chain\\\\')') })()");
			})();
		`,
	}),

	// ------------------------------------------------------------------
	// strictness and directive prologues
	//
	// rewriteJs() has a special case that keeps injected code from landing in
	// front of "use strict"; if that ever slips, eval'd code silently becomes
	// sloppy.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-directive-makes-strict",
		js: `
			assertEqual(eval("'use strict'; (function () { return this; })()"), undefined, "single-quoted directive");
			assertEqual(eval('"use strict"; (function () { return this; })()'), undefined, "double-quoted directive");
			assertEqual((0,eval)("'use strict'; (function () { return this; })()"), undefined, "indirect eval");
			assertEqual(eval("\\n'use strict';\\n(function () { return this; })()"), undefined, "leading newline");
			assertEqual(eval("  'use strict'; (function () { return this; })()"), undefined, "leading whitespace");
		`,
	}),
	basicTest({
		name: "eval-directive-after-comment",
		js: `
			// a comment before the prologue does not stop it being a directive
			assertEqual(eval("/* c */ 'use strict'; (function () { return this; })()"), undefined, "block comment first");
			assertEqual(eval("// c\\n'use strict'; (function () { return this; })()"), undefined, "line comment first");
		`,
	}),
	basicTest({
		name: "eval-strict-indirect-no-var-leak",
		js: `
			(0,eval)("'use strict'; var strictIndirect = 1");
			assertEqual(window.strictIndirect, undefined, "a strict indirect eval must not leak var to the global");
			(0,eval)("var sloppyIndirect = 1");
			assertEqual(window.sloppyIndirect, 1, "a sloppy indirect eval must leak var to the global");
			delete window.sloppyIndirect;
		`,
	}),
	basicTest({
		name: "eval-strict-undeclared-assign-throws",
		js: `
			let threw = false;
			try { (0,eval)("'use strict'; undeclaredThing = 1"); } catch (e) { threw = e instanceof ReferenceError; }
			assert(threw, "strict eval must throw on assignment to an undeclared name");
			assertEqual(window.undeclaredThing, undefined, "and must not create the global");
		`,
	}),
	htmlTest({
		name: "eval-module-context",
		html: `<!DOCTYPE html><html><body><script type="module">
			runTest(async () => {
				// direct eval inherits the module's strictness, but the eval'd
				// code is still *script* code, not module code
				assertEqual(eval("(function () { return this; })()"), undefined, "direct eval in a module is strict");
				eval("var mv = 1");
				assertEqual(typeof mv, "undefined", "strict eval keeps var out of the module scope");
				assertEqual(eval("this"), undefined, "module top-level this is undefined");
				assertEqual((0,eval)("this"), window, "indirect eval this is still the global");
				let e;
				try { eval("import.meta"); } catch (err) { e = err; }
				assert(e instanceof SyntaxError, "import.meta is a SyntaxError in eval'd script code, got " + e);
			}, true);
		</script></body></html>`,
	}),

	// ------------------------------------------------------------------
	// errors
	//
	// A rewriter that fails to parse must not swallow the failure, change the
	// error type, or hand the original source through unrewritten.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-syntax-errors",
		js: `
			const cases = [
				["var 1x = 2", "invalid identifier"],
				["}}}", "unbalanced braces"],
				["return 1", "top-level return"],
				["await 1", "top-level await"],
				["import.meta", "import.meta in script code"],
				["let dup = 1; let dup = 2", "duplicate lexical declaration"],
				["function () {}", "anonymous function declaration"],
			];
			for (const [src, label] of cases) {
				let err;
				try { eval(src); } catch (e) { err = e; }
				assert(err instanceof SyntaxError, "direct eval, " + label + ": expected SyntaxError, got " + err);
				let err2;
				try { (0,eval)(src); } catch (e) { err2 = e; }
				assert(err2 instanceof SyntaxError, "indirect eval, " + label + ": expected SyntaxError, got " + err2);
			}
		`,
	}),
	basicTest({
		name: "eval-runtime-errors",
		js: `
			let e1;
			try { eval("null.x"); } catch (e) { e1 = e; }
			assert(e1 instanceof TypeError, "TypeError from eval'd code");
			let e2;
			try { eval("throw new Error('boom')"); } catch (e) { e2 = e; }
			assertEqual(e2.message, "boom", "thrown value propagates unchanged");
			let e3;
			try { eval("(function () { throw new RangeError('r'); })()"); } catch (e) { e3 = e; }
			assert(e3 instanceof RangeError, "error class survives the eval boundary");
			let e4;
			try { (0,eval)("notDefinedAnywhere"); } catch (e) { e4 = e; }
			assert(e4 instanceof ReferenceError, "ReferenceError from an indirect eval");
			let e5;
			try { eval("throw 'a string'"); } catch (e) { e5 = e; }
			assertEqual(e5, "a string", "non-Error throw completions pass through");
		`,
	}),

	// ------------------------------------------------------------------
	// rewriting applied to the eval'd source itself
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-location-read",
		js: `
			assertEqual(eval("location.href"), location.href, "direct eval location.href");
			assertEqual((0,eval)("location.href"), location.href, "indirect eval location.href");
			assertEqual(eval("window.location.href"), location.href, "window.location.href");
			assertEqual(eval("document.location.href"), location.href, "document.location.href");
			assertEqual(eval("location.origin"), location.origin, "location.origin");
			assertEqual(eval("String(location)"), String(location), "stringified location");
		`,
	}),
	basicTest({
		name: "eval-location-write",
		js: `
			eval("location.hash = 'direct'");
			assertEqual(location.hash, "#direct", "direct eval writing location.hash");
			(0,eval)("location.hash = 'indirect'");
			assertEqual(location.hash, "#indirect", "indirect eval writing location.hash");
			eval("location.hash = ''");
		`,
	}),
	basicTest({
		name: "eval-this-and-globalthis",
		js: `
			assertEqual((0,eval)("this"), window, "indirect eval this is the global");
			assertEqual((0,eval)("globalThis"), window, "globalThis inside eval");
			assertEqual(eval("typeof eval"), "function", "eval is visible to eval'd code");
			assertEqual(eval("typeof globalThis.eval"), "function", "so is globalThis.eval");
		`,
	}),
	basicTest({
		name: "eval-function-tostring-no-leak",
		js: `
			// a function defined inside eval must not stringify back to
			// rewritten source
			const f = eval("(function evalFn() { return typeof top; })");
			const s = f.toString();
			assert(!s.includes("scramjet"), "eval'd function source must not leak rewriter internals: " + s);
			assert(s.includes("typeof top"), "eval'd function source must round-trip: " + s);
		`,
	}),
	basicTest({
		name: "eval-async-and-generators",
		js: `
			const p = (0,eval)("(async () => 1)()");
			assert(p instanceof Promise, "async arrow IIFE inside eval");
			assertEqual(await p, 1, "resolves");
			assertEqual(await eval("(async function () { return await Promise.resolve(3); })()"), 3, "await inside an eval'd async function");
			const g = eval("(function* () { yield 1; yield 2; })()");
			assertDeepEqual([...g], [1, 2], "generator created inside eval");
		`,
	}),
	basicTest({
		name: "eval-dynamic-import",
		js: `
			const p = eval("import('./eval-nonexistent-module.js')");
			assert(p instanceof Promise, "dynamic import inside eval returns a promise");
			let rejected = false;
			try { await p; } catch { rejected = true; }
			assert(rejected, "importing a missing module rejects");
		`,
	}),

	// ------------------------------------------------------------------
	// objects that merely have an "eval" property
	//
	// `eval` is one of the rewriter's UNSAFE_GLOBALS, so *every* `.eval`
	// property access in the program is redirected through the
	// $scramjet__eval accessor on Object.prototype - including accesses on
	// objects that have nothing to do with the global eval.
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-plain-object-property",
		js: `
			const o = { eval: (s) => s + "!" };
			assertEqual(o.eval("x"), "x!", "an unrelated eval property must not be rewritten");
			assertEqual(o["eval"]("x"), "x!", "computed access");
			assertEqual(typeof o.eval, "function", "typeof");
			let reads = 0;
			const g = { get eval() { reads++; return (s) => s; } };
			g.eval("y");
			assertEqual(reads, 1, "an eval getter must be invoked exactly once");
			const child = Object.create({ eval: (s) => "proto:" + s });
			assertEqual(child.eval("z"), "proto:z", "inherited eval property");
			const o2 = {};
			o2.eval = 5;
			assertEqual(o2.eval, 5, "assignment through the accessor round-trips");
			assertEqual(Object.keys(o2).join(), "eval", "and stores under the real key");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: `delete o.eval` is rewritten to
		// `delete o.$scramjet__eval`, which deletes nothing and reports success.
		name: "eval-delete-property",
		js: `
			const o = { eval: 1 };
			assertEqual(delete o.eval, true, "delete reports success");
			assertEqual("eval" in o, false, "delete o.eval must actually remove the property");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: a direct call is rewritten to
		// `eval($scramjet$rewrite(...))` without checking whether `eval` still
		// refers to the global, so a shadowing binding receives rewritten
		// source instead of what the program passed.
		name: "eval-shadowed-binding",
		js: `
			let got = null;
			const shadow = (s) => { got = s; return "shadowed"; };
			function withParam(eval) { return eval("location = 1"); }
			assertEqual(withParam(shadow), "shadowed", "a shadowing binding is what gets called");
			assertEqual(got, "location = 1", "and it must receive the source unmodified");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: wrapfn compares the incoming value against
		// `self.eval`, which is whatever the page last assigned, so an
		// overwritten window.eval still reads back as the indirect eval proxy.
		name: "eval-overwritten-global",
		js: `
			const orig = window.eval;
			try {
				window.eval = function (s) { return "custom:" + s; };
				assertEqual(window.eval("1+1"), "custom:1+1", "an overwritten window.eval must be honoured");
			} finally {
				window.eval = orig;
			}
		`,
	}),

	// ------------------------------------------------------------------
	// TrustedScript
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-trustedscript-direct",
		js: `
			const policy = window.trustedTypes.createPolicy("eval-direct", { createScript: (s) => s });
			eval(policy.createScript("checkglobal(top)"));
		`,
	}),
	basicTest({
		name: "eval-trustedscript-indirect",
		js: `
			const policy = window.trustedTypes.createPolicy("eval-indirect", { createScript: (s) => s });
			(0,eval)(policy.createScript("checkglobal(top)"));
		`,
	}),

	// ------------------------------------------------------------------
	// other realms and other global scopes
	// ------------------------------------------------------------------
	basicTest({
		name: "eval-iframe-realm",
		js: `
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			f.contentWindow.eval("checkglobal(top)");
		`,
	}),
	basicTest({
		name: "eval-worker",
		autoPass: false,
		js: `
			// shared/eval.ts is installed in workers too, where iswindow is false
			const src = [
				"self.onmessage = () => {",
				"  try {",
				"    postMessage({",
				"      direct: eval('1+1'),",
				"      indirect: (0,eval)('2+2'),",
				"      nonstring: eval(7),",
				"      identity: (0,eval) === self.eval,",
				"      name: (0,eval).name,",
				"    });",
				"  } catch (e) { postMessage({ err: String(e) }); }",
				"};",
			].join("\\n");
			const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
			await new Promise((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error("worker timed out")), 8000);
				w.onmessage = (e) => {
					clearTimeout(timer);
					if (e.data.err) return reject(new Error("worker threw: " + e.data.err));
					try {
						assertEqual(e.data.direct, 2, "direct eval in a worker");
						assertEqual(e.data.indirect, 4, "indirect eval in a worker");
						assertEqual(e.data.nonstring, 7, "non-string passthrough in a worker");
						assertEqual(e.data.identity, true, "indirect eval identity in a worker");
						assertEqual(e.data.name, "eval", "indirect eval name in a worker");
						resolve();
					} catch (err) { reject(err); }
				};
				w.onerror = (e) => { clearTimeout(timer); reject(new Error("worker error: " + e.message)); };
				w.postMessage("go");
			});
			pass();
		`,
	}),
];
