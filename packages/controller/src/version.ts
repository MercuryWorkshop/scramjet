import { versionInfo as scramjetVersionInfo } from "@mercuryworkshop/scramjet";

declare const SCRAMJET_EXPECTED_VERSION: string;
declare const VERSION: string;
declare const COMMITHASH: string;
declare const BUILDDATE: string;

export const versionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};

function assertVersionMatch(
	packageName: string,
	expected: string,
	actual: string
) {
	if (expected !== actual) {
		throw new Error(
			`${packageName} version mismatch: this build expects ${expected}, but the loaded runtime is ${actual}`
		);
	}
}

export function assertRuntimeScramjetVersion() {
	if (typeof scramjetVersionInfo === "undefined") {
		throw new Error(
			"@mercuryworkshop/scramjet is not loaded. Load scramjet before the controller."
		);
	}

	assertVersionMatch(
		"@mercuryworkshop/scramjet",
		SCRAMJET_EXPECTED_VERSION,
		scramjetVersionInfo.version
	);
}
