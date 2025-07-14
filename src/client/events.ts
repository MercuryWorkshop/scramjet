import { ScramjetClient } from "./client";

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
	constructor(public url: string) {
		super("navigate");
	}
}

export class UrlChangeEvent extends Event {
	constructor(public url: string) {
		super("urlchange");
	}
}

export class ScramjetContextEvent extends Event {
	constructor(
		public window: Self,
		public client: ScramjetClient
	) {
		super("contextInit");
	}
}
