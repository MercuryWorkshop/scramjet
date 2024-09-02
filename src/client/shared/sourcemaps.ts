import { ScramjetClient } from "../client";

type Mapping = [string, number, number];

const sourcemaps: Record<string, Mapping[]> = {};

export const enabled = () => self.$scramjet.config.flags.sourcemaps;

let t = 0;
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

	// when we rewrite javascript it will make function.toString leak internals
	// this can lead to double rewrites which is bad
	client.Proxy("Function.prototype.toString", {
		apply(ctx) {
			let stringified: string = ctx.fn.call(ctx.this);
			let newString = "";

			// every function rewritten will have a scramtag comment
			// it will look like this:
			// function name() /*scramtag [index] [tag] */ { ... }
			const scramtag_ident = "/*scramtag ";
			const scramtagstart = stringified.indexOf(scramtag_ident);

			if (scramtagstart === -1) return ctx.return(stringified); // it's either a native function or something stolen from scramjet itself

			// [index] holds the index of the first character in the scramtag (/)
			const abstagindex = parseInt(
				stringified
					.substring(scramtagstart + scramtag_ident.length)
					.split(" ")[0]
			);

			// subtracting that from the index of the scramtag gives us the starting index of the function relative to the entire file
			let absindex = abstagindex - scramtagstart;

			const scramtagend = stringified.indexOf("*/", scramtagstart);
			const tag = stringified
				.substring(scramtagstart + scramtag_ident.length, scramtagend)
				.split(" ")[1];

			// delete all scramtags inside the function (and nested ones!!)
			stringified = stringified.replace(/\/\*scramtag.*?\*\//g, "");

			const maps = sourcemaps[tag];

			const relevantRewrites = maps.filter(
				([str, start, end]) =>
					start >= absindex && end <= absindex + stringified.length
			);

			let i = 0;
			let offset = 0;
			for (const [str, start, end] of relevantRewrites) {
				// ooh i should really document this before i forget how it works
				newString += stringified.slice(i, start - absindex + offset);
				newString += str;
				offset += end - start - str.length;
				i = start - absindex + offset + str.length;
			}

			return ctx.return(newString + stringified.slice(i));
		},
	});
}
