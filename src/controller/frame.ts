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

/**
 * The ScramjetFrame is the main interface that developers will use to interface with Scramjet itself.
 * 
 * Using ScramjetFrame enables Scramjet to bind to and control the internal window a bit differently. 
 * Using normal iframes that have an `src` directly to /scramjet/ **won't function correctly** - you'll need to use a ScramjetFrame instance.
 */
export class ScramjetFrame extends EventTarget {
	/**
	 * Create a ScramjetFrame instance. You likely won't need to interact the `constrctor`
	 * directly. Instead, you can use {@link controller.ScramjetController.createFrame | ScramjetController.createFrame()}
	 * on your existing ScramjetController.
	 * 
	 * @param controller 
	 * @param frame 
	 */
	constructor(
		private controller: ScramjetController,
		public frame: HTMLIFrameElement
	) {
		super();
		frame.name = createFrameId();
		frame[SCRAMJETFRAME] = this;
	}

	/**
	 * Returns the {@link ScramjetClient} running inside the iframe's contentWindow.
	 */
	get client(): ScramjetClient {
		return this.frame.contentWindow.window[SCRAMJETCLIENT];
	}

	/**
	 * Returns the decoded URL of the iframe.
	 */
	get url(): URL {
		return this.client.url;
	}

	/**
	 * Navigates the iframe to a new URL. 
	 * The inputted URL gets encoded internally, so you don't need to do it yourself.
	 */
	go(url: string | URL) {
		if (url instanceof URL) url = url.toString();

		dbg.log("navigated to", url);

		this.frame.src = this.controller.encodeUrl(url);
	}

	/**
	 * Takes the iframe back in its browser history.
	 * Same action as hitting the back arrow in your own browser.
	 */
	back() {
		this.frame.contentWindow?.history.back();
	}

	/**
	 * Takes the iframe forward in its browser history.
	 * Same action as hitting the forward arrow in your own browser.
	 */
	forward() {
		this.frame.contentWindow?.history.forward();
	}

	/**
	 * Reloads the iframe.
	 */
	reload() {
		this.frame.contentWindow?.location.reload();
	}

	/**
	 * Binds event listeners to listen for lifetime events that are triggered by Scramjet.
	 * @param type The lifecycle event you want to bind a listener to. 
	 * Either `navigate`, `urlchange`, or `contextInit`. Each type is pretty self-explanatory.
	 */
	addEventListener<K extends keyof ScramjetEvents>(
		type: K,
		listener: (event: ScramjetEvents[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener as EventListener, options);
	}
}
