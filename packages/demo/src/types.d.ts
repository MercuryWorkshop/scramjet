import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
import type * as ScramjetControllerGlobal from "@mercuryworkshop/scramjet-controller";
declare global {
	const $scramjet: typeof ScramjetGlobal;
	const $scramjetController: typeof ScramjetControllerGlobal;
}
