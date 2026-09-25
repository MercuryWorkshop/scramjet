import { definePackage } from "../cv/api.ts";

export default definePackage(import.meta.dirname, {
	name: "demo",
	tasks: {
		build: {
			desc: "build the demo site with vite",
			deps: ["core:build", "controller:build", "utils:build"],
			inputs: [
				"src/**",
				"public/**",
				"index.html",
				"vite.config.ts",
				"package.json",
			],
			outputs: ["dist/index.html"],
			env: ["VITE_WISP_URL"],
			run: (ctx) => ctx.sh`pnpm exec vite build`,
		},
	},
});
