import { flagEnabled } from "../../scramjet";
import { ScramjetClient } from "../client";

type Mapping = [string, number, number];

const sourcemaps: Record<string, Mapping[]> = {};

export const enabled = (client: ScramjetClient) =>
	flagEnabled("sourcemaps", client.url);

export default function (client: ScramjetClient, self: Self) {
	// every script will push a sourcemap
	Object.defineProperty(self, "$scramjet$pushsourcemap", {
		value: (maps: Mapping[], tag: string) => {
			sourcemaps[tag] = maps;
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
			}

			newString += stringified.slice(i);

			return ctx.return(newString);
		},
	});
}
