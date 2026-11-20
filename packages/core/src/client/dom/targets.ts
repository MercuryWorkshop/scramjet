/**
 * Navigation targets, settled as they are used.
 *
 * `_top` and `_parent` would leave the proxy from the emulated top-level, so
 * the attribute rule in `htmlRules.ts` rewrites them by where the document
 * sits in the frame tree. The client knows that. The service worker only
 * knows what a request carried, and a document it serves below the top often
 * carried nothing - a frame's markup, or a page a frame navigated to - so it
 * writes `_self`, which keeps the navigation in the frame.
 *
 * This puts the real target in place as a link is followed or a form is
 * submitted, from the value the page wrote, before the browser reads it.
 * Only the real attribute changes: the page goes on seeing its own value.
 */

import { ScramjetClient } from "@client/index";
import { Array_indexOf, String_toLowerCase } from "@/shared/snapshot";

const KEYWORDS = ["_top", "_parent", "_unfencedtop"];

const isKeyword = (value: string | null) =>
	value !== null && Array_indexOf(KEYWORDS, String_toLowerCase(value)) !== -1;

export default function (client: ScramjetClient, self: Self) {
	// in the top-level both keywords are the document itself. The service
	// worker already wrote `_self`; what a script wrote has the frame's real
	// name, which the page can since have changed, and a keyword can reach the
	// real attribute untouched - `target.baseVal` on an SVG link
	const isTop = client.topmostClient() === client;
	const raw = client.attributes.raw;

	/** Settle `element`'s target; whether it has one of its own. */
	const settle = (
		element: Element | null | undefined,
		name: string
	): boolean => {
		if (!element) return false;
		const value = client.attributes.get(element, name);
		// an empty target is none, and the base element's applies
		if (value === null || value === "") return false;
		if (!isKeyword(value)) return true;
		if (isTop) {
			if (raw.get(element, name) !== "_self") raw.set(element, name, "_self");

			return true;
		}

		const rewrite = client.attributes.rewriter(element, name);
		if (!rewrite) return true;

		const real = rewrite(value);
		if (real === null) {
			if (raw.has(element, name)) raw.remove(element, name);
		} else if (raw.get(element, name) !== real) {
			raw.set(element, name, real);
		}

		return true;
	};

	/** The document's base target, which a link or form without one uses. */
	const settleBase = (node: Node) => {
		const document = new client.native.Node(node).ownerDocument;
		if (!document) return;
		const bases = new client.native.Document(document).querySelectorAll(
			"base[target]"
		);
		for (let i = 0; i < bases.length; i++) settle(bases[i], "target");
	};

	/**
	 * The link a click on `node` follows: the nearest `a` or `area` around it,
	 * through the open shadow roots between them - a link around a custom
	 * element, clicked on what its shadow root renders.
	 */
	const linkAround = (node: EventTarget): Element | null => {
		for (let depth = 0; depth < 32; depth++) {
			try {
				const link = new client.native.Element(node).closest("a, area");
				if (link) return link;
				const nNode = new client.native.Node(node);
				const root = nNode.getRootNode();
				// the usual end: no shadow root around it
				if (root === nNode.ownerDocument) return null;
				node = new client.native.ShadowRoot(root).host;
			} catch {
				// not an element, or no shadow root around it
				return null;
			}
		}

		return null;
	};

	const listen = new client.native.EventTarget(self).addEventListener;

	// a link is followed after its click event is dispatched, whether the
	// click came from the user, the keyboard or `a.click()`
	listen(
		"click",
		(event: Event) => {
			const link = linkAround(new client.native.Event(event).composedPath()[0]);
			if (link && !settle(link, "target")) settleBase(link);
		},
		true
	);

	// and a form's target is chosen after its submit event
	listen(
		"submit",
		(event: Event) => {
			const form = new client.native.Event(event).target as Element;
			// all three: a submit listener of the page's can still take the
			// submitter's target away, or the form's
			settle(new client.native.SubmitEvent(event).submitter, "formtarget");
			settle(form, "target");
			settleBase(form);
		},
		true
	);

	// which `form.submit()` does not fire
	client.Proxy("HTMLFormElement.prototype.submit", {
		apply(ctx) {
			// eslint-disable-next-line scramjet-core/no-poisoned-ctx-value
			const form = ctx.this as Element;
			if (!settle(form, "target")) settleBase(form);
		},
	});
}
