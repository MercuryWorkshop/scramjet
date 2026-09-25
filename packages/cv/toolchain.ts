import { c, confirm, CvError, log } from "./log.ts";
import { exec, output, which } from "./proc.ts";

export interface Requirement {
	/** executable name */
	bin: string;
	/** exact version the output of `bin <versionArgs>` must contain */
	version?: string;
	/** defaults to ["--version"] */
	versionArgs?: string[];
	/** command that installs it, run with cargo available (argv or shell-ish string) */
	install?: string[];
	/** where to get it when it cannot be installed automatically */
	hint?: string;
}

interface Problem {
	req: Requirement;
	reason: string;
}

const verified = new Set<string>();

async function check(req: Requirement): Promise<Problem | null> {
	const path = which(req.bin);
	if (!path) return { req, reason: "not found in PATH" };
	if (!req.version) return null;
	let out: string;
	try {
		out = await output(req.bin, req.versionArgs ?? ["--version"]);
	} catch {
		return { req, reason: "could not run it to check its version" };
	}
	if (!out.includes(req.version)) {
		return {
			req,
			reason: `found "${out.split("\n")[0]}", need ${req.version}`,
		};
	}
	return null;
}

/**
 * Verify that every tool a task needs is present, offering to install the
 * missing ones through cargo when that is possible.
 */
export async function ensureTools(
	reqs: Requirement[],
	opts: { yes: boolean }
): Promise<void> {
	const pending = reqs.filter((r) => !verified.has(JSON.stringify(r)));
	if (pending.length === 0) return;

	let problems = (await Promise.all(pending.map(check))).filter(
		(p): p is Problem => p !== null
	);
	if (problems.length === 0) {
		for (const r of pending) verified.add(JSON.stringify(r));
		return;
	}

	const cargo = which("cargo");
	const installable = problems.filter((p) => p.req.install && cargo);
	log.warn("missing build tools:");
	for (const p of problems) {
		log.info(`  ${c.bold(p.req.bin)}: ${p.reason}`);
	}

	if (installable.length > 0) {
		const ok =
			opts.yes ||
			(await confirm(
				`install ${installable.map((p) => p.req.bin).join(", ")} with cargo now?`
			));
		if (ok) {
			for (const p of installable) {
				const [cmd, ...args] = p.req.install!;
				log.info(c.dim(`$ ${p.req.install!.join(" ")}`));
				await exec(cmd, args, { inherit: true });
			}
			problems = (await Promise.all(pending.map(check))).filter(
				(p): p is Problem => p !== null
			);
		}
	}

	if (problems.length > 0) {
		const lines = problems.map((p) => {
			const how = p.req.install
				? cargo
					? `run: ${p.req.install.join(" ")}`
					: `install cargo (https://rustup.rs), then: ${p.req.install.join(" ")}`
				: (p.req.hint ?? "");
			return `  ${p.req.bin}: ${p.reason}${how ? `\n    ${how}` : ""}`;
		});
		throw new CvError(
			`cannot continue without these tools:\n${lines.join("\n")}` +
				(process.stdin.isTTY ? "" : "\n  (pass --yes to install automatically)")
		);
	}
	for (const r of pending) verified.add(JSON.stringify(r));
}
