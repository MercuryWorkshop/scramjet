import { defineConfig } from "@rslib/core";

export default defineConfig({
	source: {
		entry: {
			index: "./src/rslib/entry.ts",
		},
		tsconfigPath: "./tsconfig.rslib.json",
	},
	lib: [
		{
			format: "esm",
			bundle: false,
			dts: {
				bundle: false,
				distPath: "./lib/rslibOutput",
				abortOnError: false,
			},
			output: {
				distPath: {
					root: "./lib/temp",
				},
				cleanDistPath: true,
			},
		},
	],
});
