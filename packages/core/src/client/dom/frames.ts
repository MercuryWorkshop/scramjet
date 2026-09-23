/**
 * Nested browsing contexts: `contentWindow`, `contentDocument` and
 * `getSVGDocument`.
 *
 * All three hand the page a window or a document belonging to another realm,
 * and every one of them is a hook point - the child has to have a client
 * installed *before* the page can reach into it, because the first thing a page
 * does with a fresh iframe is steal globals out of it.
 *
 * https://html.spec.whatwg.org/multipage/iframe-embed-object.html
 */

import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import { SCRAMJETCLIENT } from "@/symbols";

export default function (client: ScramjetClient, self: Self) {
	/**
	 * The child's window, hooked on the way out.
	 *
	 * A cross-origin child - a frame pointing somewhere the proxy does not
	 * serve - throws on the `in` check, and there is nothing to install there
	 * anyway, so it is handed back as it is.
	 */
	const hook = (realwin: Window | null, frame: HTMLElement): Window | null => {
		if (!realwin) return realwin;

		try {
			if (!(SCRAMJETCLIENT in realwin)) {
				client.init.hookSubcontext(realwin as Self, frame as HTMLIFrameElement);
			}
		} catch {
			// cross-origin, so there is no reaching into it from here
		}

		return realwin;
	};

	/** The child's document, by way of its window, which is what carries the client. */
	const contentDocument = (
		realwin: Window | null,
		frame: HTMLElement,
		native: Document | null
	): Document | null => {
		if (!hook(realwin, frame)) return native;

		try {
			return realwin.document;
		} catch {
			return native;
		}
	};

	client.Intercept(class extends HTMLIFrameElement {
		@Type("WindowProxy?")
		get contentWindow(): Window | null {
			return hook(super.contentWindow, this);
		}

		@Type("Document?")
		get contentDocument(): Document | null {
			return contentDocument(super.contentWindow, this, super.contentDocument);
		}

		@Arguments()
		@Returns("Document?")
		getSVGDocument(): Document | null {
			// the native answers whether the child is an SVG document at all; the
			// document it hands back is the raw one, so the hooked one is returned
			// in its place
			if (!super.getSVGDocument()) return null;

			// through the same steps as the `contentDocument` getter above, not
			// through `this.contentDocument`, which the page can shadow
			return contentDocument(super.contentWindow, this, super.contentDocument);
		}
	});

	client.Intercept(class extends HTMLObjectElement {
		@Type("WindowProxy?")
		get contentWindow(): Window | null {
			return hook(super.contentWindow, this);
		}

		@Type("Document?")
		get contentDocument(): Document | null {
			return contentDocument(super.contentWindow, this, super.contentDocument);
		}

		@Arguments()
		@Returns("Document?")
		getSVGDocument(): Document | null {
			if (!super.getSVGDocument()) return null;

			// through the same steps as the `contentDocument` getter above, not
			// through `this.contentDocument`, which the page can shadow
			return contentDocument(super.contentWindow, this, super.contentDocument);
		}
	});

	// an embed has no contentWindow or contentDocument of its own - only the
	// SVG accessor, which reaches the same document
	client.Intercept(class extends HTMLEmbedElement {
		@Arguments()
		@Returns("Document?")
		getSVGDocument(): Document | null {
			const document = super.getSVGDocument();
			if (!document) return null;

			const view = document.defaultView;
			if (!view) return document;
			hook(view, this);

			return view.document;
		}
	});

	if ("HTMLFrameElement" in self) {
		client.Intercept(class extends HTMLFrameElement {
			@Type("WindowProxy?")
			get contentWindow(): Window | null {
				return hook(super.contentWindow, this);
			}

			@Type("Document?")
			get contentDocument(): Document | null {
				return contentDocument(
					super.contentWindow,
					this,
					super.contentDocument
				);
			}
		});
	}
}
