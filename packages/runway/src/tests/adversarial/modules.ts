import { serverTest } from "../../testcommon.ts";

// ES module loading: specifier resolution, import.meta.url, import maps, and
// dynamic <script> injection. import.meta.url in particular is how modern code
// finds its own sibling assets - `new URL("./worker.js", import.meta.url)` is
// the pattern every bundler emits for workers, wasm binaries and locale files.

const FILES: Record<string, string> = {
	"/p.js": `window.__preloaded = true;`,
	"/mod.js": `export const v = "modvalue"; export const metaUrl = import.meta.url;`,
	"/modchain.js": `import { v } from "/mod.js"; export const chained = "chain:" + v;`,
	"/modrel.js": `import { v } from "./mod.js"; export const rel = "rel:" + v;`,
	"/modsibling.js": `export const sibling = new URL("./mod.js", import.meta.url).href;`,
	"/classic.js": `
		window.__classicRan = (window.__classicRan || 0) + 1;
		window.__currentScriptSrc = document.currentScript && document.currentScript.src;
	`,
};

const modTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (FILES[path]) {
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(FILES[path]);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("nf");
			});
		},
	});

export default [
	modTest(
		"modules-dynamic-import",
		`
			const m = await import("/mod.js");
			assertEqual(m.v, "modvalue", "named export");
			assertEqual(await import("/mod.js"), m, "module identity is cached across imports");
			assertEqual(typeof m.metaUrl, "string", "import.meta.url is a string");
		`
	),
	modTest(
		"modules-specifier-resolution",
		`
			assertEqual((await import("/modchain.js")).chained, "chain:modvalue",
				"a module importing another module by absolute path");
			assertEqual((await import("/modrel.js")).rel, "rel:modvalue",
				"a relative specifier resolves against the importing module");
		`
	),
	modTest(
		"modules-inline-module-script",
		`
			window.__inlineResult = null;
			const s = document.createElement("script");
			s.type = "module";
			s.textContent = 'import { v } from "/mod.js"; window.__inlineResult = v;';
			document.head.appendChild(s);
			for (let i = 0; i < 60 && window.__inlineResult === null; i++) {
				await new Promise((r) => setTimeout(r, 50));
			}
			assertEqual(window.__inlineResult, "modvalue", "an inline module script with a static import");
		`
	),
	modTest(
		"modules-script-injection",
		`
			const s = document.createElement("script");
			s.src = "/classic.js";
			await new Promise((res, rej) => {
				s.onload = res;
				s.onerror = () => rej(new Error("onerror fired for a script that exists"));
				document.head.appendChild(s);
			});
			assertEqual(window.__classicRan, 1, "the injected script ran once");
			assertEqual(window.__currentScriptSrc, location.origin + "/classic.js",
				"document.currentScript.src inside it: " + window.__currentScriptSrc);
			assertEqual(s.src, location.origin + "/classic.js", "script.src property");
			assertEqual(s.getAttribute("src"), "/classic.js", "script src attribute");
		`
	),
	modTest(
		"modules-script-order",
		`
			window.__order = [];
			const mk = (n) => {
				const s = document.createElement("script");
				s.async = false;
				s.src = "/classic.js";
				s.onload = () => window.__order.push(n);
				return s;
			};
			document.head.appendChild(mk("a"));
			document.head.appendChild(mk("b"));
			await new Promise((r) => setTimeout(r, 800));
			assertDeepEqual(window.__order, ["a", "b"], "async=false injected scripts keep document order");
			assertEqual(window.__classicRan, 2, "both ran");
		`
	),

	// ------------------------------------------------------------------
	modTest(
		// KNOWN FAILURE: inside a fetched module, import.meta.url is the whole
		// proxy URL (including the $module and $io query parameters) rather than
		// the module's own URL. Anything that resolves a sibling asset from it -
		// workers, wasm, locale JSON - builds its URL from the proxy path, and any
		// code that parses or logs it sees proxy internals. An *inline* module
		// script gets this right; only fetched modules are affected.
		"modules-import-meta-url",
		`
			const m = await import("/mod.js");
			assert(!m.metaUrl.includes("/~/sj/"), "import.meta.url must not expose the proxy URL: " + m.metaUrl);
			assertEqual(m.metaUrl, location.origin + "/mod.js", "import.meta.url");
			const s = await import("/modsibling.js");
			assertEqual(s.sibling, location.origin + "/mod.js", "a sibling URL built from import.meta.url");
		`
	),
	modTest(
		// KNOWN FAILURE: <script type="importmap"> is not rewritten, so a bare
		// specifier resolves against the proxy origin root
		// (http://localhost:4500/mod.js) and the import fails outright. Import maps
		// are how buildless setups and an increasing number of shipped apps
		// resolve their dependencies.
		"modules-importmap",
		`
			const im = document.createElement("script");
			im.type = "importmap";
			im.textContent = JSON.stringify({ imports: { "bare-spec": "/mod.js" } });
			document.head.appendChild(im);
			let err, m;
			try { m = await import("bare-spec"); } catch (e) { err = e; }
			assert(!err, "a bare specifier from an import map must resolve: " + (err && err.message));
			assertEqual(m && m.v, "modvalue", "import map resolution");
		`
	),
	modTest(
		"modules-preload-link",
		`
			const l = document.createElement("link");
			l.rel = "preload";
			l.as = "script";
			l.href = "/p.js";
			const loaded = await new Promise((res) => {
				l.onload = () => res(true);
				l.onerror = () => res(false);
				document.head.appendChild(l);
				setTimeout(() => res(null), 3000);
			});
			assertEqual(loaded, true, "the preload link loaded");
			assertEqual(l.href, location.origin + "/p.js", "preload href property");
			assertEqual(l.getAttribute("href"), "/p.js", "preload href attribute");
			const s = document.createElement("script");
			s.src = "/p.js";
			await new Promise((res, rej) => { s.onload = res; s.onerror = rej; document.head.appendChild(s); });
			assertEqual(window.__preloaded, true, "the preloaded script then ran");
		`
	),
	modTest(
		"modules-modulepreload-link",
		`
			const l = document.createElement("link");
			l.rel = "modulepreload";
			l.href = "/p.js";
			const loaded = await new Promise((res) => {
				l.onload = () => res(true);
				l.onerror = () => res(false);
				document.head.appendChild(l);
				setTimeout(() => res(null), 3000);
			});
			assert(loaded !== false, "modulepreload did not error: " + loaded);
			assertEqual(l.href, location.origin + "/p.js", "modulepreload href");
		`
	),
];
