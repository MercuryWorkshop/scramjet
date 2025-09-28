import { defineConfig } from "@rslib/core";

export default defineConfig({
	source: {
		entry: {
			index: "./src/index.ts",
		},
		tsconfigPath: "./tsconfig.rslib.json",
	},
	lib: [
		{
			format: "esm",
			bundle: false,
			dts: {
				bundle: false,
				distPath: "./dist/types",
				abortOnError: false,
			},
			output: {
				distPath: {
					root: "./dist/temp",
				},
				cleanDistPath: true,
			},
		},
	],
});
