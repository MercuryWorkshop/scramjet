import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve paths relative to the package root (runway/)
const packageRoot = path.resolve(__dirname, "../../..");

export const PORT = 4500;
export const WISP_PORT = 4501;

export async function startHarness() {
	const app = express();

	app.use(
		"/scramjet",
		express.static(
			path.join(packageRoot, "node_modules/@mercuryworkshop/scramjet/dist")
		)
	);

	app.use(
		"/controller",
		express.static(
			path.join(
				packageRoot,
				"node_modules/@mercuryworkshop/scramjet-controller/dist"
			)
		)
	);

	app.use(
		"/libcurl",
		express.static(
			path.join(
				packageRoot,
				"node_modules/@mercuryworkshop/libcurl-transport/dist"
			)
		)
	);

	app.use(express.static(path.join(__dirname, "public")));

	app.listen(PORT, () => {
		console.log(`    Harness server listening on port ${PORT}`);
	});

	const wispServer = http.createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("wisp server");
	});
	wisp.options.allow_private_ips = true;
	wisp.options.allow_loopback_ips = true;

	wispServer.on("upgrade", (req, socket, head) => {
		wisp.routeRequest(req, socket, head);
	});

	wispServer.listen(WISP_PORT, () => {
		console.log(`    Wisp server listening on port ${WISP_PORT}`);
	});
}
