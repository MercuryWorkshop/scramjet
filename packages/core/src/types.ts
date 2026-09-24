/**
 * Version information for the current Scramjet build.
 * Contains both the semantic version string and the git commit hash for build identification.
 */
export interface ScramjetVersionInfo {
	/** The semantic version */
	version: string;
	/** The git commit hash that this build was created from */
	build: string;
	/** The date of the build */
	date: string;
}

/**
 * Scramjet Feature Flags, configured at build time
 */
/**
 * How a stack frame is traced back to the script that owns it, which is what
 * lets an incumbent settings object be identified.
 *
 * - `pst`   `Error.prepareStackTrace` plus `CallSite.getScriptHash`, both V8
 *           only. Costs nothing observable: the hash is already on every
 *           frame, eval'd ones included, and is not part of what a page reads.
 * - `stamp` Every call in a rewritten script goes through `callfn`, which
 *           records the calling script's realm for the length of the call.
 *           Reads no stack and shows the page nothing, at the cost of a call
 *           through a function for every call the page makes.
 * - `lazystamp`
 *           `stamp`, narrowed at rewrite time to the calls that look like they
 *           need attributing. Cheap enough to be what the default flags pick
 *           off V8, where `pst` has nothing to read. Misses a call reached
 *           through a reference the rewriter could not recognise, such as a
 *           bound one.
 * - `none`  No attribution.
 *
 * Nothing substitutes one mode for another at use time: the default flags
 * choose one the engine can do, and a mode set by hand is used as given.
 */
export type IncumbencyMode = "pst" | "stamp" | "lazystamp" | "none";

export type ScramjetFlags = {
	syncxhr: boolean;
	disableComputedWrap: boolean;
	rewriterLogs: boolean;
	captureErrors: boolean;
	cleanErrors: boolean;
	sourcemaps: boolean;
	destructureRewrites: boolean;
	allowInvalidJs: boolean;
	debugTrampolines: boolean;
	debugSourceURL: boolean;
	incumbency: IncumbencyMode;
	encapsulateWorkers: boolean;
};

export interface ScramjetConfig {
	globals: {
		wrapfn: string;
		wrappropertybase: string;
		wrappropertyfn: string;
		callfn: string;
		cleanrestfn: string;
		importfn: string;
		rewritefn: string;
		metafn: string;
		pushsourcemapfn: string;
		registerrealmfn: string;
		trysetfn: string;
		templocid: string;
		tempreceiverid: string;
		tempcalleeid: string;
		tempunusedid: string;
	};
	flags: ScramjetFlags;
	siteFlags: Record<string, Partial<ScramjetFlags>>;
	maskedfiles: string[];
}

/**
 * The config for Scramjet initialization.
 */
export interface ScramjetInitConfig
	extends Omit<ScramjetConfig, "codec" | "flags"> {
	flags: Partial<ScramjetFlags>;
	codec: {
		encode: (url: string) => string;
		decode: (url: string) => string;
	};
}

//eslint-disable-next-line
export type AnyFunction = Function;
