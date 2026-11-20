import type { ScramjetClient } from "@client/index";
import { Reflect_apply, String } from "@/shared/snapshot";
import { policiesFor } from "@client/csp";

type TrustedType = "TrustedHTML" | "TrustedScript" | "TrustedScriptURL";

function required(client: ScramjetClient): boolean {
	return policiesFor(client).some((policy) =>
		policy.get("require-trusted-types-for")?.includes("'script'")
	);
}

export function nodeClient(client: ScramjetClient, node: Node): ScramjetClient {
	const document = new client.native.Node(node).ownerDocument;
	return client.box.documents.get(document) ?? client;
}

export function isTrustedScript(
	client: ScramjetClient,
	value: unknown
): boolean {
	const factory = new client.native.window(client.global).trustedTypes;
	return (
		!!factory &&
		new client.native.TrustedTypePolicyFactory(factory).isScript(value)
	);
}

export function trustedEvalString(
	client: ScramjetClient,
	value: unknown
): string {
	// CSP's string-compilation check rejects a policy that changes the source,
	// and converts callback failures to EvalError rather than leaking them.
	// https://w3c.github.io/webappsec-csp/#can-compile-strings
	try {
		const source = trustedString(client, value, "TrustedScript", "eval");
		if (typeof value !== "string" || source === value) return source;
	} catch {}
	const global = new client.native.window(client.global);
	throw new global.EvalError(
		"Evaluating a string as JavaScript violates this document's Trusted Type assignment requirements."
	);
}

/** Validate the original input BEFORE rewriting; callbacks must never see proxy code. */
export function trustedString(
	client: ScramjetClient,
	value: unknown,
	type: TrustedType,
	sink: string
): string {
	const global = new client.native.window(client.global);
	const factory = global.trustedTypes;
	if (factory) {
		const native = new client.native.TrustedTypePolicyFactory(factory);
		const isTrusted =
			type === "TrustedHTML"
				? native.isHTML(value)
				: type === "TrustedScript"
					? native.isScript(value)
					: native.isScriptURL(value);
		if (isTrusted) return new client.native[type](value).toString();
	}
	if (typeof value === "symbol")
		throw new global.TypeError("Cannot convert a Symbol value to a string");
	const input = String(value);
	if (!factory || !required(client)) return input;

	// https://w3c.github.io/trusted-types/dist/spec/#get-trusted-type-compliant-string
	// Calling public policy.createHTML is NOT equivalent: it turns null into "",
	// whereas a null default-policy result must reject the original sink write.
	const policy = new client.native.TrustedTypePolicyFactory(factory)
		.defaultPolicy;
	const callback =
		policy &&
		client.box.trustedTypeCallbacks.get(policy)?.[
			type === "TrustedHTML"
				? "createHTML"
				: type === "TrustedScript"
					? "createScript"
					: "createScriptURL"
		];
	if (typeof callback === "function") {
		const result = Reflect_apply(callback, undefined, [input, type, sink]);
		if (result !== null && result !== undefined) {
			if (typeof result === "symbol")
				throw new global.TypeError("Cannot convert a Symbol value to a string");
			return String(result);
		}
	}
	throw new global.TypeError(`This document requires '${type}' assignment.`);
}
