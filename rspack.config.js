import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { join } from "path";
import { fileURLToPath } from "url";
import obfuscator from "javascript-obfuscator";
const { obfuscate } = obfuscator;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	// change to production when needed
	mode: "development",
	entry: {
		shared: join(__dirname, "src/shared/index.ts"),
		worker: join(__dirname, "src/worker/index.ts"),
		thread: join(__dirname, "src/thread/thread.ts"),
		client: join(__dirname, "src/client/index.ts"),
		codecs: join(__dirname, "src/codecs/index.ts"),
		controller: join(__dirname, "src/controller/index.ts"),
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
					asdasdasds: new Error(),
					jsc: {
						parser: {
							syntax: "typescript",
						},
						target: "es2022",
					},
					strictMode: false,
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
				dynamicImportMode: "eager",
			},
		},
	},
	optimization: {
		minimize: process.env.OBFUSCATE === "true",
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(__dirname, "dist"),
		libraryTarget: "es2022",
		iife: true,
	},
	plugins: [
		new rspack.ProvidePlugin({
			dbg: [join(__dirname, "src/log.ts"), "default"],
			Function: [join(__dirname, "src/snapshot.ts"), "Function"],
		}),
		process.env.OBFUSCATE === "true" && {
			apply(compiler) {
				compiler.hooks.compilation.tap("GyatPlugin", (compilation) => {
					compilation.hooks.processAssets.tap(
						{
							name: "GyatPlugin",
							stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
						},
						(assets) => {
							for (const asset in assets) {
								// inject code
								compilation.updateAsset(asset, (source) => {
									return {
										source: () => {
											return obfuscate(source.source(), {
												compact: true,
												controlFlowFlattening: true,
												controlFlowFlatteningThreshold: 1,
												numbersToExpressions: true,
												simplify: true,
												deadCodeInjection: true,
												selfDefending: true,
												renameGlobals: true,
												transformObjectKeys: true,
												stringArrayShuffle: true,
												splitStrings: true,
												stringArrayThreshold: 1,
												domainLock: ["localhost", process.env.DOMAIN],
											}).getObfuscatedCode();
										},
									};
								});
							}
						}
					);
				});
			},
		},
		process.env
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
