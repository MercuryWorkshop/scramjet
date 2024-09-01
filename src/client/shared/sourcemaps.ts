import { ScramjetClient } from "../client";

let sourcemaps: {
	source: string;
	map: [string, number, number][];
}[] = [];

export const enabled = () => self.$scramjet.config.flags.sourcemaps;

export default function (client: ScramjetClient, self: Self) {
	// every script will push a sourcemap
	Object.defineProperty(self, "$scramjet$pushsourcemap", {
		value: (map, source) => {
			sourcemaps.push({ map, source });
		},
		enumerable: false,
		writable: false,
		configurable: false,
	});

	// when we rewrite javascript it will make function.toString leak internals
	// this can lead to double rewrites which is bad
	client.Proxy("Function.prototype.toString", {
		apply(ctx) {
			const stringified = ctx.fn.call(ctx.this);
			let newString = "";

			// find the sourcemap, brute force, just check every file until the body of the function shows up
			// it doesnt matter if there's multiple with the same content because it will be the same function
			const sourcemap = sourcemaps.find(({ source }) =>
				source.includes(stringified)
			);

			// i don't know what cases this would happen under, but it does
			if (!sourcemap) return ctx.return(stringified);
			const { source, map } = sourcemap;

			// first we need to find the character # where the function starts relative to the *transformed* source
			let starting = source.indexOf(stringified);

			const beforeFunctionRewrites = map.filter(
				([str, start, end]) => start < starting
			);

			// map the offsets of the original source to the transformed source
			for (const [str, start, end] of beforeFunctionRewrites) {
				starting -= end - start - str.length;
			}

			const relevantRewrites = map.filter(
				([str, start, end]) =>
					start >= starting && end <= starting + stringified.length
			);

			let i = 0;
			let offset = 0;
			for (const [str, start, end] of relevantRewrites) {
				// ooh i should really document this before i forget how it works
				newString += stringified.slice(i, start - starting + offset);
				newString += str;
				offset += end - start - str.length;
				i = start - starting + offset + str.length;
			}
			return ctx.return(newString + stringified.slice(i));
		},
	});
}
