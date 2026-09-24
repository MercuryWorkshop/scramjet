import { unrewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
import { isOwnScript } from "@client/nativeerror";
import { RAWFRAMES } from "@/symbols";
import {
	Error_prototype_toString,
	Object_defineProperty,
	Reflect_apply,
	String,
	String_split,
} from "@/shared/snapshot";

export const enabled = (client: ScramjetClient) =>
	client.flagEnabled("cleanErrors");

export default function (client: ScramjetClient, _self: Self) {
	// v8 only. all we need to do is clean the scramjet urls from stack traces
	const closure = (error: any, frames: any[]) => {
		// scramjet reading a stack for itself wants the CallSites, not the string
		// a page gets. this formatter refuses to be replaced, so this marker is
		// the only way past it - see `shared/incumbency.ts`
		if (error && error[RAWFRAMES]) return frames;

		// V8 calls this *to produce* `error.stack`, so reading `error.stack` here
		// is re-entrant - it comes back already formatted by the default
		// formatter, which is how this used to work and why the CallSite list was
		// only ever mined for filenames. Build the string the way the default
		// formatter does instead: `Error.prototype.toString` for the header,
		// which is what V8 uses for a DOMException as much as for an Error, then
		// one "\n    at <frame>" per surviving frame.
		//
		// the header itself must not be allowed to throw: a page can define a
		// throwing `name` or `message` getter, and this runs while V8 is already
		// producing a stack
		let stack: string;
		try {
			stack = Reflect_apply(Error_prototype_toString, error, []);
		} catch (formatError) {
			// Match V8's AppendErrorString fallback, including a second failure
			// while formatting the exception thrown by a name/message getter.
			// https://github.com/v8/v8/blob/main/src/execution/messages.cc
			try {
				stack =
					"<error: " +
					Reflect_apply(Error_prototype_toString, formatError, []) +
					">";
			} catch {
				stack = "<error>";
			}
		}

		for (let i = 0; i < frames.length; i++) {
			let file: string | null = null;
			// what the frame is *named*, which is the `//# sourceURL` when the
			// script has one and the resource URL when it does not. `getFileName`
			// is always the resource URL, so it decides whether the frame is ours
			// to drop, but it is not the string the frame text contains
			let shown: string | null = null;
			try {
				file = frames[i].getFileName();
				shown = frames[i].getScriptNameOrSourceURL();
			} catch {
				// a frame with no file - eval, or native code - is kept as-is
			}

			// strip stack frames including scramjet handlers from the trace
			if (file && isOwnScript(file, client.config.maskedfiles)) continue;

			let frame = String(frames[i]);
			if (shown) {
				try {
					// splitting on the url rather than replaceAll, which a page can
					// replace on String.prototype
					frame = String_split(frame, shown).join(
						unrewriteUrl(shown, client.context)
					);
				} catch {
					// not one of ours; leave the frame alone
				}
			}

			stack += "\n    at " + frame;
		}

		return stack;
	};

	// TODO: look into making this nonconfigurable?
	Object_defineProperty(client.global.Error, "prepareStackTrace", {
		get() {
			// this is a funny js quirk. the getter is ran every time you type something in console
			return closure;
		},
		set() {
			// just ignore it if a site tries setting their own. not much we can really do
		},
		enumerable: false,
		configurable: true,
	});
}
