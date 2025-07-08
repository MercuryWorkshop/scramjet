import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const packagemeta = JSON.parse(await readFile("package.json"));

export default defineConfig({
	mode: "development",
	devtool: "source-map",
	entry: {
		shared: join(__dirname, "src/shared/index.ts"),
		worker: join(__dirname, "src/worker/index.ts"),
		client: join(__dirname, "src/client/index.ts"),
		controller: join(__dirname, "src/controller/index.ts"),
		sync: join(__dirname, "src/sync.ts"),
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: "builtin:swc-loader",
				exclude: ["/node_modules/"],
				options: {
					jsc: {
						parser: {
							syntax: "typescript",
						},
						target: "es2022",
					},
					module: {
						type: "es6",
						strict: false,
						strictMode: false,
					},
				},
				type: "javascript/auto",
			},
		],
		parser: {
			javascript: {
				overrideStrict: "non-strict",
				dynamicImportMode: "eager",
			},
		},
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(__dirname, "dist"),
		libraryTarget: "es2022",
		iife: true,
	},
	plugins: [
		new TsCheckerRspackPlugin(),
		new rspack.ProvidePlugin({
			dbg: [join(__dirname, "src/log.ts"), "default"],
		}),
		new rspack.DefinePlugin({
			VERSION: JSON.stringify(packagemeta.version),
		}),
		new rspack.DefinePlugin({
			COMMITHASH: (() => {
				try {
					const hash = JSON.stringify(
						execSync("git rev-parse --short HEAD", {
							encoding: "utf-8",
						}).replace(/\r?\n|\r/g, "")
					);

					return hash;
				} catch {
					return "unknown";
				}
			})(),
		}),
		process.env.DEBUG
			? new RsdoctorRspackPlugin({
					supports: {
						parseBundle: true,
						banner: true,
					},
				})
			: null,
	],
	target: "webworker",
});
