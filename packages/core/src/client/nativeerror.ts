/**
 * Errors an interceptor throws itself, shaped so a page cannot tell them from
 * the browser's own.
 *
 * Most of the time a member should let the native throw - that is what the IDL
 * validator's rejection path is for, and an authentic error costs nothing. This
 * exists for the cases where it cannot: where delegating would name the proxy's
 * origin, run a page getter a second time, or perform the very side effect the
 * call was being rejected for.
 *
 * Every format below was measured against Chrome rather than inferred:
 *
 *   execute    Failed to execute 'set' on 'Headers': Invalid name
 *   construct  Failed to construct 'AbortSignal': Illegal constructor
 *   set        Failed to set the 'currentTime' property on 'HTMLMediaElement':
 *              The provided double value is non-finite.
 *   read       Failed to read the 'mode' property from 'RequestInit': The
 *              provided value 'bogus' is not a valid enum value of type
 *              RequestMode.
 *   arity      Failed to execute 'registerProtocolHandler' on 'Navigator':
 *              2 arguments required, but only 0 present.
 *   brand      Illegal invocation
 *
 * `read` doubles as the dictionary-member form and nests: Blink writes a bad
 * enum inside a dictionary as the whole of
 * `Failed to construct 'Request': Failed to read the 'mode' property from
 * 'RequestInit': ...`, which is {@link NativeErrors.message} called twice, the
 * inner result passed out as the outer `detail`.
 */

import {
	Error,
	String_endsWith,
	String_split,
	String_trim,
} from "@/shared/snapshot";
import type { AnyFunction } from "@/types";

/** `at name (https://host/path.js:1:2)`, or the same without the name. */
const FRAME_URL = /\(?((?:https?|blob|data|file):[^\s)]+):\d+:\d+\)?$/;

/**
 * Scramjet's own script URL, taken from a stack frame that is ours by
 * construction - this runs while the client bundle is evaluating.
 *
 * `maskedfiles` is the embedder's list and is matched by filename suffix. That
 * covers the client wherever it is compiled into a file the embedder already
 * names - browser.js bundles it into `inject.js` and masks that - but not a
 * deployment that serves it on its own, and a suffix cannot name it without
 * also matching any page script that happens to share the filename. A frame
 * captured here is unambiguous and needs no configuration to be right.
 *
 * Null off V8, or if the frame format ever changes; callers fall back to the
 * embedder's list.
 */
export const SCRAMJET_SCRIPT_URL: string | null = (() => {
	const stack = new Error().stack;
	if (!stack) return null;

	const lines = String_split(stack, "\n");
	// line 0 is the `Error` header
	for (let i = 1; i < lines.length; i++) {
		const match = FRAME_URL.exec(String_trim(lines[i]));
		if (match) return match[1];
	}

	return null;
})();

/**
 * Whether a stack frame's file is scramjet's own - the client bundle, or a
 * file the embedder compiled it into and named in `maskedfiles`.
 *
 * Used both to drop scramjet's frames out of a page's stack and to skip past
 * them when scramjet is reading a stack for itself, where the first frame that
 * is *not* ours is the script that called in.
 */
export function isOwnScript(
	url: string,
	maskedfiles: string[] | undefined
): boolean {
	if (url === SCRAMJET_SCRIPT_URL) return true;
	if (!maskedfiles) return false;

	for (let i = 0; i < maskedfiles.length; i++) {
		if (String_endsWith(url, maskedfiles[i])) return true;
	}

	return false;
}

/**
 * Where a member sits, for the prefix Blink puts on its message. Exactly one of
 * `execute` / `construct` / `set` / `read` names the member; omit all four and
 * the detail stands alone, which is what a bare `Illegal invocation` looks
 * like.
 */
export type NativeErrorSite = {
	/** an operation */
	execute?: string;
	/** a constructor */
	construct?: string;
	/** an attribute setter */
	set?: string;
	/** an attribute getter, or a dictionary member */
	read?: string;
	/** the interface, or the dictionary, named by `execute` / `set` / `read` */
	on?: string;
};

export type NativeErrorInit = NativeErrorSite & {
	/** the sentence after the prefix, verbatim */
	detail: string;
	/**
	 * The frame to cut the stack at, normally the interceptor member itself.
	 *
	 * It MUST be on the stack when the error is built. V8 answers a function
	 * that is not with an *empty* trace, which is a louder tell than the frames
	 * it was meant to hide. Left out, it cuts at the factory below, which hides
	 * this module and nothing else.
	 */
	caller?: AnyFunction;
};

type ArityInit = NativeErrorSite & {
	required: number;
	present: number;
	caller?: AnyFunction;
};

export class NativeErrors {
	private readonly DOMException: typeof DOMException;
	private readonly TypeError: typeof TypeError;
	private readonly RangeError: typeof RangeError;
	private readonly captureStackTrace?: (
		target: object,
		caller?: AnyFunction
	) => void;

	/**
	 * `global` is the realm the errors are built in, so that `instanceof` holds
	 * for the page that catches them. Captured at hook time, before any page
	 * script has run.
	 *
	 * A member borrowed across realms would want the receiver's realm rather
	 * than this one - see `ScramjetClient.relevantClient` - but an interceptor
	 * is installed per realm, so these agree for every call that is not
	 * deliberately borrowing.
	 */
	constructor(global: Self) {
		this.DOMException = global.DOMException;
		this.TypeError = global.TypeError;
		this.RangeError = global.RangeError;
		this.captureStackTrace = (
			global.Error as unknown as {
				captureStackTrace?: (target: object, caller?: AnyFunction) => void;
			}
		).captureStackTrace;
	}

	/** The prefixed message for a site, without building an error around it. */
	message(site: NativeErrorSite, detail: string): string {
		if (site.construct !== undefined) {
			return `Failed to construct '${site.construct}': ${detail}`;
		}
		if (site.execute !== undefined) {
			return `Failed to execute '${site.execute}' on '${site.on}': ${detail}`;
		}
		if (site.set !== undefined) {
			return `Failed to set the '${site.set}' property on '${site.on}': ${detail}`;
		}
		if (site.read !== undefined) {
			return `Failed to read the '${site.read}' property from '${site.on}': ${detail}`;
		}

		return detail;
	}

	/** eg `domException("SecurityError", { execute: "pushState", on: "History", detail, caller })` */
	domException(name: string, init: NativeErrorInit): DOMException {
		return this.stamp(
			new this.DOMException(this.message(init, init.detail), name),
			init.caller ?? this.domException
		);
	}

	typeError(init: NativeErrorInit): TypeError {
		return this.stamp(
			new this.TypeError(this.message(init, init.detail)),
			init.caller ?? this.typeError
		);
	}

	rangeError(init: NativeErrorInit): RangeError {
		return this.stamp(
			new this.RangeError(this.message(init, init.detail)),
			init.caller ?? this.rangeError
		);
	}

	/** What a failed brand check throws. Carries no prefix - measured. */
	illegalInvocation(caller?: AnyFunction): TypeError {
		return this.stamp(
			new this.TypeError("Illegal invocation"),
			caller ?? this.illegalInvocation
		);
	}

	/**
	 * Too few arguments. Rarely needed by hand: `@Arguments` gives the validator
	 * a required count, and a call below it is rejected and handed to the
	 * native, which throws this itself.
	 */
	arity(init: ArityInit): TypeError {
		return this.typeError({
			...init,
			detail: `${init.required} argument${init.required === 1 ? "" : "s"} required, but only ${init.present} present.`,
			caller: init.caller ?? this.arity,
		});
	}

	/**
	 * Give `error` the stack a natively thrown one has.
	 *
	 * A DOMException built with `new` has no own `stack` at all, where a thrown
	 * one has an own accessor: `"stack" in error` is false against true, which
	 * is one line to check. `captureStackTrace` reproduces the descriptor
	 * exactly - own accessor, getter and setter, enumerable false, configurable
	 * true - and lets V8 write the header, which is `Error.prototype.toString`
	 * for a DOMException just as for an Error.
	 *
	 * What it cannot hide is the frames the interceptor machinery adds beneath
	 * the member. Those are `shared/error.ts`'s job, and it only runs with the
	 * `cleanErrors` flag on.
	 */
	private stamp<T extends object>(error: T, caller: AnyFunction): T {
		if (this.captureStackTrace) this.captureStackTrace(error, caller);

		return error;
	}
}
