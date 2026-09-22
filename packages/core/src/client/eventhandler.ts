import { Reflect_apply } from "@/shared/snapshot";
// type-only: `client.ts` is what reaches this file, and a value import would
// close the cycle at runtime
import type { ScramjetClient } from "./client";

/**
 * The IDL `EventHandler` - typed as its callback, though a non-callable
 * object is a value it can hold too (see `set`).
 */
type EventHandler = ((event: Event) => any) | null;

/**
 * https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers
 *
 * One event handler IDL attribute - `onmessage`, `onopen`, ... - on an object
 * scramjet fakes, where there is no native slot to fall through to.
 *
 * The handler is a real event listener on the target, as it is natively, and
 * that listener is added when the handler is first set, not when the object
 * is made. That is what decides where it runs: after
 * `ws.addEventListener("message", a); ws.onmessage = b`, `a` runs first.
 * Replacing the handler keeps the listener's place; clearing it removes the
 * listener, so setting one again puts it at the end.
 *
 * Not for `Window`'s `onerror` or `onbeforeunload`, whose processing differs.
 */
export class EventHandlerSlot {
	/** https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-value */
	private value: EventHandler = null;
	/** https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-listener */
	private listener: ((this: EventTarget, event: Event) => void) | null = null;

	constructor(
		private readonly client: ScramjetClient,
		private readonly target: EventTarget,
		private readonly type: string
	) {}

	/** https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes */
	get(): EventHandler {
		return this.value;
	}

	/**
	 * `EventHandler` is `[LegacyTreatNonObjectAsNull]`, so anything that is
	 * not an object is null, and an object that is not callable is kept - it
	 * reads back as itself and does nothing when the event fires.
	 */
	set(value: unknown): void {
		if (
			value === null ||
			(typeof value !== "object" && typeof value !== "function")
		) {
			this.deactivate();

			return;
		}

		this.value = value as EventHandler;
		this.activate();
	}

	/** https://html.spec.whatwg.org/multipage/webappapis.html#activate-an-event-handler */
	private activate(): void {
		if (this.listener) return;

		const process = (thisArg: EventTarget, event: Event) =>
			this.process(thisArg, event);
		// a plain function rather than an arrow: the dispatch calls it with
		// `currentTarget` as `this`, which is what the handler is invoked with
		this.listener = function (event) {
			process(this, event);
		};

		const { add } = this.listenerMethods();
		Reflect_apply(add, this.target, [this.type, this.listener]);
	}

	/** https://html.spec.whatwg.org/multipage/webappapis.html#deactivate-an-event-handler */
	private deactivate(): void {
		this.value = null;
		if (!this.listener) return;

		const { remove } = this.listenerMethods();
		Reflect_apply(remove, this.target, [this.type, this.listener]);
		this.listener = null;
	}

	/**
	 * https://html.spec.whatwg.org/multipage/webappapis.html#the-event-handler-processing-algorithm
	 *
	 * `event` is whatever the dispatch hands a listener, which is the stand-in
	 * `shared/event.ts` makes. A throw is left to go up: the dispatch reports
	 * it, as it does for any listener.
	 */
	private process(thisArg: EventTarget, event: Event): void {
		const callback = this.value;
		// https://webidl.spec.whatwg.org/#invoke-a-callback-function step 2 -
		// only reachable through [LegacyTreatNonObjectAsNull]
		if (typeof callback !== "function") return;

		const returnValue = Reflect_apply(callback, thisArg, [event]);

		// "If return value is false, then set event's canceled flag." Through
		// the native, on the real event: the stand-in fails its brand check,
		// and the page may have replaced `Event.prototype.preventDefault`
		if (returnValue === false) {
			const real = this.client.box.standIns.get(event) ?? event;
			Reflect_apply(
				this.client.nativeStore.get("Event").preventDefault.value,
				real,
				[]
			);
		}
	}

	/**
	 * The hooked methods, so the listener gets the page's stand-in event. The
	 * natives only if a slot is made before `hook` has finished, which nothing
	 * does.
	 */
	private listenerMethods() {
		const methods = this.client.listenerMethods;
		if (methods) return methods;

		const natives = this.client.nativeStore.get("EventTarget");

		return {
			add: natives.addEventListener.value,
			remove: natives.removeEventListener.value,
		};
	}
}
