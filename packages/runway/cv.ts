import { definePackage, type TaskContext } from "../cv/api.ts";

const NODE_FLAGS = ["--experimental-strip-types", "--no-warnings"];

/** cv-level switches that map onto runway's environment variables */
function runwayArgs(ctx: TaskContext) {
	const env: Record<string, string> = {};
	const args: string[] = [];
	for (const a of ctx.args) {
		if (a === "--headed") env.HEADED = "1";
		else if (a === "--coverage") env.SCRAMJET_COVERAGE = "1";
		else args.push(a);
	}
	return { env, args };
}

export default definePackage(import.meta.dirname, {
	name: "runway",
	tasks: {
		test: {
			desc: "run the runway browser test suite (--headed, --coverage, rest forwarded)",
			deps: ["core:build", "controller:build"],
			persistent: true,
			run: (ctx) => {
				const { env, args } = runwayArgs(ctx);
				return ctx.sh({ env })`node ${NODE_FLAGS} src/index.ts ${args}`;
			},
		},
		inspect: {
			desc: "open the runway inspector",
			deps: ["core:build", "controller:build"],
			persistent: true,
			run: (ctx) => ctx.sh`node ${NODE_FLAGS} src/inspect.ts ${ctx.args}`,
		},
		wpt: {
			desc: "regenerate the vendored web-platform-tests",
			persistent: true,
			run: (ctx) =>
				ctx.sh`node ${NODE_FLAGS} scripts/generate-wpt.ts ${ctx.args}`,
		},
	},
});
