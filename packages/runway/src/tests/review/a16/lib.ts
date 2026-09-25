import { serverTest } from "../../../testcommon.ts";

export type Files = Record<
	string,
	| string
	| {
			type: string;
			body: string;
			headers?: Record<string, string>;
	  }
>;

/** A test server: `files` keyed by url (with query) or path; "/" is the page. */
export function site(
	name: string,
	files: Files,
	opts: {
		scramjetOnly?: boolean;
	} = {}
) {
	return serverTest({
		name,
		scramjetOnly: opts.scramjetOnly ?? false,
		start: async (server) => {
			server.on("request", (req, res) => {
				const url = req.url || "/";
				const path = url.split("?")[0];
				let f = files[url] ?? files[path];
				if (f === undefined && path.startsWith("/deep/")) f = files["/"];
				if (f === undefined) {
					res.writeHead(404, {
						"content-type": "text/plain",
					});
					res.end("nope");
					return;
				}
				let type = "text/javascript";
				let body: string;
				let headers: Record<string, string> = {};
				if (typeof f === "string") {
					body = f;
					if (
						path === "/" ||
						path.endsWith(".html") ||
						(path.startsWith("/deep/") && !path.endsWith(".js"))
					)
						type = "text/html";
					else if (path.endsWith(".json")) type = "application/json";
					else if (path.endsWith(".css")) type = "text/css";
				} else {
					type = f.type;
					body = f.body;
					headers = f.headers || {};
				}
				res.writeHead(200, {
					"content-type": type,
					"access-control-allow-origin": "*",
					"cache-control": "no-store",
					...headers,
				});
				res.end(body);
			});
		},
	});
}

/** A page whose inline module runs `body` inside runTest (autopass). */
export const page = (
	body: string,
	head = "",
	module = true
) => `<!doctype html><html><head>${head}</head><body>
<script${module ? ' type="module"' : ""}>
const c = (label, v) => assertConsistent(label, v);
const tryImp = async (s, k = "default") => { try { const m = await import(s); return m[k]; } catch (e) { return "ERR " + e.name + ": " + String(e.message).replace(/localhost:\\d+/g, "HOST"); } };
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
runTest(async () => {
${body}
}, true);
</script></body></html>`;
