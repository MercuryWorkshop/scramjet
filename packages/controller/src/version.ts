import parse from "semver/functions/parse";

declare const SCRAMJET_EXPECTED_VERSION: string;
declare const CONTROLLER_VERSION: string;

export const VERSION = CONTROLLER_VERSION;

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

export function assertRuntimeScramjetVersion() {
	if (typeof $scramjet === "undefined") {
		throw new Error(
			"@mercuryworkshop/scramjet is not loaded. Load scramjet before the controller."
		);
	}

	assertVersionCompatible(
		"@mercuryworkshop/scramjet",
		SCRAMJET_EXPECTED_VERSION,
		$scramjet.versionInfo.version
	);
}
