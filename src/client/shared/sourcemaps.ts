import { $scramjet, flagEnabled } from "../../scramjet";
import { ScramjetClient } from "../client";

enum RewriteType {
	Insert = 0,
	Replace = 1,
}

type Rewrite =
	| {
			type: RewriteType.Insert;
			// offset before this rewrite
			offset: number;
			// start of insertion
			start: number;
			// size of insertion
			size: number;
	  }
	| {
			type: RewriteType.Replace;
			// offset before this rewrite
			offset: number;
			// start of replacement
			start: number;
			// end of replacement
			end: number;
			// old string
			str: string;
	  };

const sourcemaps: Record<string, Rewrite[]> = {};

export const enabled = (client: ScramjetClient) =>
	flagEnabled("sourcemaps", client.url);

export default function (client: ScramjetClient, self: Self) {
	// every script will push a sourcemap
	Object.defineProperty(self, $scramjet.config.globals.pushsourcemapfn, {
		value: (buf: Array<number>, tag: string) => {
			const sourcemap = Uint8Array.from(buf);
			const view = new DataView(sourcemap.buffer);
			const decoder = new TextDecoder("utf-8");

			const rewrites = [];

			const rewritelen = view.getUint32(0, true);
			let cursor = 0;
			for (let i = 0; i < rewritelen; i++) {
				const type = view.getUint8(cursor) as RewriteType;
				cursor += 1;

				if (type == RewriteType.Insert) {
					const offset = view.getUint32(cursor, true);
					cursor += 4;
					const start = view.getUint32(cursor, true);
					cursor += 4;
					const size = view.getUint32(cursor, true);
					cursor += 4;

					rewrites.push({ type, offset, start, size });
				} else if (type == RewriteType.Replace) {
					const offset = view.getUint32(cursor, true);
					cursor += 4;
					const start = view.getUint32(cursor, true);
					cursor += 4;
					const end = view.getUint32(cursor, true);
					cursor += 4;

					const str = decoder.decode(sourcemap.subarray(start, end));

					rewrites.push({ type, offset, start, end, str });
				}
			}

			sourcemaps[tag] = rewrites;
		},
		enumerable: false,
		writable: false,
		configurable: false,
	});

	const scramtag_ident = "/*scramtag ";

	// when we rewrite javascript it will make function.toString leak internals
	// this can lead to double rewrites which is bad
	client.Proxy("Function.prototype.toString", {
		apply(ctx) {
			let stringified: string = ctx.fn.call(ctx.this);
			let newString = "";

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

			const scramtagend = stringified.indexOf("*/", scramtagstart);
			const tag = stringified.substring(firstspace + 1, scramtagend);

			// delete all scramtags inside the function (and nested ones!!)
			stringified = stringified.replace(/\/\*scramtag.*?\*\//g, "");

			const maps = sourcemaps[tag];

			let i = 0;
			let offset = 0;

			let j = 0;
			while (j < maps.length) {
				/* TODO
				const [str, start, end] = maps[j];
				if (start < absindex) {
					j++;
					continue;
				}
				if (start - absindex + offset > stringified.length) break;

				// ooh i should really document this before i forget how it works
				newString += stringified.slice(i, start - absindex + offset);
				newString += str;
				offset += end - start - str.length;
				i = start - absindex + offset + str.length;

				j++;
				*/
			}

			newString += stringified.slice(i);

			return ctx.return(newString);
		},
	});
}
