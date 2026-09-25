import type { TaskContext } from "./api.ts";
import { c, CvError, fmtTime, log } from "./log.ts";
import { exec, makeSh, output } from "./proc.ts";
import { depsOf, type Loaded, type TaskNode } from "./project.ts";
import {
	hashIdentity,
	manifest,
	sameManifest,
	StampStore,
	type Manifest,
} from "./stamp.ts";
import { ensureTools } from "./toolchain.ts";

export interface RunOptions {
	force: boolean;
	why: boolean;
	yes: boolean;
	jobs: number;
	dry: boolean;
	/** task ids or package names whose outputs are taken as given */
	prebuilt: Set<string>;
	args: string[];
}

export interface RunSummary {
	ran: number;
	skipped: number;
}

export class Runner {
	loaded: Loaded;
	opts: RunOptions;
	store: StampStore;
	identities = new Map<string, string>();
	summary: RunSummary = { ran: 0, skipped: 0 };

	constructor(loaded: Loaded, opts: RunOptions) {
		this.loaded = loaded;
		this.opts = opts;
		this.store = new StampStore(loaded.root);
	}

	node(id: string): TaskNode {
		const n = this.loaded.nodes.get(id);
		if (!n) throw new CvError(`unknown task "${id}"`);
		return n;
	}

	/** every task needed for `ids`, dependencies first */
	closure(ids: string[]): TaskNode[] {
		const order: TaskNode[] = [];
		const state = new Map<string, "visiting" | "done">();
		const visit = (id: string, chain: string[]) => {
			const s = state.get(id);
			if (s === "done") return;
			if (s === "visiting") {
				throw new CvError(`dependency cycle: ${[...chain, id].join(" -> ")}`);
			}
			state.set(id, "visiting");
			const node = this.node(id);
			for (const dep of depsOf(this.loaded, node)) visit(dep, [...chain, id]);
			state.set(id, "done");
			order.push(node);
		};
		for (const id of ids) visit(id, []);
		return order;
	}

	async run(ids: string[]): Promise<RunSummary> {
		const order = this.closure(ids);
		const batch = order.filter((n) => !n.def.persistent);
		const persistent = order.filter((n) => n.def.persistent);
		await this.schedule(batch);
		for (const node of persistent) await this.execute(node);
		return this.summary;
	}

	private async schedule(batch: TaskNode[]) {
		const done = new Set<string>();
		const started = new Set<string>();
		const running = new Map<string, Promise<{ id: string; err?: unknown }>>();
		let exclusive = false;
		let failure: unknown = null;

		while (started.size < batch.length || running.size > 0) {
			if (!failure) {
				for (const node of batch) {
					if (started.has(node.id)) continue;
					if (running.size >= this.opts.jobs || exclusive) break;
					const deps = depsOf(this.loaded, node);
					if (!deps.every((d) => done.has(d))) continue;
					if (node.def.exclusive && running.size > 0) continue;
					started.add(node.id);
					exclusive = !!node.def.exclusive;
					running.set(
						node.id,
						this.execute(node)
							.then(() => ({ id: node.id }))
							.catch((err) => ({ id: node.id, err }))
					);
					if (exclusive) break;
				}
			}
			if (running.size === 0) {
				if (failure) break;
				if (started.size < batch.length) {
					throw new CvError("scheduler stalled; this is a cv bug");
				}
				break;
			}
			const result = await Promise.race(running.values());
			running.delete(result.id);
			exclusive = false;
			if (result.err) failure ??= result.err;
			else done.add(result.id);
		}
		if (failure) throw failure;
	}

	private context(node: TaskNode): TaskContext {
		const prefix = node.id;
		return {
			id: node.id,
			dir: node.dir,
			root: this.loaded.root,
			args: this.opts.args,
			yes: this.opts.yes,
			sh: makeSh(async (cmd, args, opts) => {
				await exec(cmd, args, {
					cwd: node.dir,
					prefix,
					inherit: node.def.exclusive || node.def.persistent,
					...opts,
				});
			}),
			output: makeSh((cmd, args, opts) =>
				output(cmd, args, { cwd: node.dir, ...opts })
			),
			log: (msg) => log.task(node.id, msg),
			warn: (msg) => log.task(node.id, c.yellow(msg)),
		};
	}

	private isPrebuilt(node: TaskNode) {
		return this.opts.prebuilt.has(node.id) || this.opts.prebuilt.has(node.pkg);
	}

	private async outputsManifest(
		node: TaskNode,
		strict: boolean
	): Promise<Manifest> {
		const all: Manifest = {};
		for (const glob of node.def.outputs ?? []) {
			const m = await manifest(node.dir, [glob]);
			if (strict && Object.keys(m).length === 0) {
				throw new CvError(
					`${node.id} declared output "${glob}" but nothing matched it`
				);
			}
			Object.assign(all, m);
		}
		return all;
	}

	private async execute(node: TaskNode): Promise<void> {
		const { def, id } = node;
		// a task can be reached twice in one invocation (beforeInstall pass, then the real one)
		if (this.identities.has(id)) return;
		const deps = depsOf(this.loaded, node);
		const depIds = Object.fromEntries(
			deps.map((d) => [d, this.identities.get(d) ?? "unknown"])
		);
		const env = Object.fromEntries(
			(def.env ?? []).map((k) => [k, process.env[k]])
		);

		if (this.isPrebuilt(node)) {
			const outputs = await this.outputsManifest(node, true);
			this.identities.set(id, hashIdentity({ prebuilt: outputs }));
			this.summary.skipped++;
			log.task(id, c.dim("prebuilt, outputs taken as-is"));
			return;
		}

		const hasInputs = (def.inputs?.length ?? 0) > 0;
		const tracked = hasInputs || (def.outputs?.length ?? 0) > 0;
		const inputs = hasInputs
			? await manifest(node.dir, [...def.inputs!, "cv.ts"])
			: {};

		if (tracked && !def.persistent) {
			const stamp = await this.store.load(id);
			let reason: string | null;
			if (this.opts.force) reason = "--force";
			else if (!stamp) reason = "never built";
			else if (!hasInputs) reason = "no inputs declared";
			else {
				reason =
					sameManifest(stamp.inputs, inputs) ??
					envDiff(stamp.env, env) ??
					depsDiff(stamp.deps, depIds) ??
					outputsDiff(stamp.outputs, await this.outputsManifest(node, false));
			}
			if (reason === null) {
				this.identities.set(id, stamp!.identity);
				this.summary.skipped++;
				log.task(id, c.dim("up to date"));
				return;
			}
			if (this.opts.why || this.opts.dry)
				log.task(id, c.dim(`stale: ${reason}`));
		}

		if (this.opts.dry) {
			log.task(id, c.yellow("would run"));
			this.identities.set(id, "dry-run");
			return;
		}

		if (def.requires?.length)
			await ensureTools(def.requires, { yes: this.opts.yes });

		const started = Date.now();
		log.task(
			id,
			c.bold(def.persistent ? "starting" : "running") +
				(def.desc ? c.dim(`  ${def.desc}`) : "")
		);
		try {
			await def.run(this.context(node));
		} catch (err) {
			if (tracked) await this.store.clear(id);
			throw err;
		}
		const outputs = await this.outputsManifest(node, true);
		const identity = hashIdentity({ inputs, env, deps: depIds, outputs });
		if (tracked && !def.persistent) {
			await this.store.save(id, {
				identity,
				inputs,
				outputs,
				env,
				deps: depIds,
				at: new Date().toISOString(),
			});
		}
		this.identities.set(id, identity);
		this.summary.ran++;
		log.task(id, `${c.green("done")} ${c.dim(fmtTime(Date.now() - started))}`);
	}
}

function envDiff(
	a: Record<string, string | undefined>,
	b: Record<string, string | undefined>
): string | null {
	for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
		if (a[k] !== b[k])
			return `env ${k} changed (${a[k] ?? "unset"} -> ${b[k] ?? "unset"})`;
	}
	return null;
}

function depsDiff(
	a: Record<string, string>,
	b: Record<string, string>
): string | null {
	for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
		if (a[k] !== b[k]) return `dependency ${k} was rebuilt`;
	}
	return null;
}

function outputsDiff(a: Manifest, b: Manifest): string | null {
	const d = sameManifest(a, b);
	return d ? `output ${d}` : null;
}
