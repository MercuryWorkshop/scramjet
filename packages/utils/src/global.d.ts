import type * as ScramjetController from "@mercuryworkshop/scramjet-controller";

declare global {
	const $scramjet: typeof import("@mercuryworkshop/scramjet");
	const $scramjetController: typeof ScramjetController;
}

export {};
