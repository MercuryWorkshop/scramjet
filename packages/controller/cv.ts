import { join } from "node:path";
import { definePackage } from "../cv/api.ts";
import { runRspack } from "../cv/rspack.ts";

export default definePackage(import.meta.dirname, {
	name: "controller",
	tasks: {
		build: {
			desc: "bundle the scramjet controller",
			deps: ["core:build"],
			inputs: [
				"src/**",
				"package.json",
				"tsconfig*.json",
				"../../rspack.config.ts",
			],
			outputs: ["dist/controller.api.js", "dist/controller-external.mjs"],
			run: (ctx) =>
				runRspack(
					join(ctx.dir, "../../rspack.config.ts"),
					["scramjet-controller"],
					{
						mode: "production",
						log: ctx.log,
					}
				),
		},
	},
});
