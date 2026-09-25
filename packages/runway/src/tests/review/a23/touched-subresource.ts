// rv23: after bucket-1 #3 (child controller crash), do the child's own subresources still load?
// Real sites: skribbl/globo/yahoo.co.jp Google ad frames get 404 text/html for every script.
// playwrightTest (not serverTest) so the #3 page error doesn't fail the run by itself.
import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

const PORT = Number(process.env.RUNWAY_PORT_BASE ?? 4500) + 61;

function start() {
	const log: string[] = [];
	const server = http.createServer((req, res) => {
		log.push(req.url!);
		if (
			req.url === "/" ||
			req.url === "/?untouched" ||
			req.url!.startsWith("/?blank")
		) {
			const touch = req.url === "/" || req.url === "/?blank-touched";
			const child = req.url!.startsWith("/?blank") ? "/child-blank" : "/child";
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(`<body><script>
				const f = document.createElement("iframe");
				f.src = "${child}";
				document.body.appendChild(f);
				${touch ? "void f.contentWindow.document; // touch before load (recaptcha/GTM/GPT do this)" : ""}
				addEventListener("message", (e) => { if (e.data === "script-ran") document.title = "script-ran"; });
			</script>`);
		} else if (req.url === "/?topblank") {
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(`<body><script>
				addEventListener("message", (e) => { if (e.data === "script-ran") document.title = "script-ran"; });
				const g = document.createElement("iframe");
				document.body.appendChild(g);
				const s = g.contentDocument.createElement("script");
				s.src = "/s.js";
				g.contentDocument.body.appendChild(s);
			</script>`);
		} else if (req.url === "/child") {
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(`<script src="/s.js"></script><img src="/i.png">`);
		} else if (req.url === "/child-blank") {
			// the child builds an about:blank grandchild and injects a script into it (GPT/AdSense rendering)
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(`<body><script>
				const g = document.createElement("iframe");
				document.body.appendChild(g);
				const s = g.contentDocument.createElement("script");
				s.src = "/s.js";
				g.contentDocument.body.appendChild(s);
			</script>`);
		} else if (req.url === "/s.js") {
			res.writeHead(200, {
				"Content-Type": "text/javascript",
			});
			res.end(`top.postMessage("script-ran", "*")`);
		} else {
			res.writeHead(404);
			res.end();
		}
	});
	return new Promise<{
		server: http.Server;
		log: string[];
	}>((r) =>
		server.listen(PORT, () =>
			r({
				server,
				log,
			})
		)
	);
}

const mk = (name: string, path: string) =>
	playwrightTest({
		name,
		fn: async ({ page, frame, navigate }) => {
			const { server, log } = await start();
			const statuses: string[] = [];
			const onResp = (r: any) => {
				if (/s\.js|i\.png/.test(decodeURIComponent(r.url())))
					statuses.push(
						`${r.status()} sw=${r.fromServiceWorker()} ${decodeURIComponent(r.url()).slice(-40)}`
					);
			};
			page.on("response", onResp);
			try {
				await navigate(`http://localhost:${PORT}${path}`);
				await new Promise((r) => setTimeout(r, 4000));
				const title = await frame
					.locator("body")
					.evaluate(() => document.title);
				if (title !== "script-ran")
					throw new Error(
						`child script never ran; responses: ${statuses.join(" | ")}; origin saw: ${log.join(",")}`
					);
			} finally {
				page.off("response", onResp);
				server.close();
				server.closeAllConnections();
			}
		},
	});

export default [
	mk("rv23-touched-child-subresource", "/"),
	mk("rv23-untouched-child-subresource", "/?untouched"),
	mk("rv23-touched-child-blank-grandchild-script", "/?blank-touched"),
	mk("rv23-untouched-child-blank-grandchild-script", "/?blank-untouched"),
	mk("rv23-top-blank-child-script", "/?topblank"),
];
