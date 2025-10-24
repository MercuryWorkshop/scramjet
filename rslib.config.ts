import { defineConfig } from "@rslib/core";

export default defineConfig({
	source: {
		entry: {
			index: "./packages/core/src/index.ts",
		},
		tsconfigPath: "./packages/core/tsconfig.rslib.json",
	},
	lib: [
		{
			format: "esm",
			bundle: false,
			dts: {
				bundle: false,
				distPath: "./packages/core/dist/types",
				abortOnError: false,
			},
			output: {
				distPath: {
					root: "./packages/core/dist/temp",
				},
				cleanDistPath: true,
			},
		},
	],
});
