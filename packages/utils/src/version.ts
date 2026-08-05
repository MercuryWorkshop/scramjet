declare const SCRAMJET_EXPECTED_VERSION: string;
declare const CONTROLLER_EXPECTED_VERSION: string;

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
	if (typeof $ak === "undefined") {
		console.error(
			"the core runtime is not loaded. Load it before utils."
		);
	}

	assertVersionMatch(
		"core",
		SCRAMJET_EXPECTED_VERSION,
		$ak.versionInfo.version
	);

	if (typeof $akController === "undefined") {
		console.error(
			"the controller is not loaded. Load it before utils."
		);
	}

	assertVersionMatch(
		"controller",
		CONTROLLER_EXPECTED_VERSION,
		$akController.VERSION
	);
}
