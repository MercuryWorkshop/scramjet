// Production server for hosting the Scramjet demo on a single web service.
//
// It does two jobs on one origin:
//   1. Serves the pre-built static demo (packages/demo/dist).
//   2. Terminates Wisp WebSocket connections at /wisp/, which is the
//      transport the proxy actually uses to reach the wider internet.
//
// Because the demo and the Wisp endpoint share an origin, the browser talks
// to wss://<host>/wisp/ with no CORS and no cross-origin config. The build
// step bakes that same-origin URL into the demo via VITE_WISP_URL.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
// @ts-expect-error - wisp-js ships no type declarations
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8080;
const WISP_PATH = "/wisp/";
const STATIC_DIR = path.join(__dirname, "packages", "demo", "dist");

const app = express();

// Serve the built demo. express.static already sends the correct
// Content-Type for .wasm (application/wasm) and .mjs (text/javascript);
// the explicit header below is belt-and-suspenders for older resolvers.
app.use(
	express.static(STATIC_DIR, {
		setHeaders(res, filePath) {
			if (filePath.endsWith(".wasm")) {
				res.setHeader("Content-Type", "application/wasm");
			}
		},
	})
);

// Lightweight health check for uptime monitors (e.g. UptimeRobot). Kept
// before the SPA fallback so a keep-alive ping returns a few bytes instead
// of downloading the whole demo shell each time.
app.get("/healthz", (_req, res) => {
	res.type("text/plain").send("ok");
});

// Single-page-app fallback: anything that isn't a real file gets the shell.
// Proxied requests are handled by the service worker in the browser and
// never reach this server.
app.get(/.*/, (_req, res) => {
	res.sendFile(path.join(STATIC_DIR, "index.html"));
});

const server = http.createServer(app);

// Route only /wisp/ upgrades into the Wisp server; reject other upgrades.
// Note: we intentionally leave allow_private_ips / allow_loopback_ips at
// their safe defaults (disabled) so the proxy can't be used to reach the
// host's internal network.
server.on("upgrade", (req, socket, head) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	if (url.pathname === WISP_PATH || url.pathname === WISP_PATH.slice(0, -1)) {
		wisp.routeRequest(req, socket, head);
	} else {
		socket.destroy();
	}
});

server.listen(PORT, () => {
	console.log(`Scramjet listening on :${PORT} (wisp at ${WISP_PATH})`);
});
