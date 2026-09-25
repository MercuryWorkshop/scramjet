// rv9: minimal repros reduced from the real-site sweep (sites.ts)
import { basicTest, serverTest } from "../../../testcommon.ts";

export default [
	// recaptcha / GTM / ad iframes: page touches iframe.contentWindow while the
	// frame is still on its initial about:blank, then the frame navigates to a
	// proxied document. On develop the parent-side hookSubcontext runs chrome.ts
	// against the CHILD realm and deletes the child's
	// Navigator.prototype.serviceWorker; the reused Window keeps that deletion,
	// so the child's controller inject.js dies on
	// `navigator.serviceWorker.controller` and `$scramjetController.load` throws.
	serverTest({
		name: "rv9-early-contentwindow-child-inject",
		scramjetOnly: true,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><body><script>
						runTest(async () => {
							const f = document.createElement("iframe");
							f.src = "/child";
							document.body.appendChild(f);
							// touch the initial about:blank window, like recaptcha's api.js
							void f.contentWindow;
							const t0 = Date.now();
							while (!window.__child && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
							const msg = window.__child;
							assert(msg, "child never reported");
							assertEqual(msg.ctl, "object", "child $scramjetController (controller inject ran)");
							assertEqual(msg.host, location.host, "child location.host");
							pass();
						});
					</script></body>`);
				} else if (req.url === "/child") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><body><script>
						parent.__child = { ctl: typeof $scramjetController, host: location.host };
					</script></body>`);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),

	// amazon.com's triggerInterstitialChallenge does `xhr.open("GET", u, false)`.
	// Chrome still supports synchronous XHR from a document; develop now throws
	// InvalidAccessError from open() (XMLHttpRequest.ts:40-49), main let open()
	// succeed. Pattern `open(..., false); try { send() } catch {}` (jQuery
	// async:false wrappers, feature detection, amazon) now throws uncaught.
	basicTest({
		name: "rv9-sync-xhr-open-throws",
		js: `
			const x = new XMLHttpRequest();
			let threw = null;
			try { x.open("GET", "/script.js", false); } catch (e) { threw = e.name + ": " + e.message; }
			assertEqual(threw, null, "sync xhr open() must not throw");
			assertEqual(x.readyState, 1, "readyState after open");
		`,
	}),
	basicTest({
		name: "rv9-sync-xhr-send",
		js: `
			const x = new XMLHttpRequest();
			let err = null;
			try { x.open("GET", "/script.js", false); x.send(); } catch (e) { err = e.name + ": " + e.message; }
			assertEqual(err, null, "sync xhr open+send threw");
			assertEqual(x.status, 200, "sync xhr status");
			assert(x.responseText.includes("runTest"), "sync xhr body");
		`,
	}),
];
