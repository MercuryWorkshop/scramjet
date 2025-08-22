import { ScramjetClient } from "@client/index";

export type ScramjetGlobalEvent = ScramjetGlobalDownloadEvent;
export class ScramjetGlobalDownloadEvent extends Event {
	type = "download";
	constructor(public download: ScramjetDownload) {
		super("download");
	}
}
export type ScramjetGlobalEvents = {
	download: ScramjetGlobalDownloadEvent;
};
export type ScramjetDownload = {
	filename?: string;
	url: string;
	type: string;
	body: ReadableStream<Uint8Array>;
	length: number;
};

export type ScramjetEvent =
	| NavigateEvent
	| UrlChangeEvent
	| ScramjetContextEvent;
export type ScramjetEvents = {
	navigate: NavigateEvent;
	urlchange: UrlChangeEvent;
	contextInit: ScramjetContextEvent;
};

export class NavigateEvent extends Event {
	type = "navigate";
	constructor(public url: string) {
		super("navigate");
	}
}

export class UrlChangeEvent extends Event {
	type = "urlchange";
	constructor(public url: string) {
		super("urlchange");
	}
}

export class ScramjetContextEvent extends Event {
	type = "contextInit";
	constructor(
		public window: Self,
		public client: ScramjetClient
	) {
		super("contextInit");
	}
}
