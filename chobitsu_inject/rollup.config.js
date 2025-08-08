import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
	input: "index.js",
	output: {
		file: "output/chobitsu_inject.js",
		format: "umd",
	},
	plugins: [
		nodeResolve({
			preferBuiltins: true,
			browser: false,
		}),
		commonjs(),
	],
};
