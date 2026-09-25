import fs from "node:fs";
import { serverTest, type Test } from "../../../testcommon.ts";

const B = "/home/velzie/.cache/sjreview/scratch-a8/bundles/";
const PRE = `
window.__log = []; window.__errs = [];
window.__expect = location.href;
window.__mark = (k) => __log.push(k + ":" + (location.href === __expect ? "rw" : "RAW"));
addEventListener("error", e => __errs.push(String(e.message)));
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
`;
const cases: Record<
	string,
	{
		lib: string;
		js: string;
		expect: string[];
	}
> = {
	"jquery3-html-inline-script": {
		lib: "jquery.js",
		js: `$("body").append("<div><script>__mark('a')<\\/script><script>__mark('b')<\\/script></div>");`,
		expect: ["a:rw", "b:rw"],
	},
	"jquery3-html-src-script": {
		lib: "jquery.js",
		js: `$("body").append("<script src='/ext.js?k=s'><\\/script>"); await tick(800);`,
		expect: ["s:rw"],
	},
	"jquery3-getScript": {
		lib: "jquery.js",
		js: `await new Promise((res, rej) => $.getScript("/ext.js?k=g").done(() => res()).fail((x, s, e) => rej(new Error("getScript " + s + " " + e))));`,
		expect: ["g:rw"],
	},
	"jquery3-ajax-script": {
		lib: "jquery.js",
		js: `await $.ajax({ url: "/ext.js?k=x", dataType: "script" });`,
		expect: ["x:rw"],
	},
	"jquery3-html-method": {
		lib: "jquery.js",
		js: `$("<div id=h>").appendTo("body").html("<p>x</p><script>__mark('h')<\\/script>");`,
		expect: ["h:rw"],
	},
	"jquery3-globalEval": {
		lib: "jquery.js",
		js: `$.globalEval("__mark('ge')");`,
		expect: ["ge:rw"],
	},
	"jquery3-load": {
		lib: "jquery.js",
		js: `await new Promise(r => $("<div>").appendTo("body").load("/frag.html", r)); await tick(200);`,
		expect: ["frag:rw"],
	},
	"jquery1-html-inline-script": {
		lib: "jquery1.js",
		js: `$("body").append("<div><script>__mark('a')<\\/script></div>");`,
		expect: ["a:rw"],
	},
	"jquery1-globalEval": {
		lib: "jquery1.js",
		js: `$.globalEval("__mark('ge')");`,
		expect: ["ge:rw"],
	},
	requirejs: {
		lib: "require.js",
		js: `await new Promise((res, rej) => { requirejs.config({ baseUrl: "/amd" }); require(["mod"], (m) => { __log.push(m); res(); }, rej); });`,
		expect: ["amd:rw", "mod-loaded"],
	},
};
const tests: Test[] = [];
for (const [name, c] of Object.entries(cases)) {
	tests.push(
		serverTest({
			name: `rv8p2-lib-${name}`,
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					if (u.pathname === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!DOCTYPE html><html><head><script>${PRE}</script><script src="/lib.js"></script></head><body>
<script>
runTest(async () => {
  ${c.js}
  await tick(300);
  assertDeepEqual(__errs, [], "errors: " + __errs.join(" | "));
  assertDeepEqual(__log, ${JSON.stringify(c.expect)}, "log: " + JSON.stringify(__log));
  pass();
}, false);
</script></body></html>`);
					} else if (u.pathname === "/lib.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(fs.readFileSync(B + c.lib));
					} else if (u.pathname === "/ext.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(`__mark(${JSON.stringify(u.searchParams.get("k"))})`);
					} else if (u.pathname === "/frag.html") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<p>frag</p><script>__mark('frag')</script>`);
					} else if (u.pathname === "/amd/mod.js") {
						res.writeHead(200, {
							"Content-Type": "application/javascript",
						});
						res.end(
							`__mark('amd'); define([], function () { return "mod-loaded"; });`
						);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
			},
		})
	);
}
export default tests;
