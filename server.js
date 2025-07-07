// Dev server imports
import { createBareServer } from "@nebula-services/bare-server-node";
import { createServer } from "http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import rspackConfig from "./rspack.config.js";
import { rspack } from "@rspack/core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

//transports
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { chmodSync, mkdirSync, writeFileSync } from "fs";

const bare = createBareServer("/bare/", {
	logErrors: true,
	blockLocal: false,
});

wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

				if (bare.shouldRoute(req)) {
					bare.routeRequest(req, res);
				} else {
					handler(req, res);
				}
			})
			.on("upgrade", (req, socket, head) => {
				if (bare.shouldRoute(req)) {
					bare.routeUpgrade(req, socket, head);
				} else {
					wisp.routeRequest(req, socket, head);
				}
			});
	},
});

fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./dist"),
	prefix: "/scram/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: join(fileURLToPath(new URL(".", import.meta.url)), "./assets"),
	prefix: "/assets/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: bareModulePath,
	prefix: "/baremod/",
	decorateReply: false,
});

const PORT = process.env.PORT || 1337;

fastify.listen({
	port: PORT,
	host: "0.0.0.0",
});
fastify.setNotFoundHandler((request, reply) => {
	console.error("PAGE PUNCHED THROUGH SW - " + request.url);
	reply.code(593).statusMessage("INVALID").send("punch through");
});
console.log(`Listening on http://localhost:${PORT}/`);
if (!process.env.CI) {
	try {
		writeFileSync(
			".git/hooks/pre-commit",
			"pnpm prettier . -w\ngit update-index --again"
		);
		chmodSync(".git/hooks/pre-commit", 0o755);
	} catch {}

	const compiler = rspack(rspackConfig);
	compiler.watch({}, (err, stats) => {
		console.log(
			stats.toString({
				preset: "minimal",
				colors: true,
				version: false,
			})
		);
	});
}
