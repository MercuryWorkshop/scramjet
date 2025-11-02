import { createServer } from "vite";
import fs from "node:fs/promises";
import { stdout } from "node:process";
import chalk from "chalk";
import { execSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import rspackConfig from "./rspack.config.ts";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import {
	black,
	logSuccess,
	printBanner,
	resetSuccessLog,
	runRspack,
} from "./devlib.ts";

const image = await fs.readFile("./assets/scramjet-mini-noalpha.png");

const commit = execSync("git rev-parse --short HEAD", {
	encoding: "utf-8",
}).replace(/\r?\n|\r/g, "");
const branch = execSync("git rev-parse --abbrev-ref HEAD", {
	encoding: "utf-8",
}).replace(/\r?\n|\r/g, "");
const packagejson = JSON.parse(await fs.readFile("./package.json", "utf-8"));
const version = packagejson.version;

const DEMO_PORT = process.env.CHROME_PORT || 4141;
const WISP_PORT = process.env.WISP_PORT || 4142;

process.env.VITE_WISP_URL =
	process.env.VITE_WISP_URL || `ws://localhost:${WISP_PORT}/`;

const wispserver = http.createServer((req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("wisp server js rewrite");
});

wispserver.on("upgrade", (req, socket, head) => {
	wisp.routeRequest(req, socket, head);
});

wispserver.listen(Number(WISP_PORT));

const server = await createServer({
	configFile: "./packages/demo/vite.config.ts",
	root: "./packages/demo",
	server: {
		port: Number(DEMO_PORT),
		strictPort: true,
	},
});

await server.listen();

const accent = (text: string) => chalk.hex("#f1855bff").bold(text);
const highlight = (text: string) => chalk.hex("#fdd76cff").bold(text);
const urlColor = (text: string) => chalk.hex("#64DFDF").underline(text);
const note = (text: string) => chalk.hex("#CDB4DB")(text);
const connector = chalk.hex("#8D99AE").dim("@");

const lines = [
	black()(`${highlight("SCRAMJET DEV SERVER")}`),
	black()(
		`${accent("demo")} ${connector} ${urlColor(
			`http://localhost:${DEMO_PORT}/`
		)}`
	),
	black()(
		`${accent("wisp")} ${connector} ${urlColor(
			process.env.VITE_WISP_URL ?? ""
		)}`
	),
	black()(chalk.dim(`[${branch}] ${commit} scramjet/${version}`)),
];

printBanner(image, lines);

runRspack(rspackConfig);
