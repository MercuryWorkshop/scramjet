import { versionInfo as scramjetVersionInfo } from "@mercuryworkshop/scramjet";
import { versionInfo as controllerVersionInfo } from "@mercuryworkshop/scramjet-controller";

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

export function assertDependencyVersions() {
	if (typeof scramjetVersionInfo === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet is not loaded. Load scramjet before scramjet-utils."
		);
	}

	assertVersionMatch(
		"@mercuryworkshop/scramjet",
		SCRAMJET_EXPECTED_VERSION,
		scramjetVersionInfo.version
	);

	if (typeof controllerVersionInfo === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet-controller is not loaded. Load the controller before scramjet-utils."
		);
	}

	assertVersionMatch(
		"@mercuryworkshop/scramjet-controller",
		CONTROLLER_EXPECTED_VERSION,
		controllerVersionInfo.version
	);
}
