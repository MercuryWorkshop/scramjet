import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { c, CvError, fmtTime } from "./log.ts";

export interface RspackRunOptions {
	mode?: "development" | "production" | "none";
	log?: (msg: string) => void;
}

/**
 * Build a subset of the configs exported by an rspack config module, in-process,
 * and resolve only once every asset (and every afterEmit hook) is done. Ordering
 * between configs is cv's job, so the configs' own `dependencies` are dropped.
 */
export async function runRspack(
	configPath: string,
	names: string[],
	opts: RspackRunOptions = {}
): Promise<void> {
	const require = createRequire(configPath);
	const rspackCore = await import(
		pathToFileURL(require.resolve("@rspack/core")).href
	);
	const rspack = rspackCore.rspack ?? rspackCore.default?.rspack;
	const mod = await import(pathToFileURL(configPath).href);
	const all: any[] = Array.isArray(mod.default) ? mod.default : [mod.default];
	const byName = new Map(all.map((cfg) => [cfg.name, cfg]));

	const configs = names.map((name) => {
		const cfg = byName.get(name);
		if (!cfg) {
			throw new CvError(
				`rspack config "${name}" not found in ${configPath}\n  available: ${[...byName.keys()].filter(Boolean).join(", ")}`
			);
		}
		return {
			...cfg,
			dependencies: undefined,
			context: cfg.context ?? dirname(configPath),
			mode: opts.mode ?? cfg.mode,
		};
	});

	const started = Date.now();
	const compiler = rspack(configs);
	const stats: any = await new Promise((resolve, reject) => {
		compiler.run((err: Error | null, result: unknown) => {
			compiler.close((closeErr: Error | null) => {
				if (err) reject(err);
				else if (closeErr) reject(closeErr);
				else resolve(result);
			});
		});
	});

	const list: any[] = Array.isArray(stats?.stats) ? stats.stats : [stats];
	const failed: string[] = [];
	for (const st of list) {
		const name = st.compilation?.name ?? "?";
		if (st.hasErrors()) {
			failed.push(name);
			console.error(
				st.toString({ preset: "errors-only", colors: !!process.stdout.isTTY })
			);
		} else if (st.hasWarnings()) {
			console.log(
				st.toString({
					preset: "errors-warnings",
					colors: !!process.stdout.isTTY,
				})
			);
		}
	}
	if (failed.length) {
		throw new CvError(`rspack build failed: ${failed.join(", ")}`);
	}
	opts.log?.(
		`${c.green("bundled")} ${names.join(", ")} ${c.dim(`in ${fmtTime(Date.now() - started)}`)}`
	);
}
