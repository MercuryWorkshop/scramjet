const useColor =
	!!process.stdout.isTTY &&
	!process.env.NO_COLOR &&
	process.env.TERM !== "dumb";

const wrap = (code: string) => (s: string) =>
	useColor ? `\x1b[${code}m${s}\x1b[0m` : s;

export const c = {
	dim: wrap("2"),
	bold: wrap("1"),
	red: wrap("31"),
	green: wrap("32"),
	yellow: wrap("33"),
	blue: wrap("34"),
	magenta: wrap("35"),
	cyan: wrap("36"),
};

export class CvError extends Error {
	exitCode: number;
	constructor(message: string, exitCode = 1) {
		super(message);
		this.exitCode = exitCode;
	}
}

export function fmtTime(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const m = Math.floor(ms / 60_000);
	const s = Math.round((ms % 60_000) / 1000);
	return `${m}m${s.toString().padStart(2, "0")}s`;
}

export const log = {
	info(msg: string) {
		console.log(msg);
	},
	warn(msg: string) {
		console.log(c.yellow("warn ") + msg);
	},
	error(msg: string) {
		console.error(c.red("error ") + msg);
	},
	task(id: string, msg: string) {
		console.log(`${c.cyan(id.padEnd(22))} ${msg}`);
	},
};

export async function confirm(
	question: string,
	fallback = false
): Promise<boolean> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) return fallback;
	const readline = await import("node:readline/promises");
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	try {
		const answer = (await rl.question(`${question} ${c.dim("[Y/n]")} `))
			.trim()
			.toLowerCase();
		return answer === "" || answer === "y" || answer === "yes";
	} finally {
		rl.close();
	}
}
