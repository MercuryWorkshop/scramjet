import { defineConfig } from "@rspack/cli";
import { rspack, type RspackOptions } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";
import nodeExternals from "webpack-node-externals";

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
const controllerdir = join(__dirname, "packages/controller");
const bootstrapdir = join(__dirname, "packages/bootstrap");

// Load WASM for rewriter
const sjpackagemeta = JSON.parse(
	await readFile(join(scramjetdir, "package.json"), "utf-8")
);
const wasmPath = join(scramjetdir, "dist/scramjet.wasm.wasm");
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

function deepmerge(target, source) {
	const output = { ...target };
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach((key) => {
			if (isObject(source[key])) {
				if (!(key in target)) Object.assign(output, { [key]: source[key] });
				else output[key] = deepmerge(target[key], source[key]);
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}
	return output;
}

function isObject(item) {
	return item && typeof item === "object" && !Array.isArray(item);
}

const createGenericConfig = (options) => {
	const def: RspackOptions = {
		devtool: "source-map",
		mode: "development",
		resolve: {
			extensions: [".ts", ".js"],
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
		optimization: {
			minimizer: [
				new rspack.SwcJsMinimizerRspackPlugin({
					minimizerOptions: {
						module: options.output.libraryTarget === "module",
					},
				}),
			],
		},
	};
	return defineConfig(deepmerge(def, options));
};

// Common configuration options for scramjet builds
const createScramjetConfig = (options) => {
	const { entry, output, rewriterWasm, extraConfig = {} } = options;

	return createGenericConfig({
		entry,
		resolve: {
			alias: {
				"@rewriters": join(scramjetdir, "src/shared/rewriters"),
				"@client": join(scramjetdir, "src/client"),
				"@": join(scramjetdir, "src"),
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

const bootstrapConfig = createGenericConfig({
	entry: {
		main: join(bootstrapdir, "src/index.ts"),
	},
	output: {
		filename: "bootstrap.js",
		path: join(bootstrapdir, "dist"),
		iife: false,
		libraryTarget: "module",
	},
	experiments: {
		outputModule: true,
	},
	target: "node",
	externals: [
		function ({ context, request }, callback) {
			console.log(request);
			if (!/^(\.|\/)/.test(request)) {
				// Externalize to a commonjs module using the request path
				return callback(null, request);
			}

			// Continue without externalizing the import
			callback();
		},
	],
});

const controllerConfig = createGenericConfig({
	entry: {
		api: join(controllerdir, "src/index.ts"),
		sw: join(controllerdir, "src/sw.ts"),
	},
	output: {
		filename: "controller.[name].js",
		path: join(controllerdir, "dist"),
		iife: true,
	},
});

export default [
	iifeConfig,
	iifeBundledConfig,
	moduleConfig,
	moduleBundledConfig,
	bootstrapConfig,
	controllerConfig,
];
