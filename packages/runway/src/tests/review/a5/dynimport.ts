import { serverTest } from "../../../testcommon.ts";

// Dynamic import() from a classic <script src> resolves against that script's URL.
const BODIES: Record<string, string> = {};
const T = (
	name: string,
	scriptPath: string,
	loadVia: "static" | "dynamic",
	extra = ""
) =>
	serverTest({
		name,
		start: async (server) => {
			server.on("request", (req, res) => {
				const path = (req.url || "/").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					const loader =
						loadVia === "static"
							? `<script src="${scriptPath}"></script>`
							: `<script>const s = document.createElement("script"); s.type = "text/javascript"; s.src = "${scriptPath}"; s.async = true; document.head.appendChild(s);</script>`;
					res.end(`<!DOCTYPE html><html><head>${extra}</head><body>${loader}<script>
						runTest(async () => {
							const t0 = Date.now();
							while (!window.__p && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
							assert(window.__p, "classic script ran");
							const m = await window.__p;
							assertEqual(m.where, "chunk", "chunk loaded");
							assertEqual(m.meta, location.origin + "${scriptPath.replace(/[^/]*$/, "")}static/chunk.js", "import.meta.url of chunk");
						}, true);
					</script></body></html>`);
				} else if (path === scriptPath) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(BODIES[name]);
				} else if (path.endsWith("/static/chunk.js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`export const where = "chunk"; export const meta = import.meta.url;`
					);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	});

const plain = `(function(){ window.__p = import("./static/chunk.js").then(m => ({ where: m.where, meta: m.meta })); })();`;
const tmpl =
	"(function(){ window.__p = import(`./static/chunk.js`).then(m => ({ where: m.where, meta: m.meta })); })();";
const vite =
	"!function(){try{var e=(new Error).stack}catch(e){}}();(function(){ var R=(f,d)=>f(); var X=()=>R(()=>import(`./static/chunk.js`),[]); window.__p = X().then(m => ({ where: m.where, meta: m.meta })); })();";
const withSourcemap = plain + "\n//# sourceMappingURL=bundle.js.map";
export default [
	...[
		["plain", plain],
		["tmpl", tmpl],
		["vite", vite],
		["srcmap", withSourcemap],
	].flatMap(([k, b]) => {
		BODIES["rv5-dynimport-body-" + k] = b;
		return [T("rv5-dynimport-body-" + k, "/gf/v2.10/bundle.js", "dynamic")];
	}),
	((BODIES["rv5-dynimport-classic-static-plain"] = plain),
	(BODIES["rv5-dynimport-classic-static-dotted"] = plain),
	(BODIES["rv5-dynimport-classic-dynamic-plain"] = plain),
	(BODIES["rv5-dynimport-classic-dynamic-dotted"] = plain),
	T("rv5-dynimport-classic-static-plain", "/gf/v2/bundle.js", "static")),
	T("rv5-dynimport-classic-static-dotted", "/gf/v2.10/bundle.js", "static"),
	T("rv5-dynimport-classic-dynamic-plain", "/gf/v2/bundle.js", "dynamic"),
	T("rv5-dynimport-classic-dynamic-dotted", "/gf/v2.10/bundle.js", "dynamic"),
];
