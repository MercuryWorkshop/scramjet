/// <reference types="@rspack/core/module" />
import "../lib/index.d.ts";

self.$scramjetLoadController = function () {
	return require("./controller/index");
};

self.$scramjetLoadClient = function (config) {
	const client = require("./client/entry");
	client.clientInitHook(config);

	return client;
};

self.$scramjetLoadWorker = function () {
	return require("./worker/index");
};

export const $scramjetVersion = {
	build: COMMITHASH,
	version: VERSION,
};

self.$scramjetVersion = $scramjetVersion;

if ("document" in self && document?.currentScript) {
	document.currentScript.remove();
}
