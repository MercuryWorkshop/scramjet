import { ScramjetConfig } from "./types";

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
