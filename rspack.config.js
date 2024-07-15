import { defineConfig } from "@rspack/cli";
// import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	// change to production when needed
	mode: "production",
	entry: {
		shared: join(__dirname, "src/shared/index.ts"),
		worker: join(__dirname, "src/worker/index.ts"),
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
				use: "builtin:swc-loader",
				exclude: ["/node_modules/"],
				options: {
					jsc: {
						parser: {
							syntax: "typescript",
						},
					},
				},
				type: "javascript/auto",
			},
		],
	},
	output: {
		filename: "scramjet.[name].js",
		path: join(__dirname, "dist"),
		iife: true,
		clean: true,
	},
	plugins: [
		// new RsdoctorRspackPlugin({
		//     supports: {
		//         parseBundle: true,
		//         banner: true
		//     }
		// })
	],
	watch: true,
	target: "webworker"
});
