import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const packagemeta = JSON.parse(await readFile("package.json"));

// Configuration for standard IIFE builds
const iifeConfig = defineConfig({
	mode: "development",
	devtool: "source-map",
	entry: {
		all: join(__dirname, "src/entry.ts"),
		sync: join(__dirname, "src/sync.ts"),
	},
	resolve: {
		extensions: [".ts", ".js"],
		alias: {
			"@rewriters": join(__dirname, "src/shared/rewriters"),
			"@client": join(__dirname, "src/client"),
			"@": join(__dirname, "src"),
		},
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
			REWRITERWASM: "undefined",
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
	ignoreWarnings: [
		{
			module: /src\/entry\.ts/,
			message:
				/Critical dependency: the request of a dependency is an expression/,
		},
	],
});

// Configuration for ES module build
const moduleConfig = defineConfig({
	mode: "development",
	devtool: "source-map",
	entry: {
		bundle: join(__dirname, "src/index.ts"),
	},
	resolve: {
		extensions: [".ts", ".js"],
		alias: {
			"@rewriters": join(__dirname, "src/shared/rewriters"),
			"@client": join(__dirname, "src/client"),
			"@": join(__dirname, "src"),
		},
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
		libraryTarget: "module",
		iife: false,
	},
	performance: {
		hints: false,
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
			REWRITERWASM: (() => {
				try {
					const wasmPath = join(__dirname, "dist/scramjet.wasm.wasm");
					const wasmBuf = readFileSync(wasmPath);
					const wasmB64 = wasmBuf.toString("base64");
					return JSON.stringify(wasmB64);
				} catch {
					return "undefined";
				}
			})(),
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
	experiments: {
		outputModule: true,
	},
	ignoreWarnings: [
		{
			module: /src\/entry\.ts/,
			message:
				/Critical dependency: the request of a dependency is an expression/,
		},
	],
});

// Export multiple configurations
export default [iifeConfig, moduleConfig];
