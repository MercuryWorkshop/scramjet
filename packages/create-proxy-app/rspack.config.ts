import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	name: "create-proxy-app",
	entry: {
		index: join(__dirname, "src/index.ts"),
	},
	output: {
		path: join(__dirname, "dist"),
		filename: "[name].js",
		module: true,
		iife: false,
	},
	experiments: {
		outputModule: true,
	},
	target: "node",
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: "builtin:swc-loader",
				options: {
					jsc: {
						parser: { syntax: "typescript" },
						target: "es2022",
					},
					module: { type: "es6" },
				},
				type: "javascript/auto",
			},
		],
	},
	plugins: [
		new rspack.BannerPlugin({
			banner: "#!/usr/bin/env node",
			raw: true,
			entryOnly: true,
		}),
	],
	optimization: {
		minimize: true,
	},
});
