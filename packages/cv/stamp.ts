import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export type Manifest = Record<string, [number, number]>; // path -> [mtimeMs, size]

export interface Stamp {
	identity: string;
	inputs: Manifest;
	outputs: Manifest;
	env: Record<string, string | undefined>;
	deps: Record<string, string>;
	at: string;
}

const PRUNE = new Set(["node_modules", ".git", "target", ".cv"]);

export async function manifest(
	dir: string,
	globs: string[]
): Promise<Manifest> {
	const out: Manifest = {};
	for (const pattern of globs) {
		const matches = fs.glob(pattern, {
			cwd: dir,
			withFileTypes: true,
			exclude: (entry: any) =>
				typeof entry === "string"
					? entry.split(/[\\/]/).some((seg) => PRUNE.has(seg))
					: entry.isDirectory() && PRUNE.has(entry.name),
		});
		for await (const entry of matches as AsyncIterable<any>) {
			if (typeof entry === "string") {
				await add(out, dir, join(dir, entry));
				continue;
			}
			if (!entry.isFile()) continue;
			await add(out, dir, join(entry.parentPath ?? entry.path, entry.name));
		}
	}
	return out;
}

async function add(out: Manifest, dir: string, abs: string) {
	const rel = relative(dir, abs).split(sep).join("/");
	if (rel in out) return;
	try {
		const st = await fs.stat(abs);
		if (!st.isFile()) return;
		out[rel] = [Math.round(st.mtimeMs), st.size];
	} catch {}
}

export function sameManifest(a: Manifest, b: Manifest): string | null {
	for (const k of Object.keys(a)) {
		if (!(k in b)) return `${k} was removed`;
		if (a[k][0] !== b[k][0] || a[k][1] !== b[k][1]) return `${k} changed`;
	}
	for (const k of Object.keys(b)) if (!(k in a)) return `${k} is new`;
	return null;
}

export function hashIdentity(parts: unknown): string {
	return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

export class StampStore {
	dir: string;
	cache = new Map<string, Stamp | null>();

	constructor(root: string) {
		this.dir = join(root, "node_modules", ".cv");
	}

	file(id: string) {
		return join(this.dir, id.replace(/[:/\\]/g, "__") + ".json");
	}

	async load(id: string): Promise<Stamp | null> {
		if (this.cache.has(id)) return this.cache.get(id)!;
		let stamp: Stamp | null = null;
		try {
			stamp = JSON.parse(await fs.readFile(this.file(id), "utf-8"));
		} catch {}
		this.cache.set(id, stamp);
		return stamp;
	}

	async save(id: string, stamp: Stamp) {
		this.cache.set(id, stamp);
		await fs.mkdir(dirname(this.file(id)), { recursive: true });
		await fs.writeFile(this.file(id), JSON.stringify(stamp, null, 1));
	}

	async clear(id: string) {
		this.cache.set(id, null);
		await fs.rm(this.file(id), { force: true });
	}
}
