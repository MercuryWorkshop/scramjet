import { config, flagEnabled } from "@/shared";
import { SCRAMJETCLIENT, SCRAMJETCLIENTNAME } from "@/symbols";
import { ProxyCtx, ScramjetClient } from "@client/index";

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

function registerRewrites(
	client: ScramjetClient,
	buf: Array<number>,
	tag: string
) {
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

	client.box.sourcemaps[tag] = rewrites;
}

const SCRAMTAG = "/*scramtag ";

function extractTag(fn: string): [string, number, number] | null {
	// every function rewritten will have a scramtag comment
	// it will look like this:
	// function name()[possible whitespace]/*scramtag [index] [tag]*/[possible whitespace]{ ... }

	let start = fn.indexOf(SCRAMTAG);
	// no scramtag, probably native function or stolen from scramjet
	if (start === -1) return null;

	const end = fn.indexOf("*/", start);
	if (end === -1) {
		console.log(fn, start, end);
		throw new Error("unreachable");
	}

	let tag = fn.substring(start + 2, end).split(" ");

	if (
		tag.length !== 3 ||
		tag[0] !== "scramtag" ||
		!Number.isSafeInteger(+tag[1])
	) {
		console.log(fn, start, end, tag);
		throw new Error("invalid tag");
	}

	return [tag[2], start, +tag[1]];
}

function doUnrewrite(client: ScramjetClient, ctx: ProxyCtx) {
	const stringified: string = ctx.fn.call(ctx.this);

	const extracted = extractTag(stringified);
	if (!extracted) return ctx.return(stringified);
	const [tag, tagOffset, tagStart] = extracted;

	const fnStart = tagStart - tagOffset;
	const fnEnd = fnStart + stringified.length;
	const rewrites = client.box.sourcemaps[tag];

	if (!rewrites) {
		console.warn("failed to get rewrites for tag", tag);

		return ctx.return(stringified);
	}

	let i = 0;
	// skip all rewrites in the file before the fn
	while (i < rewrites.length) {
		if (rewrites[i].start < fnStart) i++;
		else break;
	}

	let end = i;
	while (end < rewrites.length) {
		if (getEnd(rewrites[end]) < fnEnd) end++;
		else break;
	}
	const fnrewrites = rewrites.slice(i, end);

	let newString = "";
	let lastpos = 0;

	for (const rewrite of fnrewrites) {
		newString += stringified.slice(lastpos, rewrite.start - fnStart);

		if (rewrite.type === RewriteType.Insert) {
			lastpos = rewrite.start + rewrite.size - fnStart;
		} else if (rewrite.type === RewriteType.Replace) {
			newString += rewrite.str;
			lastpos = rewrite.end - fnStart;
		} else {
			throw "unreachable";
		}
	}

	newString += stringified.slice(lastpos);
	newString = newString.replace(`${SCRAMTAG}${tagStart} ${tag}*/`, "");

	return ctx.return(newString);
}

export const enabled = (client: ScramjetClient) =>
	flagEnabled("sourcemaps", client.url);

export default function (client: ScramjetClient, self: Self) {
	// every script will push a sourcemap
	Object.defineProperty(self, config.globals.pushsourcemapfn, {
		value: (buf: Array<number>, tag: string) => {
			const before = performance.now();
			registerRewrites(client, buf, tag);
			dbg.time(client.meta, before, `scramtag parse for ${tag}`);
		},
		enumerable: false,
		writable: false,
		configurable: false,
	});

	// when we rewrite javascript it will make function.toString leak internals
	// this can lead to double rewrites which is bad
	client.Proxy("Function.prototype.toString", {
		apply(ctx) {
			const before = performance.now();
			doUnrewrite(client, ctx);
			// dbg.time(client.meta, before, `scramtag unrewrite for ${ctx.fn.name}`);
		},
	});
}
