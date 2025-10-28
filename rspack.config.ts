import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";

import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";
import { writeFileSync, chmodSync } from "node:fs";

if (!process.env.CI) {
	try {
		writeFileSync(
			".git/hooks/pre-commit",
			"pnpm format\ngit update-index --again"
		);
		chmodSync(".git/hooks/pre-commit", 0o755);
	} catch {}
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Project directories
const scramjetdir = join(__dirname, "packages/core");

// Load WASM for rewriter
const sjpackagemeta = JSON.parse(
	await readFile(join(scramjetdir, "package.json"), "utf-8")
);
const wasmPath = join(scramjetdir, "rewriter/wasm/out/optimized.wasm");
let wasmB64: string;
const wasmBuf = await readFile(wasmPath);
wasmB64 = wasmBuf.toString("base64");

export const tsloader = {
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
			// new TsCheckerRspackPlugin({
			// 	typescript: {
			// 		configFile: resolve(scramjetdir, "tsconfig.json"),
			// 	},
			// }),
			new rspack.ProvidePlugin({
				dbg: [join(scramjetdir, "src/log.ts"), "default"],
			}),
			new rspack.DefinePlugin({
				REWRITERWASM: rewriterWasm,
			}),
			new rspack.DefinePlugin({
				VERSION: JSON.stringify(sjpackagemeta.version),
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
			new rspack.DefinePlugin({
				BUILDDATE: JSON.stringify(new Date().toISOString()),
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
		optimization: {
			minimizer: [
				new rspack.SwcJsMinimizerRspackPlugin({
					minimizerOptions: {
						module: output.libraryTarget === "module",
					},
				}),
			],
		},
		...extraConfig,
	});
};

// IIFE build that does NOT bundle the wasm, exposes global $scramjet
const iifeConfig = createScramjetConfig({
	entry: {
		main: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet.js",
		path: join(scramjetdir, "dist"),
		iife: true,
		library: {
			type: "var",
			name: "$scramjet",
		},
	},
	rewriterWasm: "undefined",
	extraConfig: {
		performance: {
			hints: false,
		},
	},
});

// IIFE build that BUNDLES the wasm and exposes global $scramjet
const iifeBundledConfig = createScramjetConfig({
	entry: {
		bundled: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet_bundled.js",
		path: join(scramjetdir, "dist"),
		iife: true,
		library: {
			type: "var",
			name: "$scramjet",
		},
	},
	rewriterWasm: JSON.stringify(wasmB64),
	extraConfig: {
		performance: {
			hints: false,
		},
	},
});

// wasm bundled, esmodule
const moduleBundledConfig = createScramjetConfig({
	entry: {
		bundle: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet_bundled.mjs",
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

// no wasm bundled, esmodule
const moduleConfig = createScramjetConfig({
	entry: {
		bundle: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet.mjs",
		path: join(scramjetdir, "dist"),
		libraryTarget: "module",
		iife: false,
	},
	// do not embed the wasm in this build
	rewriterWasm: "undefined",
	performance: {
		hints: false,
	},
	experiments: {
		outputModule: true,
	},
});

export default [
	iifeConfig,
	iifeBundledConfig,
	moduleConfig,
	moduleBundledConfig,
];
