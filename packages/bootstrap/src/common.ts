export const REGISTRY_URL = "https://registry.npmjs.org/";
export const SCRAMJET_PACKAGE_NAME = "@mercuryworkshop/scramjet";

export const SCRAMJET_CONTROLLER_PACKAGE_NAME =
	"@mercuryworkshop/scramjet-controller";
export const SCRAMJET_CONTROLLER_PINNED_MAJOR_VERSION = "0";

export const EPOXY_TRANSPORT_PACKAGE_NAME = "@mercuryworkshop/epoxy-transport";
export const EPOXY_TRANSPORT_PINNED_MAJOR_VERSION = "3";

export const LIBCURL_TRANSPORT_PACKAGE_NAME =
	"@mercuryworkshop/libcurl-transport";
export const LIBCURL_TRANSPORT_PINNED_MAJOR_VERSION = "2";

export type TransportOptions = "epoxy" | "libcurl" | "bare";

export type BootstrapOptions = {
	transport: TransportOptions;
	swPath: string;

	wispPath: string;

	scramjetBundlePath: string;
	scramjetWasmPath: string;

	epoxyClientPath: string;
	libcurlClientPath: string;
	bareClientPath: string;
	scramjetControllerApiPath: string;
	scramjetControllerInjectPath: string;
	scramjetControllerSwPath: string;

	bootstrapApiPath: string;
	bootstrapInitPath: string;

	scramjetVersionPin?: string;
	scramjetControllerVersionPin?: string;
	epoxyTransportVersionPin?: string;
	libcurlTransportVersionPin?: string;
	bareTransportVersionPin?: string;
};

export const defaultConfig: Partial<BootstrapOptions> = {
	transport: "libcurl",
	swPath: "/sw.js",
	wispPath: "/wisp/",

	epoxyClientPath: "/clients/epoxy-client.js",
	libcurlClientPath: "/clients/libcurl-client.js",
	bareClientPath: "/clients/bare-client.js",
	bootstrapInitPath: "/bootstrap-init.js",

	scramjetControllerApiPath: "/controller/controller.api.js",
	scramjetControllerInjectPath: "/controller/controller.inject.js",
	scramjetControllerSwPath: "/controller/controller.sw.js",
	scramjetBundlePath: "/scram/scramjet.js",
	scramjetWasmPath: "/scram/scramjet.wasm",
};
