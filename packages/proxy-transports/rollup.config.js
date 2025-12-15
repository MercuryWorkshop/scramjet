import typescript from "rollup-plugin-typescript2";
import { readFile } from "node:fs/promises";

const commonPlugins = () => [typescript()];

const configs = [
	{
		input: "./src/index.ts",
		output: {
			file: "dist/index.mjs",
			format: "esm",
			sourcemap: true,
			exports: "named",
		},
		plugins: commonPlugins(),
	},
	{
		input: "./src/index.ts",
		output: {
			file: "dist/index.js",
			format: "umd",
			name: "ProxyTransports",
			sourcemap: true,
			exports: "named",
		},
		plugins: commonPlugins(),
	},
];

export default configs;
