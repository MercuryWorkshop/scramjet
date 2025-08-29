/// <reference types="@rspack/core/module" />
import "../lib/types.d.ts";

self.$scramjetLoadController = function () {
	return require("./controller/index");
};

self.$scramjetLoadClient = function () {
	return require("./client/entry");
};

self.$scramjetLoadWorker = function () {
	return require("./worker/index");
};

self.$scramjetRequire = function (path: string) {
	return require(path);
};

export const $scramjetVersion = {
	build: COMMITHASH,
	version: VERSION,
};

self.$scramjetVersion = $scramjetVersion;

if ("document" in self && document?.currentScript) {
	document.currentScript.remove();
}
