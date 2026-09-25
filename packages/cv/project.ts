import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PackageDef, ProjectDef, TaskDef } from "./api.ts";
import { CvError } from "./log.ts";

export interface TaskNode {
	id: string;
	pkg: string;
	name: string;
	dir: string;
	def: TaskDef;
}

export interface Loaded {
	root: string;
	name: string;
	projects: ProjectDef[];
	packages: Map<string, PackageDef>;
	nodes: Map<string, TaskNode>;
	/** command name -> task id */
	commands: Map<string, string>;
	targets: Map<string, string[]>;
}

async function exists(p: string) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function importDefault<T>(file: string): Promise<T> {
	const mod = await import(pathToFileURL(file).href);
	if (!mod.default) throw new CvError(`${file} has no default export`);
	return mod.default as T;
}

/**
 * Locate the project definition that owns `startDir`: the nearest cv.ts, unless
 * an ancestor project `include`s it, in which case the ancestor wins so that a
 * vendored sub-project (scramjet inside browser.js) picks up the outer tasks.
 */
export async function findProjectFile(
	startDir: string
): Promise<string | null> {
	const candidates: string[] = [];
	let dir = resolve(startDir);
	for (let i = 0; i < 8; i++) {
		const file = join(dir, "cv.ts");
		if (await exists(file)) candidates.push(file);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	if (candidates.length === 0) return null;

	let chosen = candidates[0];
	for (const higher of candidates.slice(1)) {
		const def = await importDefault<ProjectDef>(higher);
		const includes = (def.include ?? []).map((inc) => resolve(def.dir, inc));
		if (includes.includes(chosen)) chosen = higher;
	}
	return chosen;
}

export async function loadProject(file: string): Promise<Loaded> {
	const top = await importDefault<ProjectDef>(file);
	const loaded: Loaded = {
		root: top.dir,
		name: top.name,
		projects: [],
		packages: new Map(),
		nodes: new Map(),
		commands: new Map(),
		targets: new Map(),
	};

	const addPackage = (pkg: PackageDef, origin: string) => {
		if (loaded.packages.has(pkg.name)) {
			throw new CvError(
				`package "${pkg.name}" is defined twice (${loaded.packages.get(pkg.name)!.dir} and ${origin})`
			);
		}
		loaded.packages.set(pkg.name, pkg);
		for (const [name, def] of Object.entries(pkg.tasks)) {
			const id = `${pkg.name}:${name}`;
			loaded.nodes.set(id, { id, pkg: pkg.name, name, dir: pkg.dir, def });
		}
	};

	const visit = async (project: ProjectDef) => {
		for (const inc of project.include ?? []) {
			const childFile = resolve(project.dir, inc);
			if (!(await exists(childFile))) {
				throw new CvError(
					`${project.name}: included project ${childFile} does not exist`
				);
			}
			await visit(await importDefault<ProjectDef>(childFile));
		}
		for (const rel of project.packages ?? []) {
			const pkgFile = join(project.dir, rel, "cv.ts");
			if (!(await exists(pkgFile))) {
				throw new CvError(`${project.name}: package ${rel} has no cv.ts`);
			}
			const pkg = await importDefault<PackageDef>(pkgFile);
			addPackage({ ...pkg, dir: pkg.dir ?? join(project.dir, rel) }, pkgFile);
		}
		for (const pkg of project.extra ?? []) addPackage(pkg, "extra");

		for (const [name, def] of Object.entries(project.commands ?? {})) {
			const id = `${project.name}:${name}`;
			loaded.nodes.set(id, {
				id,
				pkg: project.name,
				name,
				dir: project.dir,
				def,
			});
			loaded.commands.set(name, id);
		}
		for (const [name, ids] of Object.entries(project.targets ?? {})) {
			loaded.targets.set(name, ids);
		}
		loaded.projects.push(project);
	};

	await visit(top);
	return loaded;
}

export function resolveDep(node: TaskNode, dep: string): string {
	return dep.startsWith(":") ? `${node.pkg}${dep}` : dep;
}

export function depsOf(loaded: Loaded, node: TaskNode): string[] {
	return (node.def.deps ?? []).map((d) => {
		const id = resolveDep(node, d);
		if (!loaded.nodes.has(id)) {
			throw new CvError(`${node.id} depends on unknown task "${id}"`);
		}
		return id;
	});
}
