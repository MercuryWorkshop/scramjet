import { loadScript, registerSw } from "./clientcommon";
import { BootstrapOptions } from "./common";
import type { ProxyTransport } from "@mercuryworkshop/proxy-transports";
import type EpoxyClient from "@mercuryworkshop/epoxy-transport";
import type LibcurlClient from "@mercuryworkshop/libcurl-transport";
import * as ControllerApi from "@mercuryworkshop/scramjet-controller";

export async function init(cfg: BootstrapOptions) {
	let sw = await registerSw(cfg.swPath);
	loadRest(sw, cfg);
}

export async function loadRest(sw: ServiceWorker, cfg: BootstrapOptions) {
	await loadScript(cfg.scramjetBundlePath);
	await loadScript(cfg.scramjetControllerApiPath);

	let transport!: ProxyTransport;
	if (cfg.transport === "epoxy") {
		await loadScript(cfg.epoxyClientPath);
		let EpoxyCtor: typeof EpoxyClient = (window as any).EpoxyTransport
			.EpoxyClient;
		transport = new EpoxyCtor({ wisp: cfg.wispPath });
	} else if (cfg.transport === "libcurl") {
		await loadScript(cfg.libcurlClientPath);
		const LibcurlCtor: typeof LibcurlClient = (window as any).LibcurlTransport
			.LibcurlClient;
		transport = new LibcurlCtor({ wisp: cfg.wispPath });
	} else if (cfg.transport === "bare") {
		throw new Error("Bare transport not implemented yet");
		//...
	}
	let { Controller, config } = (window as any)
		.$scramjetController as typeof ControllerApi;
	config.injectPath = cfg.scramjetControllerInjectPath;
	config.wasmPath = cfg.scramjetWasmPath;
	config.scramjetPath = cfg.scramjetBundlePath;

	let controller = new Controller({
		serviceworker: sw,
		transport,
	});
	console.log(">?/");

	return controller;
}
