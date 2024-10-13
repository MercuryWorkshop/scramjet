import { ScramjetConfig, ScramjetFlags } from "./types";

if (!("$scramjet" in self)) {
	// @ts-expect-error ts stuff
	self.$scramjet = {
		version: {
			build: COMMITHASH,
			version: VERSION,
		},
		codec: {},
	};
}

export const $scramjet = self.$scramjet;

const nativeFunction = Function;
export function loadCodecs() {
	$scramjet.codec.encode = nativeFunction(
		"url",
		$scramjet.config.codec.encode
	) as any;
	$scramjet.codec.decode = nativeFunction(
		"url",
		$scramjet.config.codec.decode
	) as any;
}

export function flagEnabled(flag: keyof ScramjetFlags, url: URL): boolean {
	let value = $scramjet.config.defaultFlags[flag];
	for (const regex in $scramjet.config.siteFlags) {
		const partialflags = $scramjet.config.siteFlags[regex];
		if (new RegExp(regex).test(url.href) && "flag" in partialflags) {
			return partialflags[flag];
		}
	}

	return value;
}
