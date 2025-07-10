declare const scramjetPath: string;

import * as controller from "../dist/types/controller/index.ts";
import * as types from "../dist/types/types.ts";
import * as frame from "../dist/types/controller/frame.ts";

declare global {
	const ScramjetController: typeof controller.ScramjetController;
	const ScramjetFrame: typeof frame.ScramjetFrame;

	type ScramjetConfig = types.ScramjetConfig;
	type ScramjetInitConfig = types.ScramjetInitConfig;
}
export { scramjetPath };
