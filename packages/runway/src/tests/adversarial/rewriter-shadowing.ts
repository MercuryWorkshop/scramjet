import { basicTest } from "../../testcommon.ts";

// A page is free to use `location`, `top`, `parent` and `eval` as ordinary
// local names. The rewriter has no scope analysis, so it has to be careful:
// wrapping a *shadowed* identifier is harmless (wrapfn only substitutes when
// the value is identical to the real global), but rewriting a *declaration* is
// not.
//
// `var location = …` currently becomes
//   var $scramjet$temploc = …; $scramjet$tryset(location,"=",$scramjet$temploc)
//     || (location = $scramjet$temploc);
// so the local binding is renamed out from under the rest of the function and
// the value is pushed at the *global* `location` instead. Every later read of
// the page's own variable resolves to the location proxy.

export default [
	basicTest({
		name: "shadowing-let-const",
		js: `
			{
				let location = 1, top = 2, parent = 3;
				assertEqual(location, 1, "let location");
				assertEqual(top, 2, "let top");
				assertEqual(parent, 3, "let parent");
			}
			{
				const location = "c";
				assertEqual(location, "c", "const location");
			}
			assertEqual((function () { let location = 6; return location; })(), 6, "let inside a function");
		`,
	}),
	basicTest({
		name: "shadowing-params",
		js: `
			assertEqual((function (location) { return location; })(5), 5, "parameter named location");
			assertEqual((function (top, parent) { return top + parent; })(1, 2), 3, "parameters named top/parent");
			assertEqual(((location) => location)("arrow"), "arrow", "arrow parameter");
			assertEqual((function ({ location }) { return location; })({ location: 9 }), 9, "destructured parameter");
			assertEqual((function (location = 4) { return location; })(), 4, "default parameter");
			assertEqual((function (...location) { return location.length; })(1, 2), 2, "rest parameter");
		`,
	}),
	basicTest({
		name: "shadowing-catch-and-function-decl",
		js: `
			assertEqual((function () { try { throw 5; } catch (location) { return location; } })(), 5, "catch parameter");
			assertEqual((function () { function location() { return "fn"; } return location(); })(), "fn", "function declaration named location");
			assertEqual((function () { class location {} return typeof location; })(), "function", "class declaration named location");
		`,
	}),
	basicTest({
		name: "shadowing-var-top-parent",
		js: `
			assertEqual((function () { var top = 6; return top; })(), 6, "var top");
			assertEqual((function () { var parent = 7; return parent; })(), 7, "var parent");
			assertEqual((function () { var eval = 8; return eval; })(), 8, "var eval");
			assertEqual(new Function("var top = 6; return top")(), 6, "var top inside a Function body");
		`,
	}),

	// ------------------------------------------------------------------
	// var location
	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: the declaration is renamed to $scramjet$temploc and the
		// initializer is assigned to the real global location instead.
		name: "shadowing-var-location",
		js: `
			assertEqual((function () { var location = 6; return location; })(), 6, "var location in a function");
		`,
	}),
	basicTest({
		// The value is pushed at the global `location`, so this guards the worst
		// case: a page that writes `var location = "/somewhere"` must not end up
		// navigating itself.
		name: "shadowing-var-location-must-not-navigate",
		js: `
			const before = location.href;
			(function () { var location = "#hijacked"; })();
			await new Promise((r) => setTimeout(r, 300));
			assertEqual(location.href, before, "a local var named location must not navigate the page");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-declare-then-assign",
		js: `
			assertEqual((function () { var location; location = 6; return location; })(), 6, "declare then assign");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-multi-declarator",
		js: `
			assertEqual((function () { var a = 1, location = 6; return location; })(), 6, "second declarator in a var statement");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-nested-block",
		js: `
			assertEqual((function () { { var location = 6; } return location; })(), 6, "var location declared in a nested block");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-arrow",
		js: `
			assertEqual((() => { var location = 6; return location; })(), 6, "var location in an arrow function");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-closure",
		js: `
			assertEqual((function () {
				var location = 6;
				return (function () { return location; })();
			})(), 6, "a nested closure reads the outer var");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: `for (var location = 0; …)` is the same declaration
		// path, so the loop counter is assigned to the global on every entry.
		name: "shadowing-var-location-for-loop",
		js: `
			assertEqual((function () {
				var out;
				for (var location = 0; location < 3; location++) out = location;
				return out;
			})(), 2, "var location as a loop counter");
		`,
	}),
	basicTest({
		// KNOWN FAILURE
		name: "shadowing-var-location-function-ctor",
		js: `
			assertEqual(new Function("var location = 6; return location")(), 6, "var location inside a Function body");
		`,
	}),
];
