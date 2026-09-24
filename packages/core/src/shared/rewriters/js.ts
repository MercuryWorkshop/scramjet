import { flagEnabled, flagsUrl, ScramjetContext } from "@/shared";
import { URLMeta } from "@rewriters/url";

import { getRewriter, JsRewriterOutput } from "@rewriters/wasm";
import {
	TextDecoder_decode,
	Crypto_getRandomValues,
	_Uint8Array,
	Object_keys,
	Performance_now,
} from "../snapshot";
import { incumbencyMode } from "@/shared/incumbency";
import type { ScramjetClient } from "@client/index";
import { registerRewrites } from "@client/shared/sourcemaps";

// eslint-disable-next-line scramjet-core/no-globals
Error.stackTraceLimit = 50;

/** A private PST registration ID, generated independently for each rewrite. */
const SCRIPT_ID_BYTES = 16;
const HEX = "0123456789abcdef";

function genScriptId(): string {
	const bytes = Crypto_getRandomValues(new _Uint8Array(SCRIPT_ID_BYTES));
	let id = "";
	for (let i = 0; i < SCRIPT_ID_BYTES; i++) {
		id += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0xf];
	}
	return id;
}

type RewriterResult = {
	js: string | Uint8Array;
	map: Uint8Array | null;
	tag: string;
	errors: string[];
};
function rewriteJsWasm(
	input: string | Uint8Array,
	source: string | null,
	context: ScramjetContext,
	meta: URLMeta,
	isModule: boolean,
	inlineSourcemap: boolean
): RewriterResult {
	const [rewriter, ret] = getRewriter(context, meta);

	const flagsobj = {};
	for (const flag of Object_keys(context.config.flags)) {
		flagsobj[flag] = flagEnabled(flag as any, context, flagsUrl(meta));
	}
	// the one flag that is not a boolean, and the rewriter wants the mode this
	// engine can actually do rather than the one that was configured
	flagsobj["incumbency"] = incumbencyMode(context, flagsUrl(meta));
	flagsobj["inlineSourcemap"] = inlineSourcemap;
	flagsobj["scriptId"] = genScriptId();

	try {
		let out: JsRewriterOutput;
		const before = Performance_now();
		const globals = {
			...context.config.globals,
			prefix: context.prefix.pathname,
		};
		if (typeof input === "string") {
			out = rewriter.rewrite_js(
				globals,
				flagsobj,
				context.interface.codecEncode,
				input,
				meta.base.href,
				source || "(unknown)",
				isModule
			);
		} else {
			out = rewriter.rewrite_js_bytes(
				globals,
				flagsobj,
				context.interface.codecEncode,
				input,
				meta.base.href,
				source || "(unknown)",
				isModule
			);
		}
		if (flagEnabled("rewriterLogs", context, flagsUrl(meta))) {
			dbg.time(meta, before, `oxc rewrite for "${source || "(unknown)"}"`);
		}

		const { js, map, scramtag, errors } = out;

		return {
			js: typeof input === "string" ? TextDecoder_decode(js) : js,
			tag: scramtag,
			map,
			errors,
		};
	} finally {
		ret();
	}
}

export function rewriteJsInner(
	js: string | Uint8Array,
	url: string | null,
	context: ScramjetContext,
	meta: URLMeta,
	isModule = false
) {
	return rewriteJsWasm(js, url, context, meta, isModule, true);
}

export function rewriteJs(
	js: string | Uint8Array,
	url: string | null,
	context: ScramjetContext,
	meta: URLMeta,
	isModule = false,
	/**
	 * The client rewriting the script, when a client is. It is handed the
	 * sourcemap directly. Without one - the service worker, or code shared
	 * with it - the map goes in the script's prelude, and the script hands it
	 * to its client itself when it runs.
	 */
	client?: ScramjetClient
): string | Uint8Array {
	try {
		const res = rewriteJsWasm(js, url, context, meta, isModule, !client);

		if (client && flagEnabled("sourcemaps", context, flagsUrl(meta))) {
			registerRewrites(client, res.map, res.tag);
		}

		if (flagEnabled("rewriterLogs", context, flagsUrl(meta))) {
			for (const error of res.errors) {
				dbg.error("oxc parse error", error);
			}
		}

		return res.js;
	} catch (err) {
		dbg.warn(
			"failed rewriting js for",
			url || "(unknown)",
			err.message,
			typeof js !== "string" ? TextDecoder_decode(js) : js
		);
		if (flagEnabled("allowInvalidJs", context, flagsUrl(meta))) {
			return js;
		} else {
			throw err;
		}
	}
}
