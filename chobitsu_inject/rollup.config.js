import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
	input: "index.js",
	output: {
		file: "output/chobitsu_inject.js",
		format: "umd",
	},
	plugins: [
		nodeResolve({
			preferBuiltins: true,
			browser: true,
		}),
	],
};
