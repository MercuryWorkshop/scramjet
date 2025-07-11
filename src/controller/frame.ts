import { ScramjetController } from ".";
import type { ScramjetClient } from "../client/client";
import { ScramjetEvent, ScramjetEvents } from "../client/events";
import { SCRAMJETCLIENT, SCRAMJETFRAME, SCRAMJETFRAMENAME } from "../symbols";

export class ScramjetFrame extends EventTarget {
	constructor(
		private controller: ScramjetController,
		public frame: HTMLIFrameElement
	) {
		super();
		frame.name = SCRAMJETFRAMENAME;
		frame[SCRAMJETFRAME] = this;
	}

	get client(): ScramjetClient {
		return this.frame.contentWindow.window[SCRAMJETCLIENT];
	}

	get url(): URL {
		return this.client.url;
	}

	go(url: string | URL) {
		if (url instanceof URL) url = url.toString();

		dbg.log("navigated to", url);

		this.frame.src = this.controller.encodeUrl(url);
	}

	back() {
		this.frame.contentWindow?.history.back();
	}

	forward() {
		this.frame.contentWindow?.history.forward();
	}

	reload() {
		this.frame.contentWindow?.location.reload();
	}

	addEventListener<K extends keyof ScramjetEvents>(
		type: K,
		listener: (event: ScramjetEvents[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener as EventListener, options);
	}
}
