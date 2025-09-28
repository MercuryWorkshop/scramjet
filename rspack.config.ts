import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Project directories
const scramjetdir = join(__dirname, "packages/scramjet");
const cdpdir = join(__dirname, "packages/cdp");
const injectdir = join(__dirname, "packages/inject");

// Load WASM for rewriter
const sjpackagemeta = JSON.parse(
	await readFile(join(scramjetdir, "package.json"), "utf-8")
);
const wasmPath = join(scramjetdir, "rewriter/wasm/out/wasm_bg.wasm");
let wasmB64: string;
const wasmBuf = await readFile(wasmPath);
wasmB64 = wasmBuf.toString("base64");

// Read CDP package info for banner
const cdpPackage = JSON.parse(
	await readFile(join(cdpdir, "package.json"), "utf-8")
);

const tsloader = {
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
};

// Common configuration options for scramjet builds
const createScramjetConfig = (options) => {
	const { entry, output, rewriterWasm, extraConfig = {} } = options;

	return defineConfig({
		mode: "development",
		devtool: "source-map",
		entry,
		resolve: {
			extensions: [".ts", ".js"],
			alias: {
				"@rewriters": join(scramjetdir, "src/shared/rewriters"),
				"@client": join(scramjetdir, "src/client"),
				"@": join(scramjetdir, "src"),
			},
		},
		module: {
			rules: [tsloader],
			parser: {
				javascript: {
					overrideStrict: "non-strict",
					dynamicImportMode: "eager",
				},
			},
		},
		output,
		plugins: [
			new TsCheckerRspackPlugin({
				typescript: {
					configFile: resolve(scramjetdir, "tsconfig.json"),
				},
			}),
			new rspack.ProvidePlugin({
				dbg: [join(scramjetdir, "src/log.ts"), "default"],
			}),
			new rspack.DefinePlugin({
				VERSION: JSON.stringify(sjpackagemeta.version),
			}),
			new rspack.DefinePlugin({
				REWRITERWASM: rewriterWasm,
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
		...extraConfig,
	});
};

// Configuration for standard IIFE builds
const iifeConfig = createScramjetConfig({
	entry: {
		all: join(scramjetdir, "src/entry.ts"),
		sync: join(scramjetdir, "src/sync.ts"),
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(scramjetdir, "dist"),
		libraryTarget: "es2022",
		iife: true,
	},
	rewriterWasm: "undefined",
	extraConfig: {
		performance: {
			hints: false,
		},
	},
});

// Configuration for ES module build
const moduleConfig = createScramjetConfig({
	entry: {
		bundle: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(scramjetdir, "dist"),
		libraryTarget: "module",
		iife: false,
	},
	rewriterWasm: JSON.stringify(wasmB64),
	performance: {
		hints: false,
	},
	experiments: {
		outputModule: true,
	},
});

// Configuration for CDP (Chobitsu)
// Define external dependencies from package.json
const cssloader = {
	test: /\.css$/,
	type: "asset/source",
};
const cdpConfig = defineConfig({
	entry: join(cdpdir, "src/index.ts"),
	devtool: "source-map",
	target: "web",
	output: {
		filename: "chobitsu.js",
		path: join(cdpdir, "dist"),
		library: {
			type: "module",
		},
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [tsloader, cssloader],
	},
	experiments: {
		outputModule: true,
	},
	externals: {
		axios: "axios",
		"core-js": "core-js",
		"devtools-protocol": "devtools-protocol",
		html2canvas: "html2canvas",
		licia: "licia",
	},
});

// inject
const injectConfig = defineConfig({
	entry: join(injectdir, "src/index.ts"),
	devtool: "source-map",
	target: "web",
	output: {
		filename: "inject.js",
		path: join(injectdir, "dist"),
		iife: true,
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [tsloader, cssloader],
	},
	performance: {
		hints: false,
	},
});

export default [iifeConfig, moduleConfig, cdpConfig, injectConfig];
