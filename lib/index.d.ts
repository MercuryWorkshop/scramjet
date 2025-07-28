declare const scramjetPath: string;

import * as controller from "../dist/types/controller/index.ts";
import * as worker from "../dist/types/worker/index.ts";
import * as types from "../dist/types/types.ts";
import * as frame from "../dist/types/controller/frame.ts";
import { ScramjetClient as _ScramjetClient } from "../dist/types/client/index.ts";

declare global {
	function $scramjetLoadController(): typeof controller;
	function $scramjetLoadWorker(): typeof worker;
	function $scramjetLoadClient(config: ScramjetConfig);
	type ScramjetController = controller.ScramjetController;
	type ScramjetFrame = frame.ScramjetFrame;
	type ScramjetClient = _ScramjetClient;

	type ScramjetConfig = types.ScramjetConfig;
	type ScramjetInitConfig = types.ScramjetInitConfig;
	var $scramjetVersion: {
		build: string;
		version: string;
	};
}
export { scramjetPath };
