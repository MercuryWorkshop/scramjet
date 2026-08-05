declare const SCRAMJET_EXPECTED_VERSION: string;
declare const CONTROLLER_VERSION: string;

export const VERSION = CONTROLLER_VERSION;

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

export function assertRuntimeAkVersion() {
	if (typeof $ak === "undefined") {
		throw new Error(
			"the core runtime is not loaded. Load it before the controller."
		);
	}

	assertVersionMatch(
		"core",
		SCRAMJET_EXPECTED_VERSION,
		$ak.versionInfo.version
	);
}
