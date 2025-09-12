/**
 * @fileoverview
 * Validates the packages structure with the expected bundles and some core type definition files.
 * This is meant to be run in CI, but you can run it locally too after executing `pnpm prepack` if you want to test before committing.
 */

import test from "ava";
import { glob } from "glob";
import { existsSync } from "node:fs";

/**
 * Expected distribution files for Scramjet's bundles.
 * All JS files listed must have corresponding source maps.
 * These aren't globs.
 */
const EXPECTED_DIST_FILES = [
	"dist/scramjet.all.js",
	"dist/scramjet.bundle.js",
	"dist/scramjet.sync.js",
	"dist/scramjet.wasm.wasm",
];

/**
 * Required type definition files and directories.
 * These aren't going to be all, because the modules update quite often, but the entry points and basic structure will be validatedl
 */
const EXPECTED_TYPE_FILES = [
	"dist/types/**/*.d.ts",
	"dist/types/index.d.ts",
	"lib/index.d.ts",
];

/**
 * Validates that all required distribution files exist in the package.
 * @param {import("ava").ExecutionContext} t - AVA unit test context.
 */
test("Package contains all required distribution files", async (t) => {
	const missingFiles = [];

	for (const filePath of EXPECTED_DIST_FILES) {
		if (!existsSync(filePath)) {
			missingFiles.push(filePath);
		}
	}

	t.deepEqual(
		missingFiles,
		[],
		`Missing required distribution files: ${missingFiles.join(", ")}`
	);
});

/**
 * Validates that all required JS files have their corresponding source maps.
 * @param {import("ava").ExecutionContext} t - AVA unit test context.
 */
test("All required JS bundles have corresponding source maps", async (t) => {
	const jsFiles = EXPECTED_DIST_FILES.filter((file) => file.endsWith(".js"));
	const missingMaps = [];

	for (const jsFile of jsFiles) {
		const mapFile = `${jsFile}.map`;
		if (!existsSync(mapFile)) {
			missingMaps.push(mapFile);
		}
	}

	t.deepEqual(
		missingMaps,
		[],
		`Missing source map files: ${missingMaps.join(", ")}`
	);
});

/**
 * Validates that core type definition are included in the package.
 * @param {import("ava").ExecutionContext} t - AVA unit test context.
 */
test("Package contains required type definitions", async (t) => {
	const missingTypeGlobs = [];

	for (const glob_ of EXPECTED_TYPE_FILES) {
		const matches = await glob(glob_);
		if (matches.length === 0) {
			missingTypeGlobs.push(glob_);
		}
	}

	t.deepEqual(
		missingTypeGlobs,
		[],
		`No type definition files found for globs: ${missingTypeGlobs.join(", ")}`
	);
});

/**
 * Validates the expected distribution format with globs for the package structure.
 * This serves as a last check for the basic structure of the package.
 * @param {import("ava").ExecutionContext} t - AVA unit test context.
 */
test("Package structure is valid for distribution", async (t) => {
	const distFiles = await glob("dist/**/*");
	const libFiles = await glob("lib/**/*");

	t.true(distFiles.length > 0, "Distribution directory should contain files");
	t.true(libFiles.length > 0, "Library directory should contain files");

	const hasJsFiles = distFiles.some((file) => file.endsWith(".js"));
	const hasWasmFile = distFiles.some((file) => file.endsWith(".wasm"));
	const hasTypeFiles = libFiles.some((file) => file.endsWith(".d.ts"));

	t.true(hasJsFiles, "Distribution should contain JS files");
	t.true(hasWasmFile, "Distribution should contain WASM file");
	t.true(hasTypeFiles, "Library should contain core type definition files");
});
