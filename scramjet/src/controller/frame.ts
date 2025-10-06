/**
 * @fileoverview Contains abstractions for using Scrmajet under an iframe.
 */

import { ScramjetController } from "@/controller/index";
import type { ScramjetClient } from "@client/index";
import type { ScramjetEvent, ScramjetEvents } from "@client/events";
import { SCRAMJETCLIENT, SCRAMJETFRAME } from "@/symbols";
function createFrameId() {
	return `${Array(8)
		.fill(0)
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")}`;
}

/**
 * An abstraction over proxy iframe creation, which lets you manage instances of Scramjet and not have to worry about the proxy internals, since everything you need is already proxified.
 *
 * @example
 * ```typescript
 * const { ScramjetController } = $scramjetLoadController();
 * const scramjet = new ScramjetController({ prefix: "/scramjet/" });
 * await scramjet.init();
 *
 * const frame = scramjet.createFrame();
 * document.body.appendChild(frame.frame);
 *
 * // Navigate to a URL
 * frame.go("https://example.com");
 *
 * // Listen for proxified navigation events
 * frame.addEventListener("urlchange", (e) => {
 *   console.log("URL changed to:", e.url);
 * });
 *
 * // Go back
 * frame.back();
 * // Go forward
 * frame.forward();
 * // Reload page
 * frame.reload();
 * ```
 */
export class ScramjetFrame extends EventTarget {
	/**
	 * Create a ScramjetFrame instance. You likely won't need to interact the {@link ScramjetFrame.constructor | constructor} directly.
	 * You can instead use {@link ScramjetController.createFrame} on your existing `ScramjetController`.
	 *
	 * @param controller The `ScramjetController` instance that manages this frame with.
	 * @param frame The frame to be controlled for you under Scramjet.
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
	 * Returns the {@link ScramjetClient} instance running inside the iframe's contentWindow.
	 *
	 * @returns The `ScramjetClient` instance.
	 */
	get client(): ScramjetClient {
		return this.frame.contentWindow.window[SCRAMJETCLIENT];
	}

	/**
	 * Returns the proxified URL.
	 *
	 * @returns The proxified URL.
	 */
	get url(): URL {
		return this.client.url;
	}

	/**
	 * Navigates the iframe to a new URL under Scramjet.
	 *
	 * @example
	 * ```typescript
	 * frame.go("https://example.net");
	 * ```
	 *
	 * @param url A real URL to navigate to
	 */
	go(url: string | URL) {
		if (url instanceof URL) url = url.toString();

		dbg.log("navigated to", url);

		this.frame.src = this.controller.encodeUrl(url);
	}

	/**
	 * Goes backwards in the browser history.
	 */
	back() {
		this.frame.contentWindow?.history.back();
	}

	/**
	 * Goes forward in the browser history.
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
	 * Binds event listeners to listen for proxified navigation events in Scramjet.
	 *
	 * @example
	 * ```typescript
	 * // Listen for URL changes
	 * frame.addEventListener("urlchange", (event) => {
	 *   console.log("URL changed:", event.url);
	 *   document.title = event.url; // Update page title
	 * });
	 *
	 * // Listen for navigation events
	 * frame.addEventListener("navigate", (event) => {
	 *   console.log("Navigating to:", event.url);
	 * });
	 * ```
	 *
	 * @param type Type of event to listen for.
	 * @param listener Event listener to dispatch.
	 * @param options Options for the event listener.
	 */
	addEventListener<K extends keyof ScramjetEvents>(
		type: K,
		listener: (event: ScramjetEvents[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void {
		super.addEventListener(type, listener as EventListener, options);
	}
}
