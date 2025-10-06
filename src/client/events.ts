import { ScramjetClient } from "@client/index";

/**
 * Union type for all global Scramjet events.
 */
export type ScramjetGlobalEvent = ScramjetGlobalDownloadEvent;

/**
 * Event class for proxified download interception.
 */
export class ScramjetGlobalDownloadEvent extends Event {
	type = "download";
	constructor(public download: ScramjetDownload) {
		super("download");
	}
}

/**
 * Map for all global Scramjet events with their corresponding event types.
 */
export type ScramjetGlobalEvents = {
	download: ScramjetGlobalDownloadEvent;
};

/**
 * Event for proxified download interception.
 */
export type ScramjetDownload = {
	filename?: string;
	url: string;
	type: string;
	body: ReadableStream<Uint8Array>;
	length: number;
};

/**
 * Union type for all Scramjet proxified navigation events.
 */
export type ScramjetEvent =
	| NavigateEvent
	| UrlChangeEvent
	| ScramjetContextEvent;

/**
 * Type map for all Scramjet navigation events with their corresponding event types.
 */
export type ScramjetEvents = {
	navigate: NavigateEvent;
	urlchange: UrlChangeEvent;
	contextInit: ScramjetContextEvent;
};

/**
 * Navigation event class fired when Scramjet frame navigates to a new proxified URL.
 */
export class NavigateEvent extends Event {
	type = "navigate";
	constructor(public url: string) {
		super("navigate");
	}
}

/**
 * URL change event class fired when the proxified URL changes in a Scramjet frame.
 */
export class UrlChangeEvent extends Event {
	type = "urlchange";
	constructor(public url: string) {
		super("urlchange");
	}
}

/**
 * Event class fired when Scramjet initializes in a frame.
 */
export class ScramjetContextEvent extends Event {
	type = "contextInit";
	constructor(
		public window: Self,
		public client: ScramjetClient
	) {
		super("contextInit");
	}
}
