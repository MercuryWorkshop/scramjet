import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
import type * as ScramjetControllerGlobal from "@mercuryworkshop/scramjet-controller";
declare global {
	interface Window {
		$scramjet: typeof ScramjetGlobal;
		$scramjetController: typeof ScramjetControllerGlobal;
	}
}
