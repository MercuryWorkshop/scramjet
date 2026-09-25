import { relative } from "node:path";
import { ensureGitHook, ensureInstalled } from "./bootstrap.ts";
import { Runner, type RunOptions } from "./graph.ts";
import { c, CvError, fmtTime, log } from "./log.ts";
import {
	depsOf,
	findProjectFile,
	loadProject,
	type Loaded,
} from "./project.ts";

interface Cli {
	positional: string[];
	rest: string[];
	force: boolean;
	why: boolean;
	yes: boolean;
	dry: boolean;
	install: boolean;
	help: boolean;
	jobs: number;
	prebuilt: Set<string>;
}

function parseArgs(argv: string[]): Cli {
	const cli: Cli = {
		positional: [],
		rest: [],
		force: false,
		why: false,
		yes: !!process.env.CV_YES,
		dry: false,
		install: true,
		help: false,
		jobs: 0,
		prebuilt: new Set(
			(process.env.CV_PREBUILT ?? "")
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		),
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--") {
			cli.rest.push(...argv.slice(i + 1));
			break;
		}
		const eq = a.indexOf("=");
		const key = eq > 0 ? a.slice(0, eq) : a;
		const val = () => (eq > 0 ? a.slice(eq + 1) : argv[++i]);
		switch (key) {
			case "--force":
			case "-f":
				cli.force = true;
				break;
			case "--why":
				cli.why = true;
				break;
			case "--yes":
			case "-y":
				cli.yes = true;
				break;
			case "--dry":
				cli.dry = true;
				break;
			case "--no-install":
				cli.install = false;
				break;
			case "--help":
			case "-h":
				cli.help = true;
				break;
			case "--jobs":
			case "-j":
				cli.jobs = Number(val());
				break;
			case "--prebuilt":
				for (const p of val().split(","))
					if (p.trim()) cli.prebuilt.add(p.trim());
				break;
			default:
				cli.positional.push(a);
		}
	}
	return cli;
}

function usage(loaded: Loaded | null): string {
	const lines = [
		c.bold("cv") + " - build tasks for " + (loaded?.name ?? "this project"),
		"",
		"  cv build [target...]      build targets (default: all)",
		"  cv run <task-id...>       run specific tasks, e.g. core:wasm",
		"  cv list                   show packages, tasks, targets and commands",
		"  cv graph [target...]      show the task order for targets",
		"  cv <command> [args...]    run a project command; args are forwarded",
		"",
		"  --force, -f      rebuild even when inputs are unchanged",
		"  --why            explain why each task runs",
		"  --dry            show what would run",
		"  --yes, -y        install missing tools without asking (or CV_YES=1)",
		"  --prebuilt=a,b   treat these tasks/packages as already built (or CV_PREBUILT)",
		"  --no-install     skip the pnpm install check",
		"  -j N             concurrent tasks (default: min(4, cpus))",
		"  --               everything after this goes to the command untouched",
	];
	if (loaded) {
		lines.push("", c.bold("commands"));
		for (const [name, id] of loaded.commands) {
			const desc = loaded.nodes.get(id)?.def.desc ?? "";
			lines.push(`  ${name.padEnd(14)} ${c.dim(desc)}`);
		}
		lines.push("", c.bold("targets"));
		const targets = [...loaded.targets.keys()];
		for (const [name, pkg] of loaded.packages) {
			if ("build" in pkg.tasks && !loaded.targets.has(name)) targets.push(name);
		}
		lines.push("  " + ["all", ...targets].join(", "));
	}
	return lines.join("\n");
}

function resolveTarget(loaded: Loaded, target: string): string[] {
	if (loaded.targets.has(target)) return loaded.targets.get(target)!;
	if (target === "all") {
		return [...loaded.nodes.values()]
			.filter((n) => n.name === "build" && loaded.packages.has(n.pkg))
			.map((n) => n.id);
	}
	if (loaded.nodes.has(`${target}:build`)) return [`${target}:build`];
	if (loaded.nodes.has(target)) return [target];
	const known = [...loaded.targets.keys(), ...loaded.packages.keys()].join(
		", "
	);
	throw new CvError(`unknown build target "${target}"\n  known: all, ${known}`);
}

function list(loaded: Loaded) {
	for (const project of loaded.projects) {
		log.info(
			c.bold(project.name) +
				c.dim(`  ${relative(loaded.root, project.dir) || "."}`)
		);
		for (const [name, def] of Object.entries(project.commands ?? {})) {
			log.info(`  cv ${name.padEnd(16)} ${c.dim(def.desc ?? "")}`);
		}
	}
	for (const [name, pkg] of loaded.packages) {
		log.info(
			c.bold(name) + c.dim(`  ${relative(loaded.root, pkg.dir) || "."}`)
		);
		for (const [task, def] of Object.entries(pkg.tasks)) {
			const deps = def.deps?.length ? c.dim(`  <- ${def.deps.join(", ")}`) : "";
			log.info(`  ${(name + ":" + task).padEnd(20)} ${def.desc ?? ""}${deps}`);
		}
	}
	if (loaded.targets.size) {
		log.info(c.bold("targets"));
		for (const [name, ids] of loaded.targets)
			log.info(`  ${name.padEnd(20)} ${ids.join(", ")}`);
	}
}

async function main() {
	const cli = parseArgs(process.argv.slice(2));
	const file = await findProjectFile(process.cwd());
	if (!file)
		throw new CvError("no cv.ts found in this directory or its parents");
	const loaded = await loadProject(file);

	const [verb, ...restPositional] = cli.positional;
	if (cli.help || !verb) {
		log.info(usage(loaded));
		return;
	}
	if (verb === "list") return list(loaded);

	// work out what to run before touching anything, so typos fail fast
	let ids: string[];
	let args: string[] = cli.rest;
	if (verb === "build") {
		const targets = restPositional.length ? restPositional : ["all"];
		ids = targets.flatMap((t) => resolveTarget(loaded, t));
	} else if (verb === "run") {
		if (!restPositional.length)
			throw new CvError("cv run needs at least one task id");
		ids = restPositional.map((id) => {
			if (!loaded.nodes.has(id)) throw new CvError(`unknown task "${id}"`);
			return id;
		});
	} else if (verb === "graph") {
		const targets = restPositional.length ? restPositional : ["all"];
		ids = targets.flatMap((t) => resolveTarget(loaded, t));
	} else if (loaded.commands.has(verb)) {
		ids = [loaded.commands.get(verb)!];
		args = [...restPositional, ...cli.rest];
	} else if (loaded.nodes.has(verb)) {
		ids = [verb];
	} else {
		throw new CvError(`unknown command "${verb}"\n\n${usage(loaded)}`);
	}

	const opts: RunOptions = {
		force: cli.force,
		why: cli.why,
		yes: cli.yes,
		dry: cli.dry,
		jobs:
			cli.jobs > 0
				? cli.jobs
				: Math.max(1, Math.min(4, (await import("node:os")).cpus().length)),
		prebuilt: cli.prebuilt,
		args,
	};
	const runner = new Runner(loaded, opts);

	if (verb === "graph") {
		for (const node of runner.closure(ids)) {
			const deps = depsOf(loaded, node);
			log.info(
				`${node.id.padEnd(24)}${deps.length ? c.dim("<- " + deps.join(", ")) : ""}`
			);
		}
		return;
	}

	for (const id of ids) {
		const preset = loaded.nodes.get(id)?.def.presetEnv ?? {};
		for (const [k, v] of Object.entries(preset)) process.env[k] ??= v;
	}

	const started = Date.now();
	if (cli.install && !cli.dry) {
		const early = [...loaded.nodes.values()]
			.filter((n) => n.def.beforeInstall)
			.map((n) => n.id);
		if (early.length) await runner.run(early);
		await ensureInstalled(loaded.root);
		await ensureGitHook(loaded.root);
	}

	const summary = await runner.run(ids);
	if (!loaded.nodes.get(ids[0])?.def.persistent) {
		log.info(
			c.dim(
				`${summary.ran} ran, ${summary.skipped} up to date, ${fmtTime(Date.now() - started)}`
			)
		);
	}
}

main().catch((err) => {
	if (err instanceof CvError) {
		if (err.message) log.error(err.message);
		process.exit(err.exitCode);
	}
	console.error(err);
	process.exit(1);
});
