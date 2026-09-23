import { IncrementalHtmlRewriter, rewriteHtml } from "@rewriters/html";
import { rewriteBlob } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
import {
	Array_join,
	String,
	String_endsWith,
	String_startsWith,
	String_toLowerCase,
	_URL,
} from "@/shared/snapshot";
import { createReferrerString } from "@/fetch/util";
import { openWindowSteps } from "@client/helpers";
import { Arguments, Returns, Type } from "@client/webidl";
import { rewriteAttributeSelectors } from "@client/selectors";

export default function (client: ScramjetClient, self: Self) {
	const nativeGlobal = new client.native.window(self);

	function resetDocumentWriter(document: Document) {
		client.box.writeRewriters.delete(document);
	}

	function getDocumentWriter(document: Document) {
		let writer = client.box.writeRewriters.get(document);
		if (!writer) {
			writer = new IncrementalHtmlRewriter(client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "Document.prototype.write",
			});
			client.box.writeRewriters.set(document, writer);
		}

		return writer;
	}

	// https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html
	client.Intercept(class extends Document {
		@Arguments("optional USVString", "optional DOMString", "optional DOMString")
		@Returns("Document")
		open(...args: any[]): any {
			// a 3 argument document.open is not the same thing as document.open at all, it instead dispatches to the open window steps
			if (args.length >= 3) {
				// the steps below never touch the receiver, so brand check now
				void super.URL;

				return openWindowSteps(
					client,
					nativeGlobal.open,
					args[0],
					args[1],
					args[2]
				) as unknown as Document;
			}

			resetDocumentWriter(this);

			return super.open(args[0], args[1]);
		}

		@Arguments("(TrustedHTML or DOMString)...")
		@Returns("undefined")
		write(...text: string[]): void {
			super.write(getDocumentWriter(this).write(Array_join(text, "")));
		}

		@Arguments("(TrustedHTML or DOMString)...")
		@Returns("undefined")
		writeln(...text: string[]): void {
			super.write(getDocumentWriter(this).write(Array_join(text, "") + "\n"));
		}

		@Arguments("DOMString", "optional boolean", "optional DOMString")
		@Returns("boolean")
		execCommand(commandId: string, showUI?: boolean, value?: string): boolean {
			if (String_toLowerCase(String(commandId)) !== "inserttext") {
				return super.execCommand(commandId, showUI, value);
			}

			const selection = nativeGlobal.getSelection();
			if (!selection || selection.rangeCount === 0) {
				return super.execCommand(commandId, showUI, value);
			}

			const range = selection.getRangeAt(0);
			const parent = range.startContainer;
			if (
				!range.collapsed ||
				new client.native.Node(parent).nodeType !== 1 ||
				client.text.kind(parent as Element) !== "script"
			) {
				return super.execCommand(commandId, showUI, value);
			}

			const children = new client.native.Node(parent).childNodes;
			const reference = children.item(range.startOffset);
			const inserted = client.text.insertText(
				parent,
				reference,
				String(value ?? "")
			);
			selection.collapse(inserted, inserted.length);

			return true;
		}

		@Arguments()
		@Returns("undefined")
		close(): void {
			const writer = client.box.writeRewriters.get(this);

			if (!writer) return super.close();

			try {
				const remaining = writer.end();
				if (remaining) super.write(remaining);
			} finally {
				resetDocumentWriter(this);
			}

			return super.close();
		}

		@Arguments("(TrustedHTML or DOMString)", "optional SetHTMLUnsafeOptions")
		@Returns("Document")
		static parseHTMLUnsafe(html: string, options?: object): Document {
			const rewritten = rewriteHtml(String(html), client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "Document.parseHTMLUnsafe",
			});

			// forwarded rather than dropped: the declaration named one argument
			// and the body passed one, so a page handing over a sanitizer got
			// an unsanitized document back and no error to say so. lib.dom
			// still types this as single-argument, hence the cast - `super.f`
			// is read and then `.call`ed so the receiver survives it
			return (
				super.parseHTMLUnsafe as (h: string, o?: object) => Document
			).call(this, rewritten, options);
		}
	});

	/**
	 * A document's URL as the site should see it. Only a URL that is actually
	 * the proxy's gets replaced - anything else the native reports (about:blank
	 * for a document with no browsing context) is already correct.
	 */
	const siteUrlFor = (url: string) => {
		if (String_startsWith(url, client.context.prefix.href)) {
			return client.url.href;
		}

		// a blob URL never carries the prefix, so the check above cannot see
		// one, and the origin in it is the *proxy's*. `rewriteBlob` is the same
		// mapping `URL.createObjectURL` already applies before handing a blob
		// URL to the page, so this answers with the one the site was given
		if (String_startsWith(url, `blob:${client.context.prefix.origin}/`)) {
			return rewriteBlob(url, client.context, client.meta);
		}

		return url;
	};

	client.Intercept(class extends Document {
		/**
		 * https://html.spec.whatwg.org/multipage/browsers.html#dom-document-domain
		 *
		 * `siteOrigin`, not `scopeOrigin`: an opaque origin has no effective
		 * domain and the getter answers the empty string. `scopeOrigin` would
		 * have handed over part of the storage bucket key it makes up for such
		 * a document - `about-opaque://<random>` - which is neither a host nor
		 * stable across a reload.
		 */
		@Type("USVString")
		get domain(): string {
			void super.domain;

			const origin = client.siteOrigin;
			if (origin === null || origin === "null") return "";

			return new _URL(origin).hostname;
		}

		@Type("USVString")
		set domain(value: string) {
			void super.domain;

			// https://html.spec.whatwg.org/multipage/browsers.html#relaxing-the-same-origin-restriction
			const origin = client.siteOrigin;

			// step 3: a document on an opaque origin cannot relax it at all,
			// whatever it was handed. Falling through to the suffix test below
			// would have compared against the opaque bucket key and put it in
			// the error message
			if (origin === null || origin === "null") {
				throw client.errors.domException("SecurityError", {
					set: "domain",
					on: "Document",
					detail: "Assignment is forbidden for sandboxed iframes.",
				});
			}

			// step 6, checked against the site's host rather than the proxy's
			const host = String_toLowerCase(new _URL(origin).hostname);
			const domain = String_toLowerCase(value);
			if (domain !== host && !String_endsWith(host, `.${domain}`)) {
				throw client.errors.domException("SecurityError", {
					set: "domain",
					on: "Document",
					detail: `'${value}' is not a suffix of '${host}'.`,
				});
			}

			// a suffix match is accepted and then dropped on the floor.
			// actually relaxing the document's origin would relax the
			// *proxy's*, which is shared by every site being proxied - one
			// site could then reach into another's documents.
			// TODO: the check above is a plain suffix test, so it accepts a
			// public suffix ("com" for "example.com") that a browser rejects.
			// only observable in whether this throws, since nothing is
			// relaxed either way
		}

		@Type("USVString")
		get documentURI(): string {
			return siteUrlFor(super.documentURI);
		}

		@Type("USVString")
		get URL(): string {
			return siteUrlFor(super.URL);
		}

		@Type("USVString")
		get referrer(): string {
			// a document with no browsing context has no referrer, whatever the
			// live one's history says
			if (!super.defaultView) return "";

			if (!client.history) return "";
			if (client.history.length < 2) return "";
			const lastState = client.history[client.history.length - 2];
			const referrerURL = new _URL(lastState.url);

			return createReferrerString(
				referrerURL,
				client.url,
				lastState.refererPolicy
			);
		}
	});

	client.Intercept(class extends Document {
		@Arguments("DOMString")
		@Returns("Element?")
		querySelector(selectors: string): Element | null {
			const result = super.querySelector(selectors);
			const rewritten = rewriteAttributeSelectors(selectors);

			return rewritten === null ? result : super.querySelector(rewritten);
		}

		@Arguments("DOMString")
		@Returns("NodeList")
		querySelectorAll(selectors: string): NodeListOf<Element> {
			const result = super.querySelectorAll(selectors);
			const rewritten = rewriteAttributeSelectors(selectors);

			return rewritten === null ? result : super.querySelectorAll(rewritten);
		}
	});
}
