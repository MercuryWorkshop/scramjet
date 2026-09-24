import { flagValue, ScramjetContext } from "@/shared";
import { IncumbencyMode } from "@/types";
import {
	Array_isArray,
	Error,
	Object_defineProperty,
	Object_getOwnPropertyDescriptor,
	Reflect_deleteProperty,
} from "@/shared/snapshot";
import { RAWFRAMES } from "@/symbols";

/** V8's CallSite, of which only what is needed here is named */
export type CallSite = {
	getScriptHash?: () => string;
	getScriptNameOrSourceURL?: () => string | undefined;
	getFileName?: () => string | undefined;
	isEval?: () => boolean;
};

/**
 * Set `Error.stackTraceLimit` to `frames` for as long as it takes to construct
 * an error, and hand back what puts the page's own back.
 *
 * The limit is the page's to set, and one of 0 - or none at all - leaves an
 * error with no frames to read the caller from. It is swapped by descriptor,
 * so a page that made it an accessor does not see it read or written.
 */
function raiseStackLimit(frames: number): () => void {
	const saved = Object_getOwnPropertyDescriptor(Error, "stackTraceLimit");
	const raised = {
		value: frames,
		writable: true,
		configurable: true,
		enumerable: saved ? saved.enumerable : false,
	};

	if (!saved) {
		Object_defineProperty(Error, "stackTraceLimit", raised);

		return () => {
			Reflect_deleteProperty(Error, "stackTraceLimit");
		};
	}
	if (saved.configurable) {
		Object_defineProperty(Error, "stackTraceLimit", raised);

		return () => {
			Object_defineProperty(Error, "stackTraceLimit", saved);
		};
	}
	if ("value" in saved && saved.writable) {
		(Error as any).stackTraceLimit = frames;

		return () => {
			(Error as any).stackTraceLimit = saved.value;
		};
	}

	// frozen by the page: whatever it allows is all there is
	return () => {};
}

/**
 * The CallSites for the current stack, past the formatter a page sees - at
 * least `frames` of them, counting this function's own, where the stack is
 * that deep.
 *
 * Null off V8, or when neither route to raw frames is open: `shared/error.ts`
 * honouring {@link RAWFRAMES}, or - if that formatter is not installed -
 * setting one for the length of the call and putting the old one back.
 */
export function rawCallSites(frames: number): CallSite[] | null {
	// constructed here rather than in a helper, which would be a frame of its
	// own at the top of every stack
	let restore = raiseStackLimit(frames);
	let err: Error;
	try {
		err = new Error();
	} finally {
		restore();
	}
	err[RAWFRAMES] = true;

	try {
		const asis = err.stack as unknown;
		if (Array_isArray(asis)) return asis as CallSite[];
	} catch {
		// a formatter that throws is not one to keep asking
	}

	try {
		const saved = (Error as any).prepareStackTrace;
		try {
			(Error as any).prepareStackTrace = (_e: Error, frames: CallSite[]) =>
				frames;
			restore = raiseStackLimit(frames);
			let stack: unknown;
			try {
				stack = new Error().stack;
			} finally {
				restore();
			}

			return Array_isArray(stack) ? (stack as CallSite[]) : null;
		} finally {
			(Error as any).prepareStackTrace = saved;
		}
	} catch {
		return null;
	}
}

/**
 * Whether this engine can do `pst`: `Error.prepareStackTrace` handing back
 * CallSites, and `getScriptHash` populated on them.
 *
 * Probed once while the bundle is still evaluating, which is before any client
 * module traps `Error.prepareStackTrace` and before the page has run.
 *
 * It measures the bundle's own script, so a deployment that injects scramjet
 * somewhere a hash is not computed for - CDP evaluation, where the hash comes
 * back empty - reads as unavailable even though the page's own scripts would
 * have had one. The defaults select `lazystamp` when this probe fails.
 */
export const pstAvailable: boolean = (() => {
	const frames = rawCallSites(1);
	if (!frames || frames.length === 0) return false;

	try {
		const hash = frames[0].getScriptHash?.();

		return typeof hash === "string" && hash.length > 0;
	} catch {
		return false;
	}
})();

/**
 * The configured mode, as configured. Nothing is substituted for anything:
 * which mode an engine can actually do is decided once, where the defaults are
 * built ({@link pstAvailable}), and a `pst` handed to an engine without the
 * two V8-only pieces it needs simply does not attribute anything.
 */
export function incumbencyMode(
	context: ScramjetContext,
	url: URL
): IncumbencyMode {
	return flagValue("incumbency", context, url);
}
