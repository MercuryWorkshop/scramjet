import { flagEnabled } from "../../scramjet";
import { SCRAMJETCLIENT, SCRAMJETCLIENTNAME } from "../../symbols";
import { ProxyCtx, ScramjetClient } from "../client";

enum RewriteType {
	Insert = 0,
	Replace = 1,
}

type Rewrite = {
	start: number;
} & (
	| {
			type: RewriteType.Insert;
			size: number;
	  }
	| {
			type: RewriteType.Replace;
			end: number;
			str: string;
	  }
);

export type SourceMaps = Record<string, Rewrite[]>;

function getEnd(rewrite: Rewrite): number {
	if (rewrite.type === RewriteType.Insert) {
		return rewrite.start + rewrite.size;
	} else if (rewrite.type === RewriteType.Replace) {
		return rewrite.end;
	}
	throw "unreachable";
}

const scramtag_ident = "/*scramtag ";

// some sites like to steal funcs from frames and then unrewrite them
function searchRewrites(tag: string): Rewrite[] | undefined {
	function searchFrame(globalThis: Self) {
		const SCRAMJETCLIENT = globalThis.Symbol.for(SCRAMJETCLIENTNAME);
		if (
			globalThis[SCRAMJETCLIENT] &&
			globalThis[SCRAMJETCLIENT].sourcemaps &&
			globalThis[SCRAMJETCLIENT].sourcemaps[tag]
		)
			return globalThis[SCRAMJETCLIENT].sourcemaps[tag];

		// no enhanced for :frowning2:
		for (let i = 0; i < globalThis.frames.length; i++) {
			const rewrites = searchFrame(globalThis.frames[i].self);
			if (rewrites) return rewrites;
		}
	}

	let globalThis = self;
	let rewrites = searchFrame(globalThis);
	if (rewrites) return rewrites;
	while (globalThis.parent && globalThis.parent !== globalThis.window) {
		globalThis = globalThis.parent.self;
		let rewrites = searchFrame(globalThis);
		if (rewrites) return rewrites;
	}
}

function registerRewrites(buf: Array<number>, tag: string) {
	const sourcemap = Uint8Array.from(buf);
	const view = new DataView(sourcemap.buffer);
	const decoder = new TextDecoder("utf-8");

	const rewrites: Rewrite[] = [];

	const rewritelen = view.getUint32(0, true);
	let cursor = 4;
	for (let i = 0; i < rewritelen; i++) {
		const start = view.getUint32(cursor, true);
		cursor += 4;
		const size = view.getUint32(cursor, true);
		cursor += 4;

		const type = view.getUint8(cursor) as RewriteType;
		cursor += 1;

		if (type == RewriteType.Insert) {
			rewrites.push({ type, start, size });
		} else if (type == RewriteType.Replace) {
			const end = start + size;

			const oldLen = view.getUint32(cursor, true);
			cursor += 4;

			const oldStr = decoder.decode(
				sourcemap.subarray(cursor, cursor + oldLen)
			);

			rewrites.push({ type, start, end, str: oldStr });
		}
	}

	self[SCRAMJETCLIENT].sourcemaps[tag] = rewrites;
}

function doUnrewrite(ctx: ProxyCtx) {
	let stringified: string = ctx.fn.call(ctx.this);

	// every function rewritten will have a scramtag comment
	// it will look like this:
	// function name() /*scramtag [index] [tag] */ { ... }
	const scramtagstart = stringified.indexOf("/*s");

	if (scramtagstart === -1) return ctx.return(stringified); // it's either a native function or something stolen from scramjet itself

	const firstspace = stringified.indexOf(
		" ",
		scramtagstart + scramtag_ident.length
	);
	// [index] holds the index of the first character in the scramtag (/)
	const abstagindex = parseInt(
		stringified.substring(scramtagstart + scramtag_ident.length, firstspace)
	);

	// subtracting that from the index of the scramtag gives us the starting index of the function relative to the entire file
	const absindex = abstagindex - scramtagstart;
	const endindex = absindex + stringified.length;

	const scramtagend = stringified.indexOf("*/", scramtagstart);
	const tag = stringified.substring(firstspace + 1, scramtagend);

	const rewrites = searchRewrites(tag);

	if (!rewrites) {
		console.warn("failed to get rewrites for tag", tag);

		return ctx.return(stringified);
	}

	let i = 0;
	// skip all rewrites in the file before the fn
	while (i < rewrites.length) {
		if (rewrites[i].start < absindex) i++;
		else break;
	}

	let end = i;
	while (end < rewrites.length) {
		if (getEnd(rewrites[end]) < endindex) end++;
		else break;
	}

	const fnrewrites = rewrites.slice(i, end);

	let newString = "";
	let lastpos = absindex;

	for (const rewrite of fnrewrites) {
		newString += stringified.slice(lastpos, rewrite.start);

		if (rewrite.type === RewriteType.Insert) {
			lastpos = rewrite.start + rewrite.size;
		} else if (rewrite.type === RewriteType.Replace) {
			newString += rewrite.str;
			lastpos = rewrite.end;
		} else {
			throw "unreachable";
		}
	}

	newString += stringified.slice(lastpos);

	return ctx.return(newString);
}

export const enabled = (client: ScramjetClient) =>
	flagEnabled("sourcemaps", client.url);

export default function (client: ScramjetClient, self: Self) {
	// every script will push a sourcemap
	Object.defineProperty(
		self,
		globalThis.$scramjet.config.globals.pushsourcemapfn,
		{
			value: (buf: Array<number>, tag: string) => {
				const before = performance.now();
				registerRewrites(buf, tag);
				const after = performance.now();

				const duration = after - before;

				if (flagEnabled("rewriterLogs", new URL(location.href))) {
					let timespan: string;
					if (duration < 1) {
						timespan = "BLAZINGLY FAST";
					} else if (duration < 500) {
						timespan = "decent speed";
					} else {
						timespan = "really slow";
					}
					console.log(
						`js rewrite parsing for scramtag ${tag} was ${timespan} (${duration.toFixed(2)}ms)`
					);
				}
			},
			enumerable: false,
			writable: false,
			configurable: false,
		}
	);

	// when we rewrite javascript it will make function.toString leak internals
	// this can lead to double rewrites which is bad
	client.Proxy("Function.prototype.toString", {
		apply(ctx) {
			const before = performance.now();
			doUnrewrite(ctx);
			const after = performance.now();

			const duration = after - before;

			if (flagEnabled("rewriterLogs", new URL(location.href))) {
				let timespan: string;
				if (duration < 1) {
					timespan = "BLAZINGLY FAST";
				} else if (duration < 500) {
					timespan = "decent speed";
				} else {
					timespan = "really slow";
				}
				console.log(
					`js unrewrite for function was ${timespan} (${duration.toFixed(2)}ms)`
				);
			}
		},
	});
}
