import { ScramjetController } from "@/controller/index";
import type { ScramjetClient } from "@client/index";
import { ScramjetEvent, ScramjetEvents } from "@client/events";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "@/symbols";
function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}
export class ScramjetFrame extends EventTarget {
	constructor(
		private controller: ScramjetController,
		public frame: HTMLIFrameElement
	) {
		super();
		frame.name = createFrameId();
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
