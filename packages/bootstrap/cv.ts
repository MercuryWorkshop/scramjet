import { join } from "node:path";
import { definePackage } from "../cv/api.ts";
import { runRspack } from "../cv/rspack.ts";

export default definePackage(import.meta.dirname, {
	name: "bootstrap",
	tasks: {
		build: {
			desc: "bundle proxy-bootstrap",
			inputs: [
				"src/**",
				"package.json",
				"tsconfig*.json",
				"../../rspack.config.ts",
			],
			outputs: ["dist/bootstrap-*.js"],
			run: (ctx) =>
				runRspack(
					join(ctx.dir, "../../rspack.config.ts"),
					["scramjet-bootstrap", "scramjet-bootstrap-static"],
					{ mode: "production", log: ctx.log }
				),
		},
	},
});
