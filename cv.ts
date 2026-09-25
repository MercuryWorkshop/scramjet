import { promises as fs } from "node:fs";
import { join } from "node:path";
import { defineProject, type TaskContext } from "./packages/cv/api.ts";

const PUBLISHED = [
	"core",
	"controller",
	"utils",
	"bootstrap",
	"create-proxy-app",
];

async function pack(ctx: TaskContext) {
	const publish = ctx.args.includes("--publish");
	// the npm readme is the repo readme
	await fs.copyFile(
		join(ctx.dir, "README.md"),
		join(ctx.dir, "packages/core/README.md")
	);
	for (const pkg of PUBLISHED) {
		const cwd = join(ctx.dir, "packages", pkg);
		ctx.log(`${publish ? "publishing" : "packing"} ${pkg}`);
		const extra = ctx.args.filter((a) => a !== "--publish");
		if (publish) {
			await ctx.sh({
				cwd,
			})`pnpm publish --access public --no-git-checks ${extra}`;
		} else {
			await ctx.sh({ cwd })`pnpm pack`;
		}
	}
}

export default defineProject(import.meta.dirname, {
	name: "scramjet",
	packages: [
		"packages/core",
		"packages/controller",
		"packages/utils",
		"packages/bootstrap",
		"packages/create-proxy-app",
		"packages/demo",
		"packages/runway",
	],
	targets: {
		wasm: ["core:wasm"],
		scramjet: ["core:wasm", "core:build", "controller:build", "utils:build"],
	},
	commands: {
		dev: {
			desc: "scramjet dev server (demo + wisp + rspack watch); --debug enables rsdoctor",
			deps: ["core:wasm"],
			persistent: true,
			run: (ctx) =>
				ctx.sh({
					env: ctx.args.includes("--debug") ? { DEBUG: "1" } : {},
				})`node --no-warnings=ExperimentalWarning devserver.ts`,
		},
		test: {
			desc: "run runway tests; args are forwarded (--headed, --coverage, --parallel N, names...)",
			deps: ["runway:test"],
			persistent: true,
			run: () => {},
		},
		inspect: {
			desc: "runway inspector",
			deps: ["runway:inspect"],
			persistent: true,
			run: () => {},
		},
		validate: {
			desc: "check the packed scramjet package layout (ava)",
			persistent: true,
			run: (ctx) =>
				ctx.sh`pnpm exec ava tests/ci/packageValidation.js ${ctx.args}`,
		},
		npm: {
			desc: "release build of every published package, then pnpm pack (--publish to publish)",
			deps: [
				"core:wasm",
				"core:build",
				"controller:build",
				"utils:build",
				"bootstrap:build",
				"create-proxy-app:build",
			],
			presetEnv: { RELEASE: "1" },
			persistent: true,
			run: pack,
		},
		format: {
			desc: "prettier --write",
			persistent: true,
			run: (ctx) => ctx.sh`pnpm exec prettier --write . ${ctx.args}`,
		},
		lint: {
			desc: "eslint",
			persistent: true,
			run: (ctx) => ctx.sh`pnpm exec eslint ${ctx.args}`,
		},
	},
});
