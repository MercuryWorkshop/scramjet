import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	COOKIE_WPT_FILES,
	includeCookieFile,
	includeFetchMetadataGeneratedFile,
	includeReferrerGeneratedFile,
} from "../src/tests/wpt/selection.ts";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const vendorRoot = path.join(packageRoot, "src/tests/wpt/vendored");

async function walkFiles(root: string): Promise<string[]> {
	const output: string[] = [];

	async function walk(current: string) {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			output.push(fullPath);
		}
	}

	await walk(root);
	return output;
}

async function ensureUpstreamRoot() {
	const providedRoot = process.env.WPT_SRC;
	if (providedRoot) {
		return {
			root: path.resolve(providedRoot),
			cleanup: async () => {},
		};
	}

	const tempDir = await mkdtemp(path.join(os.tmpdir(), "runway-wpt-"));
	const upstreamRoot = path.join(tempDir, "wpt");
	await execFileAsync("git", [
		"clone",
		"--depth",
		"1",
		"--filter=blob:none",
		"--sparse",
		"https://github.com/web-platform-tests/wpt.git",
		upstreamRoot,
	]);
	await execFileAsync("git", [
		"-C",
		upstreamRoot,
		"sparse-checkout",
		"set",
		"--no-cone",
		"cookies",
		"fetch/metadata/generated",
		"referrer-policy/gen",
	]);

	return {
		root: upstreamRoot,
		cleanup: async () => {
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}

async function copySelectedFiles(options: {
	upstreamRoot: string;
	sourceRoot: string;
	targetRoot: string;
	include: (relPath: string) => boolean;
}) {
	const absoluteSourceRoot = path.join(
		options.upstreamRoot,
		options.sourceRoot
	);
	const files = await walkFiles(absoluteSourceRoot);
	const selected = files
		.map((filePath) =>
			path.relative(options.upstreamRoot, filePath).replaceAll("\\", "/")
		)
		.filter(options.include);

	await rm(options.targetRoot, { recursive: true, force: true });
	await mkdir(options.targetRoot, { recursive: true });

	for (const relPath of selected) {
		const sourcePath = path.join(options.upstreamRoot, relPath);
		const targetPath = path.join(vendorRoot, relPath);
		await mkdir(path.dirname(targetPath), { recursive: true });
		await cp(sourcePath, targetPath);
	}

	return selected;
}

async function copyExplicitFiles(options: {
	upstreamRoot: string;
	targetRoot: string;
	files: readonly string[];
	include?: (relPath: string) => boolean;
}) {
	const selected = (
		options.include ? options.files.filter(options.include) : [...options.files]
	).map((file) => file.replaceAll("\\", "/"));

	await rm(options.targetRoot, { recursive: true, force: true });
	await mkdir(options.targetRoot, { recursive: true });

	for (const relPath of selected) {
		const sourcePath = path.join(options.upstreamRoot, relPath);
		const targetPath = path.join(vendorRoot, relPath);
		await mkdir(path.dirname(targetPath), { recursive: true });
		await cp(sourcePath, targetPath);
	}

	return selected;
}

async function main() {
	const upstream = await ensureUpstreamRoot();

	try {
		const referrerFiles = await copySelectedFiles({
			upstreamRoot: upstream.root,
			sourceRoot: "referrer-policy/gen",
			targetRoot: path.join(vendorRoot, "referrer-policy/gen"),
			include: includeReferrerGeneratedFile,
		});
		const fetchMetadataFiles = await copySelectedFiles({
			upstreamRoot: upstream.root,
			sourceRoot: "fetch/metadata/generated",
			targetRoot: path.join(vendorRoot, "fetch/metadata/generated"),
			include: includeFetchMetadataGeneratedFile,
		});
		const cookieFiles = await copyExplicitFiles({
			upstreamRoot: upstream.root,
			targetRoot: path.join(vendorRoot, "cookies"),
			files: COOKIE_WPT_FILES,
			include: includeCookieFile,
		});

		console.log(
			`Generated ${referrerFiles.length} referrer-policy file(s), ${fetchMetadataFiles.length} fetch-metadata file(s), and ${cookieFiles.length} cookie file(s).`
		);
	} finally {
		await upstream.cleanup();
	}
}

main().catch((error) => {
	console.error(
		error instanceof Error ? error.stack || error.message : String(error)
	);
	process.exit(1);
});
