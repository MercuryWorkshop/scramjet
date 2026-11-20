import type { ScramjetClient } from "@client/index";
import {
	_Map as Map,
	_WeakSet as WeakSet,
	String_replace,
	String_split,
	drain,
} from "@/shared/snapshot";

type Policy = Map<string, string[]>;
export type CspState = { policies: Policy[]; flush: () => void };

function parse(value: string): Policy {
	const policy: Policy = new Map();
	for (const directive of drain(String_split(value, ";"))) {
		const parts = String_split(
			String_replace(directive, /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, ""),
			/[\t\n\f\r ]+/
		);
		const values: string[] = [];
		for (let i = 1; i < parts.length; i++) values[i - 1] = parts[i];
		const key = parts[0].toLowerCase();
		if (key && !policy.has(key)) policy.set(key, values);
	}
	return policy;
}

/** The enforced policy container; it survives removal of a delivering meta. */
export function initializeCsp(client: ScramjetClient): CspState {
	const existing = client.box.cspStates.get(client);
	if (existing) return existing;
	const state: CspState = {
		policies: (client.initHeaders?.get("content-security-policy") ?? "")
			.split(",")
			.map(parse),
		flush() {},
	};
	client.box.cspStates.set(client, state);
	if (!("window" in client.global)) return state;
	const global = new client.native.window(client.global);
	const document = global.document;
	if (!document) return state;
	const nDocument = new client.native.Document(document);
	if (nDocument.URL === "about:blank" || nDocument.URL === "about:srcdoc") {
		const creator =
			global.parent !== client.global ? global.parent : global.opener;
		const parent = creator && client.box.globals.get(creator);
		if (parent && parent !== client) {
			const inherited = policiesFor(parent);
			// Copy the container, not a live link: subsequent parent policies do
			// not change the initial document's policy container.
			const copy: Policy[] = [];
			for (let i = 0; i < inherited.length; i++) copy[i] = inherited[i];
			state.policies = copy;
		}
	}

	// https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-content-security-policy -
	// a policy meta counts once it is a child of the head, and keeps counting
	// after it is removed. Read when a policy is asked about, rather than
	// watched for: watching every insertion in every document costs every page
	// that never has one. A meta put in and taken out again between two checks
	// is missed
	const seen = new WeakSet<Element>();
	// and only read again once the head has changed: a meta is put in or
	// taken out at the end far more often than anywhere else
	let lastHead: Element | null = null;
	let lastCount = -1;
	let lastChild: Element | null = null;
	state.flush = () => {
		const head = nDocument.head;
		if (!head) return;
		const nHead = new client.native.Element(head);
		const count = nHead.childElementCount;
		const child = nHead.lastElementChild;
		if (head === lastHead && count === lastCount && child === lastChild) return;
		lastHead = head;
		lastCount = count;
		lastChild = child;
		const children = nHead.children;
		for (let i = 0; i < children.length; i++) {
			const element = new client.native.Element(children[i]);
			if (
				element.localName !== "meta" ||
				element.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
				seen.has(children[i])
			)
				continue;
			const equiv = element.getAttribute("http-equiv");
			if (equiv === null || equiv.toLowerCase() !== "content-security-policy")
				continue;
			const value =
				element.getAttribute("scramjet-attr-content") ??
				element.getAttribute("content");
			if (!value) continue;
			seen.add(children[i]);
			const policy = parse(value);
			policy.delete("report-uri");
			policy.delete("frame-ancestors");
			policy.delete("sandbox");
			state.policies.push(policy);
		}
	};

	return state;
}

export function policiesFor(client: ScramjetClient): Policy[] {
	const state = initializeCsp(client);
	state.flush();
	return state.policies;
}

export function assertEvalAllowed(client: ScramjetClient): void {
	// script-src-elem/attr do not control string compilation. Every enforced
	// policy must allow it, with default-src as the fallback for script-src.
	// https://w3c.github.io/webappsec-csp/#can-compile-strings
	const policies = policiesFor(client);
	const trustedRequired = policies.some((policy) =>
		policy.get("require-trusted-types-for")?.includes("'script'")
	);
	for (const policy of drain(policies)) {
		const sources = policy.get("script-src") ?? policy.get("default-src");
		if (
			trustedRequired &&
			sources?.some((value) => value.toLowerCase() === "'trusted-types-eval'")
		)
			continue;
		if (
			sources &&
			!sources.some((value) => value.toLowerCase() === "'unsafe-eval'")
		) {
			const global = new client.native.window(client.global);
			throw new global.EvalError(
				"Evaluating a string as JavaScript violates this document's Content Security Policy."
			);
		}
	}
}
