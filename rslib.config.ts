import { defineConfig } from "@rslib/core";

const scramjetPath = "./packages/scramjet";

export default [
	defineConfig({
		source: {
			entry: {
				index: scramjetPath + "/src/index.ts",
			},
			tsconfigPath: scramjetPath + "/tsconfig.rslib.json",
		},
		lib: [
			{
				format: "esm",
				bundle: false,
				dts: {
					bundle: false,
					distPath: scramjetPath + "/dist/types",
					abortOnError: false,
				},
				output: {
					distPath: {
						root: scramjetPath + "/dist/temp",
					},
					cleanDistPath: true,
				},
			},
		],
	}),
];
