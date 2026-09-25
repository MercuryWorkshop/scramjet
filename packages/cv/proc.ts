import { spawn } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { c, CvError } from "./log.ts";

export interface ShOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
	/** print each output line with this prefix (default when not inherit) */
	prefix?: string;
	/** hand the terminal to the child (progress bars, interactive prompts) */
	inherit?: boolean;
	/** collect stdout instead of printing it */
	capture?: boolean;
	/** resolve instead of throwing on a non-zero exit */
	allowFail?: boolean;
	quiet?: boolean;
}

export interface ShResult {
	code: number;
	stdout: string;
	stderr: string;
}

const isWin = process.platform === "win32";

export function which(bin: string): string | null {
	if (isAbsolute(bin)) return exists(bin) ? bin : null;
	const exts = isWin
		? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
		: [""];
	const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
	for (const dir of dirs) {
		for (const ext of exts) {
			const p = join(
				dir,
				bin + (bin.toLowerCase().endsWith(ext.toLowerCase()) ? "" : ext)
			);
			if (exists(p)) return p;
		}
		if (isWin && exists(join(dir, bin))) return join(dir, bin);
	}
	return null;
}

function exists(p: string): boolean {
	try {
		accessSync(p, constants.X_OK);
		return statSync(p).isFile();
	} catch {
		return false;
	}
}

// spelled via char code because eslint's quotes rule and prettier disagree on escaping it
const DQ = String.fromCharCode(34);

function quoteWin(arg: string): string {
	if (arg === "") return DQ + DQ;
	if (!/[\s"&|<>^()]/.test(arg)) return arg;
	return DQ + arg.replaceAll(DQ, "\\" + DQ) + DQ;
}

export function exec(
	cmd: string,
	args: string[] = [],
	opts: ShOptions = {}
): Promise<ShResult> {
	return new Promise((resolve, reject) => {
		let file = cmd;
		let argv = args;
		let shell = false;
		if (isWin) {
			const resolved = which(cmd);
			const ext = resolved ? extname(resolved).toLowerCase() : "";
			if (ext === ".cmd" || ext === ".bat") {
				// node refuses to spawn .cmd shims without a shell
				shell = true;
				file = quoteWin(resolved!);
				argv = args.map(quoteWin);
			}
		}
		const env = { ...process.env, ...(opts.env ?? {}) };
		for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];

		const child = spawn(file, argv, {
			cwd: opts.cwd,
			env,
			shell,
			stdio: opts.inherit
				? "inherit"
				: ["ignore", opts.capture ? "pipe" : "pipe", "pipe"],
			windowsHide: true,
		});

		let stdout = "";
		let stderr = "";
		let forwarded: NodeJS.Signals | null = null;
		const forward = (sig: NodeJS.Signals) => {
			forwarded = sig;
			child.kill(sig);
		};
		process.on("SIGINT", forward);
		process.on("SIGTERM", forward);
		const prefix = opts.prefix ? c.dim(`[${opts.prefix}] `) : "";
		if (child.stdout) {
			if (opts.capture) {
				child.stdout.on("data", (d) => (stdout += d));
			} else {
				createInterface({ input: child.stdout }).on("line", (line) => {
					if (!opts.quiet) process.stdout.write(prefix + line + "\n");
				});
			}
		}
		if (child.stderr) {
			createInterface({ input: child.stderr }).on("line", (line) => {
				stderr += line + "\n";
				if (!opts.quiet) process.stderr.write(prefix + line + "\n");
			});
		}
		child.on("error", (err) => {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				reject(new CvError(`command not found: ${cmd}`));
			} else reject(err);
		});
		child.on("close", (code, signal) => {
			process.off("SIGINT", forward);
			process.off("SIGTERM", forward);
			if (forwarded) {
				reject(new CvError("", 130));
				return;
			}
			const exit = code ?? (signal ? 128 : 1);
			if (exit !== 0 && !opts.allowFail) {
				const tail = stderr.trim().split("\n").slice(-15).join("\n");
				reject(
					new CvError(
						`${cmd} ${args.join(" ")} exited with ${signal ?? code}` +
							(tail && (opts.quiet || opts.capture) ? `\n${tail}` : "")
					)
				);
				return;
			}
			resolve({ code: exit, stdout, stderr });
		});
	});
}

export type ShValue = string | number | false | null | undefined | ShValue[];

/**
 * A shell-like function usable three ways:
 *   sh("cargo", ["build"], { cwd })
 *   sh`cargo build --target ${target} ${extraFlags}`
 *   sh({ cwd, env })`cargo build`
 * In the tagged form literal text splits on whitespace (quotes group words),
 * every `${}` is exactly one argument, arrays spread into several, and
 * null/undefined/false interpolations vanish.
 */
export interface ShFn<R> {
	(cmd: string, args?: string[], opts?: ShOptions): Promise<R>;
	(strings: TemplateStringsArray, ...values: ShValue[]): Promise<R>;
	(
		opts: ShOptions
	): (strings: TemplateStringsArray, ...values: ShValue[]) => Promise<R>;
}

export function isTemplate(x: unknown): x is TemplateStringsArray {
	return Array.isArray(x) && Object.hasOwn(x, "raw");
}

function flatten(v: ShValue, into: string[] = []): string[] {
	if (Array.isArray(v)) for (const x of v) flatten(x, into);
	else if (v !== null && v !== undefined && v !== false) into.push(String(v));
	return into;
}

export function parseTemplate(
	strings: TemplateStringsArray,
	values: ShValue[]
): string[] {
	const argv: string[] = [];
	let token: string | null = null;
	const flush = () => {
		if (token !== null) argv.push(token);
		token = null;
	};
	for (let i = 0; i < strings.length; i++) {
		const text = strings[i];
		let quote: string | null = null;
		for (const ch of text) {
			if (quote) {
				if (ch === quote) quote = null;
				else token = (token ?? "") + ch;
			} else if (ch === DQ || ch === "'") {
				quote = ch;
				token ??= "";
			} else if (/\s/.test(ch)) {
				flush();
			} else {
				token = (token ?? "") + ch;
			}
		}
		if (quote) throw new CvError(`unterminated ${quote} in command template`);
		if (i >= values.length) continue;
		const v = values[i];
		const items = flatten(v);
		if (items.length === 1) {
			// a single value glues onto adjacent text: --out-dir=${dir}, ${dir}/file
			token = (token ?? "") + items[0];
		} else {
			flush();
			argv.push(...items);
		}
	}
	flush();
	return argv;
}

export function makeSh<R>(
	base: (cmd: string, args: string[], opts: ShOptions) => Promise<R>
): ShFn<R> {
	const fromTemplate = (
		opts: ShOptions,
		strings: TemplateStringsArray,
		values: ShValue[]
	) => {
		const [cmd, ...args] = parseTemplate(strings, values);
		if (!cmd) throw new CvError("empty command template");
		return base(cmd, args, opts);
	};
	const fn = (first: unknown, ...rest: unknown[]): unknown => {
		if (isTemplate(first)) return fromTemplate({}, first, rest as ShValue[]);
		if (typeof first === "string") {
			return base(
				first,
				(rest[0] as string[] | undefined) ?? [],
				(rest[1] as ShOptions | undefined) ?? {}
			);
		}
		const opts = first as ShOptions;
		return (strings: TemplateStringsArray, ...values: ShValue[]) =>
			fromTemplate(opts, strings, values);
	};
	return fn as ShFn<R>;
}

export async function output(
	cmd: string,
	args: string[] = [],
	opts: ShOptions = {}
): Promise<string> {
	const r = await exec(cmd, args, { ...opts, capture: true, quiet: true });
	return r.stdout.trim();
}
