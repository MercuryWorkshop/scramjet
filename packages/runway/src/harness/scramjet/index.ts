import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve paths relative to the package root (runway/)
const packageRoot = path.resolve(__dirname, "../../..");

export const PORT = Number(process.env.RUNWAY_PORT_BASE ?? 4500);
export const WISP_PORT = PORT + 1;

// RUNWAY_SCRAMJET_ROOT points at another scramjet checkout's root (the one
// holding packages/core and packages/controller), to run these tests against
// a different build, e.g. a baseline for regression comparison.
const distRoot = process.env.RUNWAY_SCRAMJET_ROOT;
const coreDist = distRoot
	? path.join(distRoot, "packages/core/dist")
	: path.join(packageRoot, "node_modules/@mercuryworkshop/scramjet/dist");
const controllerDist = distRoot
	? path.join(distRoot, "packages/controller/dist")
	: path.join(
			packageRoot,
			"node_modules/@mercuryworkshop/scramjet-controller/dist"
		);

export async function startHarness() {
	const app = express();

	app.use("/scramjet", express.static(coreDist));

	app.use("/controller", express.static(controllerDist));

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
	logging.set_level(logging.NONE);

	wispServer.on("upgrade", (req, socket, head) => {
		wisp.routeRequest(req, socket, head);
	});

	wispServer.listen(WISP_PORT, () => {
		console.log(`    Wisp server listening on port ${WISP_PORT}`);
	});
}
