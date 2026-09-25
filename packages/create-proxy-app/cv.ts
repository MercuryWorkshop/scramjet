import { join } from "node:path";
import { definePackage } from "../cv/api.ts";
import { runRspack } from "../cv/rspack.ts";

export default definePackage(import.meta.dirname, {
	name: "create-proxy-app",
	tasks: {
		build: {
			desc: "bundle the create-proxy-app cli",
			inputs: [
				"src/**",
				"package.json",
				"tsconfig*.json",
				"../../rspack.config.ts",
			],
			outputs: ["dist/index.js"],
			run: (ctx) =>
				runRspack(
					join(ctx.dir, "../../rspack.config.ts"),
					["create-proxy-app"],
					{
						mode: "production",
						log: ctx.log,
					}
				),
		},
	},
});
