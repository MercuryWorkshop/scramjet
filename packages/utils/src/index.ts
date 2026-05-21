import { versionInfo } from "@mercuryworkshop/scramjet";
import { assertDependencyVersions } from "./version";

export { versionInfo };

/** Returns the global Scramjet bundle loaded via script tag or IIFE. */
export function getScramjet(): typeof import("@mercuryworkshop/scramjet") {
	assertDependencyVersions();
	return $scramjet;
}

/** Scramjet build metadata from the loaded core bundle. */
export function getVersionInfo() {
	assertDependencyVersions();
	return versionInfo;
}
