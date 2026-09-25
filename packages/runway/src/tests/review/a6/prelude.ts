import { basicTest, htmlTest, type Test } from "../../../testcommon.ts";

const t = (name: string, js: string) =>
	basicTest({
		name: "rv6-pre-" + name,
		js,
	});

export default [
	t(
		"eval-semantics",
		`
		assertEqual(eval("1+1"), 2, "eval value");
		assertEqual(eval("{}"), undefined, "block completion");
		assertEqual(eval("'x'"), "x", "string completion (directive-looking)");
		assertEqual(eval("'use strict'; 5"), 5);
		eval("'use strict'; var rv6strictvar = 1");
		assertEqual(typeof rv6strictvar, "undefined", "strict eval var does not leak");
		eval("var rv6sloppyvar = 1");
		assertEqual(typeof rv6sloppyvar, "number", "sloppy eval var leaks");
		assertEqual(new Function("'use strict'; return this")(), undefined, "strict new Function");
	`
	),
	t(
		"fn-tostring",
		`
		assertEqual(new Function("a", "return a").toString(), "function anonymous(a\\n) {\\nreturn a\\n}");
		assertEqual(eval("(function f(){ return 1 })").toString(), "function f(){ return 1 }");
		function g(x) { return x; }
		assertEqual(g.toString(), "function g(x) { return x; }");
	`
	),
	htmlTest({
		name: "rv6-pre-inline-strict-and-lineno",
		html: `<!doctype html><body>
<script>"use strict";
window.__strict = (function () { return this === undefined; })();
window.__line = new Error().stack.split("\\n")[1];
</script>
<script>
addEventListener("error", (e) => { window.__errline = e.lineno; window.__errcol = e.colno; e.preventDefault(); });
</script>
<script>
  throw new Error("x");
</script>
<script>
runTest(async () => {
  assertEqual(window.__strict, true, "use strict directive still effective");
  assertEqual(window.__errline + ":" + window.__errcol, "12:9", "error event lineno:colno");
  assertEqual(window.__errcol, 9, "error event colno");
  assert(/:3:/.test(window.__line), "stack line " + window.__line);
});
</script></body>`,
	}),
	t(
		"json-like-and-scripts",
		`
		const s = document.createElement("script");
		s.textContent = "window.__cs = document.currentScript === s0;";
		window.s0 = s;
		document.body.appendChild(s);
		assertEqual(window.__cs, true, "currentScript");
		const j = document.createElement("script"); j.type = "application/json"; j.textContent = '{"a":1}';
		document.body.appendChild(j);
		assertEqual(JSON.parse(j.textContent).a, 1, "json script text untouched");
		assertEqual(j.textContent, '{"a":1}');
		assertEqual(s.textContent, "window.__cs = document.currentScript === s0;", "script text not showing prelude");
		assertEqual(s.text, s.textContent);
		assertEqual(s.innerHTML, s.textContent);
	`
	),
] as Test[];
