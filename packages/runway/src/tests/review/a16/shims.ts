import { site } from "./lib.ts";

const shimPage = (ver: string, extraHead = "") => `<!doctype html><html><head>
<script async src="https://ga.jspm.io/npm:es-module-shims@${ver}/dist/es-module-shims.js"></script>
<script type="importmap">{"imports":{"app":"/app.js","lib/":"/lib/"}}</script>${extraHead}
</head><body>
<script type="module">
import { v } from "app";
runTest(async () => {
  assertConsistent("static", v);
  let d; try { d = (await import("app")).v; } catch (e) { d = "ERR " + e.message.slice(0, 60); }
  assertConsistent("dyn", d);
  let p; try { p = (await import("lib/x.js")).v; } catch (e) { p = "ERR " + e.message.slice(0, 60); }
  assertConsistent("dyn-prefix", p);
  assertConsistent("shim-mode", typeof importShim);
}, true);
</script></body></html>`;

const files = {
	"/app.js": "export const v = 'app';",
	"/lib/x.js": "export const v = 'libx';",
};

export default [
	site("rv16-shims-1.10", {
		...files,
		"/": shimPage("1.10.0"),
	}),
	site("rv16-shims-1.8", {
		...files,
		"/": shimPage("1.8.3"),
	}),
];
