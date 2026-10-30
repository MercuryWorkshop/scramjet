import { versionInfo as scramjetVersionInfo } from "@mercuryworkshop/scramjet";
import { versionInfo as controllerVersionInfo } from "@mercuryworkshop/scramjet-controller";
import parse from "semver/functions/parse";

declare const SCRAMJET_EXPECTED_VERSION: string;
declare const CONTROLLER_EXPECTED_VERSION: string;
declare const VERSION: string;
declare const COMMITHASH: string;
declare const BUILDDATE: string;

export const versionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};

// release versions are compatible if major.minor match (any patch)
// prerelease versions must match exactly
function isCompatible(expected: string, actual: string): boolean {
	const e = parse(expected);
	const a = parse(actual);
	if (!e || !a) return false;

	if (e.prerelease.length > 0 || a.prerelease.length > 0) {
		return e.compare(a) === 0;
	}

	return e.major === a.major && e.minor === a.minor;
}

function assertVersionCompatible(
	packageName: string,
	expected: string,
	actual: string
) {
	if (!isCompatible(expected, actual)) {
		throw new Error(
			`${packageName} version mismatch: this build expects ${expected}, but the loaded runtime is ${actual}`
		);
	}
}

export function assertDependencyVersions() {
	if (typeof scramjetVersionInfo === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet is not loaded. Load scramjet before scramjet-utils."
		);
	}

	assertVersionCompatible(
		"@mercuryworkshop/scramjet",
		SCRAMJET_EXPECTED_VERSION,
		scramjetVersionInfo.version
	);

	if (typeof controllerVersionInfo === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet-controller is not loaded. Load the controller before scramjet-utils."
		);
	}

	assertVersionCompatible(
		"@mercuryworkshop/scramjet-controller",
		CONTROLLER_EXPECTED_VERSION,
		controllerVersionInfo.version
	);
}
