import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
// import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	// change to production when needed
	mode: "development",
	entry: {
		shared: join(__dirname, "src/shared/index.ts"),
		worker: join(__dirname, "src/worker/index.ts"),
		thread: join(__dirname, "src/thread/thread.ts"),
		client: join(__dirname, "src/client/index.ts"),
		config: join(__dirname, "src/scramjet.config.ts"),
		codecs: join(__dirname, "src/codecs/index.ts"),
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
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(__dirname, "dist"),
		libraryTarget: "es2022",
		iife: true,
		clean: true,
	},
	plugins: [
		new rspack.ProvidePlugin({
			dbg: [join(__dirname, "src/log.ts"), "default"],
		}),
		// new RsdoctorRspackPlugin({
		//     supports: {
		//         parseBundle: true,
		//         banner: true
		//     }
		// })
	],
	target: "webworker",
});
