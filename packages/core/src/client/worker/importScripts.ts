import { GlobalScope, ScramjetClient } from "@client/index";
import { String } from "@/shared/snapshot";
import { Arguments, Returns, idlUSVString } from "@client/webidl";

export default function (client: ScramjetClient) {
	/**
	 * The string one `urls` entry contributes.
	 *
	 * The spec's first step is the get trusted type compliant string algorithm,
	 * which reads a TrustedScriptURL's data out of an internal slot rather than
	 * through its `toString` - which a page can replace. On an engine that has
	 * trusted types the declared union has already sorted the two cases out: a
	 * string arrived converted to a USVString, and a non-string is a real
	 * TrustedScriptURL. On an engine that has none there is nothing to
	 * disambiguate against, so the union degrades to a passthrough and the
	 * USVString conversion has to happen here instead.
	 */
	const scriptURLData = (url: TrustedScriptURL | string): string => {
		if (typeof url === "string") return url;
		if (client.box.ctors.TrustedScriptURL) {
			return String(new client.native.TrustedScriptURL(url).toString());
		}

		return idlUSVString(url);
	};

	// https://html.spec.whatwg.org/multipage/workers.html#dom-workerglobalscope-importscripts
	client.Intercept(class extends GlobalScope {
		@Arguments("(TrustedScriptURL or USVString)... urls")
		@Returns("undefined")
		static importScripts(...urls: (TrustedScriptURL | string)[]): void {
			// every URL is resolved before any of them is fetched, which is the
			// spec's own order: it builds the whole urlRecords list, throwing a
			// "SyntaxError" DOMException for the first failure, and only then
			// starts fetching. rewriting inside the fetch loop would import the
			// first few scripts and *then* throw
			const rewritten: string[] = [];
			for (let i = 0; i < urls.length; i++) {
				// a URL that does not parse comes back untouched, so the native
				// still throws the SyntaxError, and about the page's own string
				rewritten[i] = client.rewriteUrl(scriptURLData(urls[i]));
			}

			// TODO: the NetworkError for a script that would not load says "The
			// script at '<url>' failed to load", and by then the URL is the
			// rewritten one. It cannot be repaired here for the reason above,
			// and a DOMException's `message` is readonly, so it wants to be
			// fixed where the failure is produced rather than where it surfaces.
			// (The SyntaxError for an unparseable URL is already clean: such a
			// URL reaches the native exactly as the page wrote it.)
			new client.native.window(this).importScripts(...rewritten);
		}
	});
}
