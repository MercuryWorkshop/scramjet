import { defineConfig } from "@rspack/cli";
import { rspack, type RspackOptions } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function nodeExternals({ context, request }, callback) {
	if (!/^(\.|\/)/.test(request)) {
		return callback(null, request);
	}

	callback();
}

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
const wasmPath = join(scramjetdir, "dist/scramjet.wasm");
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
	const { entry, output, rewriterWasm, extraConfig = {}, name } = options;

	return createGenericConfig({
		name,
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

// Custom plugin to generate TypeScript declarations
class TypeScriptDeclarationsPlugin {
	dir: string;
	tsconfigName: string;
	useAlias: boolean;
	tempDir: string;

	constructor(
		dir: string,
		tempDir: string,
		tsconfigName: string = "tsconfig.types.json",
		useAlias: boolean = true
	) {
		this.dir = dir;
		this.tempDir = tempDir;
		this.tsconfigName = tsconfigName;
		this.useAlias = useAlias;
	}

	apply(compiler) {
		compiler.hooks.afterEmit.tap("TypeScriptDeclarationsPlugin", () => {
			(async () => {
				try {
					console.log(`Generating TypeScript declarations for ${this.dir}...`);
					try {
						const { stdout, stderr } = await execAsync(
							`pnpm exec tsc --project ${this.tsconfigName}`,
							{ cwd: this.dir }
						);
						if (stdout) console.log(stdout);
						if (stderr && !stderr.includes("TS")) console.error(stderr);
					} catch (tscError: any) {
						// tsc exits with error code if there are TS errors, but still generates files
						// Only log if it's not a TypeScript compilation error
						if (tscError.code !== 2) {
							throw tscError;
						}
						// if (tscError.stdout) console.log(tscError.stdout);
						// if (tscError.stderr) console.warn(tscError.stderr);
					}

					if (this.useAlias) {
						const aliasResult = await execAsync(
							`pnpm exec tsc-alias --project ${this.tsconfigName}`,
							{ cwd: this.dir }
						);
						if (aliasResult.stdout) console.log(aliasResult.stdout);
						if (aliasResult.stderr) console.error(aliasResult.stderr);
					}

					try {
						await execAsync(`rm -rf ${this.tempDir}`, { cwd: this.dir });
					} catch (e) {}

					console.log(
						`TypeScript declarations generated successfully for ${this.dir}`
					);
				} catch (error: any) {
					console.error(
						`Error generating TypeScript declarations for ${this.dir}:`,
						error.message
					);
				}
			})();
		});
	}
}

// IIFE build that does NOT bundle the wasm, exposes global $scramjet
const iifeConfig = createScramjetConfig({
	name: "scramjet-iife",
	entry: {
		main: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet.js",
		path: join(scramjetdir, "dist"),
		iife: true,
		library: {
			type: "assign",
			name: "self.$scramjet",
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
	name: "scramjet-iife-bundled",
	entry: {
		bundled: join(scramjetdir, "src/index.ts"),
	},
	output: {
		filename: "scramjet_bundled.js",
		path: join(scramjetdir, "dist"),
		iife: true,
		library: {
			type: "assign",
			name: "self.$scramjet",
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
	name: "scramjet-esmodule-bundled",
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
	name: "scramjet-esmodule",
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
	name: "scramjet-bootstrap",
	entry: {
		server: join(bootstrapdir, "src/server.ts"),
		client: join(bootstrapdir, "src/client.ts"),
	},
	output: {
		filename: "bootstrap-[name].js",
		path: join(bootstrapdir, "dist"),
		iife: false,
		libraryTarget: "module",
	},
	experiments: {
		outputModule: true,
	},
	target: "node",
	externals: [nodeExternals],
	plugins: [
		new TypeScriptDeclarationsPlugin(
			bootstrapdir,
			"dist/temp-types-build",
			"tsconfig.types.json",
			false
		),
	],
});

const bootstrapStaticConfig = createGenericConfig({
	name: "scramjet-bootstrap-static",
	entry: {
		static: join(bootstrapdir, "src/static.ts"),
	},
	output: {
		filename: "bootstrap-[name].js",
		path: join(bootstrapdir, "dist"),
		iife: true,
	},
});

const controllerConfig = createGenericConfig({
	name: "scramjet-controller",
	entry: {
		api: join(controllerdir, "src/index.ts"),
		inject: join(controllerdir, "src/inject.ts"),
		sw: join(controllerdir, "src/sw.ts"),
	},
	output: {
		filename: "controller.[name].js",
		path: join(controllerdir, "dist"),
		iife: true,
		library: {
			type: "var",
			name: "$scramjetController",
		},
	},
	plugins: [
		new TypeScriptDeclarationsPlugin(
			controllerdir,
			"dist/temp-types-build",
			"tsconfig.types.json",
			false
		),
	],
});

// Type generation configuration
const typeGenConfig = defineConfig({
	context: scramjetdir,
	entry: {
		index: "./src/index.ts",
	},
	output: {
		path: join(scramjetdir, "dist/temp-types-build"),
		filename: "[name].js",
	},
	plugins: [
		new TypeScriptDeclarationsPlugin(
			scramjetdir,
			"dist/temp-types-build",
			"tsconfig.types.json",
			true
		),
	],
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
	},
});

export default [
	iifeConfig,
	iifeBundledConfig,
	moduleConfig,
	moduleBundledConfig,
	bootstrapConfig,
	bootstrapStaticConfig,
	controllerConfig,
	typeGenConfig,
];
