import * as controller from "../dist/types/controller/index.ts";
import { ScramjetConfig } from "../dist/types/types.ts";
import * as worker from "../dist/types/worker";
import * as shared from "../dist/types/shared";
import * as client from "../dist/types/shared";

declare global {
	function $scramjetLoadController(): typeof controller;
	function $scramjetLoadWorker(): typeof worker;
	function $scramjetLoadClient(config: ScramjetConfig): typeof client;
	function $scramjetLoadShared(): typeof shared;
	/// load any file from scramjet source
	function $scramjetRequire(path: string): any;
	var $scramjetVersion: {
		build: string;
		version: string;
	};
}

export type * from "../dist/types/index";
