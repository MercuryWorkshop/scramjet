import { ScramjetClient } from "@client/index";
import { Tap } from "@/Tap";
import { Arguments, Returns } from "@client/webidl";
import { _Map, _URL } from "@/shared/snapshot";
import {
	canHaveItsURLRewritten,
	rewriteHistoryUrl,
	splitFragment,
} from "@rewriters/url";

export default function (client: ScramjetClient, _self: Self) {
	const stateUrlRejected = (
		method: string,
		url: string,
		documentUrl: URL
	): DOMException =>
		client.errors.domException("SecurityError", {
			execute: method,
			on: "History",
			detail: `A history state object with URL '${url}' cannot be created in a document with origin '${documentUrl.origin}' and URL '${documentUrl.href}'.`,
			caller: resolveStateUrl,
		});

	/**
	 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#shared-history-push/replace-state-steps
	 *
	 * Returns the URL to hand the native, or null for "no URL change".
	 */
	const resolveStateUrl = (
		history: History,
		url: string | null,
		method: string
	): string | null => {
		// null is the IDL default and means the entry keeps the document's URL.
		// Chrome reads "" the same way - the spec would parse it, against the
		// base URL - so the two are the only values that mean it. 0 is the
		// relative URL "0", which a truthiness test silently drops.
		if (url === null || url === "") return null;

		const relevantclient = client.box.histories.get(history);
		const documentUrl = relevantclient.url;

		// "parse url, relative to the relevant settings object of history" -
		// against the site's base URL, base element and all, and not the
		// proxy's. Resolved *before* the check rather than after: a
		// scheme-relative "//evil.example/x" does not parse on its own, so an
		// absolute-only parse skips the check entirely and then hands the
		// rewriter a cross-origin URL.
		let parsed: URL;
		try {
			parsed = new _URL(url, relevantclient.meta.base);
		} catch {
			// an unparseable URL is a SecurityError too, and Chrome reports it in
			// the same sentence as a cross-origin one. It renders the URL as far
			// as its parser got - "http://" comes back as "http:", "http://[" as
			// "http://[/" - which the standard parser cannot reproduce because it
			// simply throws, so the argument is reported verbatim instead
			throw stateUrlRejected(method, url, documentUrl);
		}

		if (!canHaveItsURLRewritten(documentUrl, parsed)) {
			throw stateUrlRejected(method, parsed.href, documentUrl);
		}

		let urls = client.box.historyUrls.get(relevantclient);
		if (!urls) {
			urls = new _Map<string, string>();
			const raw = relevantclient.meta.rawUrl;
			if (raw !== undefined) {
				urls.set(splitFragment(documentUrl.href)[0], splitFragment(raw)[0]);
			}
			client.box.historyUrls.set(relevantclient, urls);
		}

		const [site, fragment] = splitFragment(parsed.href);
		const known = urls.get(site);
		if (known !== undefined) return known + (fragment ?? "");

		const rewritten = rewriteHistoryUrl(
			parsed,
			relevantclient.context,
			relevantclient.meta
		);
		urls.set(site, splitFragment(rewritten)[0]);

		return rewritten;
	};

	const dispatchNavigate = (history: History) => {
		const relevantclient = client.box.histories.get(history);
		Tap.dispatch(
			relevantclient.hooks.lifecycle.navigate,
			{ type: "history" },
			{ url: relevantclient.url.href }
		);
	};

	client.Intercept(class extends History {
		@Arguments("any", "DOMString", "optional USVString? url = null")
		@Returns("undefined")
		pushState(data: any, unused: string, url: string | null = null): void {
			void super.length;

			super.pushState(data, unused, resolveStateUrl(this, url, "pushState"));
			dispatchNavigate(this);
		}

		@Arguments("any", "DOMString", "optional USVString? url = null")
		@Returns("undefined")
		replaceState(data: any, unused: string, url: string | null = null): void {
			void super.length;

			super.replaceState(
				data,
				unused,
				resolveStateUrl(this, url, "replaceState")
			);
			dispatchNavigate(this);
		}
	});
}
