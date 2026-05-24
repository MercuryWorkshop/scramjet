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
	if (typeof $scramjet === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet is not loaded. Load scramjet before scramjet-utils."
		);
	}

	assertVersionMatch(
		"@mercuryworkshop/scramjet",
		SCRAMJET_EXPECTED_VERSION,
		$scramjet.versionInfo.version
	);

	if (typeof $scramjetController === "undefined") {
		console.error(
			"@mercuryworkshop/scramjet-controller is not loaded. Load the controller before scramjet-utils."
		);
	}

	assertVersionMatch(
		"@mercuryworkshop/scramjet-controller",
		CONTROLLER_EXPECTED_VERSION,
		$scramjetController.VERSION
	);
}
