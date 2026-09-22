import { unrewriteUrl } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
import { SCRAMJET_SCRIPT_URL } from "@client/nativeerror";
import {
	Error_prototype_toString,
	Object_defineProperty,
	Reflect_apply,
	String,
	String_endsWith,
	String_split,
} from "@/shared/snapshot";

export const enabled = (client: ScramjetClient) =>
	client.flagEnabled("cleanErrors");

export default function (client: ScramjetClient, _self: Self) {
	// v8 only. all we need to do is clean the scramjet urls from stack traces
	const isOwnScript = (url: string): boolean => {
		// the client bundle, identified by a frame from inside it rather than by
		// name, so this holds however the embedder chose to serve it
		if (url === SCRAMJET_SCRIPT_URL) return true;

		const masked = client.config.maskedfiles;
		if (!masked) return false;

		for (let i = 0; i < masked.length; i++) {
			if (String_endsWith(url, masked[i])) return true;
		}

		return false;
	};

	const closure = (error: any, frames: any[]) => {
		// stack must be entirely rebuilt by us
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
			let url: string | null = null;
			try {
				url = frames[i].getFileName();
			} catch {
				// a frame with no file - eval, or native code - is kept as-is
			}

			// strip stack frames including scramjet handlers from the trace
			if (url && isOwnScript(url)) continue;

			let frame = String(frames[i]);
			if (url) {
				try {
					frame = String_split(frame, url).join(
						unrewriteUrl(url, client.context)
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
