import { BareTransport } from "@mercuryworkshop/bare-mux-custom";
import { ScramjetConfig, ScramjetFlags, ScramjetVersionInfo } from "@/types";
import DomHandler, { Element } from "domhandler";
import { URLMeta } from "@rewriters/url";
import { CookieJar } from "./cookie";

export * from "./cookie";
export * from "./headers";
export * from "./htmlRules";
export * from "./rewriters";
export * from "./security";

export let codecEncode: (input: string) => string;
export let codecDecode: (input: string) => string;

const nativeFunction = Function;
export function loadCodecs() {
	codecEncode = nativeFunction(`return ${config.codec.encode}`)() as any;
	codecDecode = nativeFunction(`return ${config.codec.decode}`)() as any;
}

export function flagEnabled(flag: keyof ScramjetFlags, url: URL): boolean {
	const value = config.flags[flag];
	for (const regex in config.siteFlags) {
		const partialflags = config.siteFlags[regex];
		if (new RegExp(regex).test(url.href) && flag in partialflags) {
			return partialflags[flag];
		}
	}

	return value;
}

export let config: ScramjetConfig;
export function setConfig(newConfig: ScramjetConfig) {
	config = newConfig;
	loadCodecs();
}

export let bareTransport: BareTransport | null = null;
export function setBareTransport(transport: BareTransport) {
	bareTransport = transport;
}

export type Clientbound = {
	setCookie: [
		{
			cookie: string;
			url: string;
		},
	];
};

export type Serverbound = {
	setCookie: [
		{
			cookie: string;
			url: string;
		},
	];
	blobData: [
		{
			id: string;
			data: Blob;
		},
	];
};

export type ScramjetInterface = {
	sendServerbound?<K extends keyof Serverbound>(
		type: K,
		msg: Serverbound[K][0]
	): Promise<Serverbound[K][1]>;
	onClientbound?<K extends keyof Clientbound>(
		type: K,
		listener: (msg: Clientbound[K][0]) => Promise<Clientbound[K][1]>
	): void;
	getInjectScripts(
		meta: URLMeta,
		handler: DomHandler,
		config: ScramjetConfig,
		cookieJar: CookieJar,
		script: (src: string) => Element
	): Element[];
	getWorkerInjectScripts?(
		meta: URLMeta,
		js: string | Uint8Array,
		config: ScramjetConfig,
		type: string,
		url: string
	): string;
};

export let iface: ScramjetInterface = null!;
export function setInterface(newIface: ScramjetInterface) {
	iface = newIface;
}

export const versionInfo: ScramjetVersionInfo = {
	version: VERSION,
	build: COMMITHASH,
	date: BUILDDATE,
};
