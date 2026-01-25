import chalk from "chalk";
import Chafa from "chafa-wasm";
import { promisify } from "node:util";
const chafa = await Chafa();
const imageToAnsi = promisify(chafa.imageToAnsi);
import { stdout } from "node:process";
import rspack from "@rspack/core";

export function black() {
	return chalk.bgHex("000001");
}
export async function printBanner(image: Buffer, lines: string[]) {
	const imageWidth = 10;
	const totalWidth = 60;
	const { ansi: rawAnsi } = await imageToAnsi(image.buffer, {
		format: chafa.ChafaPixelMode.CHAFA_PIXEL_MODE_SYMBOLS.value,
		width: imageWidth,
		fontRatio: 0.5,
		colors: chafa.ChafaCanvasMode.CHAFA_CANVAS_MODE_TRUECOLOR.value,
		colorExtractor:
			chafa.ChafaColorExtractor.CHAFA_COLOR_EXTRACTOR_AVERAGE.value,
		colorSpace: chafa.ChafaColorSpace.CHAFA_COLOR_SPACE_RGB.value,
		symbols: "block+border+space-wide-inverted",
		fill: "full",
		fg: 0xffffff,
		bg: 0x000001,
		fgOnly: false,
		dither: chafa.ChafaDitherMode.CHAFA_DITHER_MODE_NONE.value,
		ditherGrainWidth: 4,
		ditherGrainHeight: 4,
		ditherIntensity: 1.0,
		preprocess: true,
		threshold: 0.5,
		optimize: 5,
		work: 5,
	});

	function stripAnsi(s: string) {
		return s.replace(/\x1b\[[0-9;]*m/g, "");
	}

	const ansiLines = rawAnsi.split(/\r?\n/).filter((l) => l.length > 0);
	const contentWidth = ansiLines.reduce((max, line) => {
		const w = stripAnsi(line).length;
		return w > max ? w : max;
	}, 0);

	const PAD_LEFT = 2;
	const PAD_TOP = 1;
	const PAD_BOTTOM = 1;

	function blackSpaces(count: number) {
		count = Math.abs(count);
		return black()(" ".repeat(count));
	}

	let out = "";
	out += (blackSpaces(totalWidth) + "\n").repeat(PAD_TOP);

	for (let i = 0; i < ansiLines.length; i++) {
		out += blackSpaces(PAD_LEFT);

		const line = ansiLines[i];
		const text = lines[i];
		const strippedLen = stripAnsi(line).length;
		const extraSpaces = contentWidth - strippedLen;

		if (text) {
			const textpad = 2;
			out +=
				line +
				blackSpaces(textpad) +
				text +
				blackSpaces(
					extraSpaces +
						totalWidth -
						contentWidth -
						PAD_LEFT -
						textpad -
						stripAnsi(text).length
				);
		} else {
			out +=
				line + blackSpaces(extraSpaces + totalWidth - contentWidth - PAD_LEFT);
		}
		out += "\n";
	}
	out += (blackSpaces(totalWidth) + "\n").repeat(PAD_BOTTOM);

	stdout.write("\x1b[2J\x1b[H");
	stdout.write(out);
}

let successCount = 0;
let lastSuccessCollapsed = false;

export function resetSuccessLog() {
	successCount = 0;
	lastSuccessCollapsed = false;
}

export function logSuccess() {
	successCount += 1;
	const suffix = successCount > 1 ? chalk.dim(` (x${successCount})`) : "";
	if (lastSuccessCollapsed && stdout.isTTY) {
		stdout.moveCursor(0, -1);
		stdout.clearLine(0);
		stdout.cursorTo(0);
	}
	stdout.write(`${chalk.green("Compiled successfully.")}${suffix}\n`);
	lastSuccessCollapsed = true;
}

export function runRspack(rspackConfig: any) {
	const compiler = rspack(rspackConfig);
	compiler.watch({}, (err, stats) => {
		if (err) {
			resetSuccessLog();
			stdout.write(chalk.red("Build failed:\n"));
			stdout.write(err.message + "\n");
			return;
		}
		if (!stats) return;

		const statList = Array.isArray((stats as any).stats)
			? (stats as any).stats
			: [stats];

		for (const stat of statList) {
			const text = stat.toString({ colors: false, modules: false });
			if (text.includes("compiled successfully")) {
				logSuccess();
			} else {
				resetSuccessLog();
				console.log(text);
			}
		}
	});
}

export function normalizeWebsocketUrl(url: string): string {
	return url.endsWith("/") ? url : `${url}/`;
}
