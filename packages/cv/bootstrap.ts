import { promises as fs } from "node:fs";
import { join } from "node:path";
import { c, CvError, log } from "./log.ts";
import { exec, which } from "./proc.ts";

async function mtime(p: string): Promise<number> {
	try {
		return (await fs.stat(p)).mtimeMs;
	} catch {
		return -1;
	}
}

async function workspaceDirs(root: string): Promise<string[]> {
	try {
		const yaml = await fs.readFile(join(root, "pnpm-workspace.yaml"), "utf-8");
		const dirs: string[] = [];
		let inPackages = false;
		for (const raw of yaml.split(/\r?\n/)) {
			const line = raw.replace(/#.*$/, "").trimEnd();
			if (/^packages:/.test(line)) {
				inPackages = true;
				continue;
			}
			if (inPackages && /^\S/.test(line)) inPackages = false;
			const m = inPackages && line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/);
			if (m) dirs.push(m[1]);
		}
		return dirs;
	} catch {
		return [];
	}
}

/** Run `pnpm install` when the lockfile or any manifest is newer than the last install. */
export async function ensureInstalled(root: string): Promise<boolean> {
	const marker = join(root, "node_modules", ".modules.yaml");
	const installedAt = await mtime(marker);
	const manifests = [
		join(root, "package.json"),
		join(root, "pnpm-lock.yaml"),
		join(root, "pnpm-workspace.yaml"),
		...(await workspaceDirs(root)).map((d) => join(root, d, "package.json")),
	];
	let newest = -1;
	let reason = "no node_modules yet";
	for (const m of manifests) {
		const t = await mtime(m);
		if (t > newest) {
			newest = t;
			if (installedAt >= 0) reason = `${m.slice(root.length + 1)} changed`;
		}
	}
	if (installedAt >= newest) return false;

	if (!which("pnpm")) {
		throw new CvError(
			"pnpm is required: run `corepack enable` (bundled with node) or `npm i -g pnpm`"
		);
	}
	log.info(`${c.magenta("pnpm install")} ${c.dim(`(${reason})`)}`);
	const args = ["install"];
	if (process.env.CI) args.push("--frozen-lockfile");
	await exec("pnpm", args, { cwd: root, inherit: true });
	// pnpm may not touch the marker when nothing changed; make the check monotonic
	const now = new Date();
	await fs.utimes(marker, now, now).catch(() => {});
	return true;
}

/** Keep the repo's pre-commit hook pointing at cv's formatter. */
export async function ensureGitHook(root: string): Promise<void> {
	if (process.env.CI) return;
	const gitDir = join(root, ".git");
	try {
		if (!(await fs.stat(gitDir)).isDirectory()) return;
	} catch {
		return;
	}
	const hook = join(gitDir, "hooks", "pre-commit");
	const content =
		"#!/bin/sh\n./cv format --no-install\ngit update-index --again\n";
	try {
		if ((await fs.readFile(hook, "utf-8")) === content) return;
	} catch {}
	try {
		await fs.mkdir(join(gitDir, "hooks"), { recursive: true });
		await fs.writeFile(hook, content, { mode: 0o755 });
	} catch {}
}
