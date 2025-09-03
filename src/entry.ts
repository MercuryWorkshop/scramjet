/// <reference types="@rspack/core/module" />
import "../lib/types.d.ts";

globalThis.$scramjetLoadController = function () {
	return require("./controller/index");
};

globalThis.$scramjetLoadClient = function () {
	return require("./client/entry");
};

globalThis.$scramjetLoadWorker = function () {
	return require("./worker/index");
};

globalThis.$scramjetRequire = function (path: string) {
	return require(path);
};

export const $scramjetVersion = {
	build: COMMITHASH,
	version: VERSION,
};

globalThis.$scramjetVersion = $scramjetVersion;

if ("document" in globalThis && document?.currentScript) {
	document.currentScript.remove();
}
