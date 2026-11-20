import { serverTest } from "../../testcommon.ts";

const filler = "<p>filler</p>".repeat(20000);

export default [
	// a response policy with 'unsafe-inline' and no 'unsafe-eval': inline
	// scripts and handlers run, eval and Function throw
	serverTest({
		name: "csp-header-inline-runs-eval-blocked",
		autoPass: true,
		js: `
			const f = document.createElement("iframe");
			const loaded = new Promise((r) => (f.onload = r));
			f.src = "/csp";
			document.body.appendChild(f);
			await loaded;
			assertEqual(window.inlineScript, 1, "inline script");
			assertEqual(window.inlineHandler, 1, "inline handler");
			assertEqual(window.evalResult, "EvalError", "eval");
			assertEqual(window.fnResult, "EvalError", "Function");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/csp") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Content-Security-Policy": "script-src 'unsafe-inline'",
					});
					res.end(`<!doctype html><button id=b onclick="parent.inlineHandler = 1">b</button><script>
parent.inlineScript = 1;
document.getElementById("b").click();
try { eval("1"); parent.evalResult = "ran"; } catch (e) { parent.evalResult = e.name; }
try { new Function("return 1")(); parent.fnResult = "ran"; } catch (e) { parent.fnResult = e.name; }
</script>`);
				}
			});
		},
	}),
	// a frame its parent reached into while it loaded has its own response's
	// policy - none - and not the parent's
	serverTest({
		name: "csp-header-early-hooked-child-has-own-policy",
		autoPass: true,
		js: `
			const result = new Promise((r) =>
				addEventListener("message", (e) => e.data?.child && r(e.data.child))
			);
			const f = document.createElement("iframe");
			f.src = "/parent";
			document.body.appendChild(f);
			assertEqual(await result, "ran");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/parent") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						"Content-Security-Policy": "script-src 'unsafe-inline'",
					});
					res.end(`<!doctype html><body><script>
const f = document.createElement("iframe");
f.src = "/child";
document.body.appendChild(f);
const iv = setInterval(() => { try { f.contentWindow.document; } catch {} }, 0);
setTimeout(() => clearInterval(iv), 4000);
</script></body>`);
				} else if (req.url === "/child") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!doctype html><body>${filler}<script>
let r;
try { r = eval("'ran'"); } catch (e) { r = e.name; }
parent.parent.postMessage({ child: r }, "*");
</script></body>`);
				}
			});
		},
	}),
	// two CSP fields are two policies, and both are enforced
	serverTest({
		name: "csp-header-repeated-fields-both-enforced",
		autoPass: true,
		js: `
			const f = document.createElement("iframe");
			const loaded = new Promise((r) => (f.onload = r));
			f.src = "/csp";
			document.body.appendChild(f);
			await loaded;
			assertEqual(window.evalResult, "EvalError");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/csp") {
					res.setHeader("Content-Type", "text/html");
					res.setHeader("Content-Security-Policy", [
						"script-src 'unsafe-inline'",
						"script-src 'unsafe-inline' 'unsafe-eval'",
					]);
					res.end(`<!doctype html><script>
try { eval("1"); parent.evalResult = "ran"; } catch (e) { parent.evalResult = e.name; }
</script>`);
				}
			});
		},
	}),
];
