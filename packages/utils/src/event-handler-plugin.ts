import { ManagedPlugin } from "@mercuryworkshop/scramjet-controller";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import {
	setupAlwaysLastBubble,
	type AddAlwaysLastEventListener,
} from "./alwaysLastBubble";

export type { AddAlwaysLastEventListener } from "./alwaysLastBubble";
export { setupAlwaysLastBubble } from "./alwaysLastBubble";

export type EventHandlerPluginOptions = {
	/** Bubble-phase event types to track. Defaults to click, auxclick, and contextmenu. */
	events?: string[];
};

/**
 * Allows you to register an event listener on an element, such that it will only run after the page's own listeners (including after stopPropagation).
 * This allows you to fake "native" browser behavior with ease
 */
export class EventHandlerPlugin extends ManagedPlugin {
	private addAlwaysLastEventListeners: Map<Window, AddAlwaysLastEventListener> =
		new Map();
	private eventsToCapture: string[] = [];

	constructor(private options: EventHandlerPluginOptions = {}) {
		super("event-handler", []);
	}

	install(frame: Frame): void {
		super.install(frame);

		this.tap(frame.hooks.init.post, (context) => {
			this.addAlwaysLastEventListeners.set(
				context.window,
				setupAlwaysLastBubble(context.client, this.eventsToCapture)
			);
		});
	}

	addEventToCapture(eventName: string): void {
		if (this.eventsToCapture.includes(eventName)) return;
		this.eventsToCapture.push(eventName);
	}

	private getWindow(target: EventTarget): Window | null {
		if (!target) return null;
		// TODO: object safety
		// @ts-expect-error
		if ("ownerDocument" in target && target.ownerDocument.defaultView) {
			// @ts-expect-error
			return target.ownerDocument.defaultView;
		}

		if (
			"constructor" in target &&
			target.constructor &&
			"constructor" in target.constructor &&
			target.constructor.constructor
		) {
			// @ts-expect-error hack hack hack sahur
			return new target.constructor.constructor("return globalThis")();
		}

		return null;
	}

	addEventListener<T extends Event>(
		target: EventTarget,
		eventName: string,
		listener: (e: T) => void
	): void {
		const window = this.getWindow(target);
		if (!window) {
			console.warn("target's original realm could not be found", target);
			return;
		}
		const addAlwaysLastEventListener =
			this.addAlwaysLastEventListeners.get(window);
		if (!addAlwaysLastEventListener) {
			throw new Error(
				"somehow the realm of the target never had addAlwaysLastEventListener installed"
			);
		}
		addAlwaysLastEventListener(target, eventName, listener);
	}
}
