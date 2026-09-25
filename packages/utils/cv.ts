import { join } from "node:path";
import { definePackage } from "../cv/api.ts";
import { runRspack } from "../cv/rspack.ts";

export default definePackage(import.meta.dirname, {
	name: "utils",
	tasks: {
		build: {
			desc: "bundle scramjet-utils",
			deps: ["core:build", "controller:build"],
			inputs: [
				"src/**",
				"package.json",
				"tsconfig*.json",
				"../../rspack.config.ts",
			],
			outputs: ["dist/scramjet-utils.js", "dist/scramjet-utils.mjs"],
			run: (ctx) =>
				runRspack(
					join(ctx.dir, "../../rspack.config.ts"),
					["scramjet-utils-iife", "scramjet-utils-esmodule"],
					{ mode: "production", log: ctx.log }
				),
		},
	},
});
