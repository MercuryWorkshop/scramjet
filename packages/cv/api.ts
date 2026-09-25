import type { Requirement } from "./toolchain.ts";
import type { ShFn, ShOptions, ShValue } from "./proc.ts";

export type { Requirement, ShFn, ShOptions, ShValue };

export interface TaskContext {
	/** full task id, e.g. "core:wasm" */
	id: string;
	/** directory of the package that declared the task */
	dir: string;
	/** directory of the top-level project */
	root: string;
	/** extra CLI arguments (commands only) */
	args: string[];
	/**
	 * run a program, streaming its output with the task id as prefix:
	 * sh`cargo build ${flags}`, sh({ cwd })`...`, or sh("cargo", ["build"], { cwd })
	 */
	sh: ShFn<void>;
	/** same forms as sh, returning trimmed stdout */
	output: ShFn<string>;
	log(msg: string): void;
	warn(msg: string): void;
	/** the CLI's --yes flag: accept every prompt */
	yes: boolean;
}

export interface TaskDef {
	desc?: string;
	/** "pkg:task", or ":task" for a task of the same package */
	deps?: string[];
	/** globs relative to the package dir; the task is skipped while none changed */
	inputs?: string[];
	/** globs relative to the package dir; must exist after the task ran */
	outputs?: string[];
	/** environment variables whose values participate in change detection */
	env?: string[];
	/** tools that must be installed before running */
	requires?: Requirement[];
	/** long-running process; never cached, run after everything else */
	persistent?: boolean;
	/** must run before `pnpm install` (e.g. fetching a workspace package) */
	beforeInstall?: boolean;
	/** nothing else runs concurrently; the child gets the terminal */
	exclusive?: boolean;
	/** env vars to set for the whole cv process before dependencies resolve */
	presetEnv?: Record<string, string>;
	run: (ctx: TaskContext) => Promise<void> | void;
}

export interface PackageDef {
	/** short name used in task ids and on the CLI, e.g. "core" */
	name: string;
	dir: string;
	tasks: Record<string, TaskDef>;
}

export interface ProjectDef {
	name: string;
	dir: string;
	/** directories (relative to dir) containing a cv.ts package definition */
	packages?: string[];
	/** child projects (relative paths to their cv.ts) merged into this one */
	include?: string[];
	/** packages defined inline, for code that lives outside the tree */
	extra?: PackageDef[];
	/** `cv build <name>` aliases -> task ids */
	targets?: Record<string, string[]>;
	/** `cv <name> [args]` */
	commands?: Record<string, TaskDef>;
}

export function definePackage(
	dir: string,
	def: Omit<PackageDef, "dir">
): PackageDef {
	return { ...def, dir };
}

export function defineProject(
	dir: string,
	def: Omit<ProjectDef, "dir">
): ProjectDef {
	return { ...def, dir };
}

export function task(def: TaskDef): TaskDef {
	return def;
}
