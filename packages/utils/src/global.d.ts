import type * as AkController from "@mercuryworkshop/scramjet-controller";

declare global {
	const $ak: typeof import("@mercuryworkshop/scramjet");
	const $akController: typeof AkController;
}

export {};
