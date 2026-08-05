/**
 * Version information for the current Ak build.
 * Contains both the semantic version string and the git commit hash for build identification.
 */
export interface AkVersionInfo {
	/** The semantic version */
	version: string;
	/** The git commit hash that this build was created from */
	build: string;
	/** The date of the build */
	date: string;
}

/**
 * Ak Feature Flags, configured at build time
 */
export type AkFlags = {
	syncxhr: boolean;
	disableComputedWrap: boolean;
	rewriterLogs: boolean;
	captureErrors: boolean;
	cleanErrors: boolean;
	scramitize: boolean;
	sourcemaps: boolean;
	destructureRewrites: boolean;
	allowInvalidJs: boolean;
	allowFailedIntercepts: boolean;
	debugTrampolines: boolean;
	debugSourceURL: boolean;
	encapsulateWorkers: boolean;
};

export interface AkConfig {
	globals: {
		wrapfn: string;
		wrappropertybase: string;
		wrappropertyfn: string;
		cleanrestfn: string;
		importfn: string;
		rewritefn: string;
		metafn: string;
		wrappostmessagefn: string;
		pushsourcemapfn: string;
		trysetfn: string;
		templocid: string;
		tempunusedid: string;
	};
	flags: AkFlags;
	siteFlags: Record<string, Partial<AkFlags>>;
	maskedfiles: string[];
}

/**
 * The config for Ak initialization.
 */
export interface AkInitConfig
	extends Omit<AkConfig, "codec" | "flags"> {
	flags: Partial<AkFlags>;
	codec: {
		encode: (url: string) => string;
		decode: (url: string) => string;
	};
}

//eslint-disable-next-line
export type AnyFunction = Function;
