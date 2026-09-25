import {
	readAddEventListenerOptions,
	readEventListenerOptions,
	type ScramjetClient,
} from "@mercuryworkshop/scramjet";

export function setupAlwaysLastBubble(
	client: ScramjetClient,
	whatToCapture: string[]
) {
	// goal is to override the default behavior of clicking on an <a> link
	// if the link is target=_blank it needs to open in a new browser.js tab instead of a native tab
	// the browser does not provide a neat way of knowing when a link is clicked through
	//
	// so the only solution left is to addEventListener("click") on every single <a> element
	// however, this presents an issue
	// if the page has its *own* event listener, and it calls e.preventDefault(), we need to not open the tab, since we're essentially acting as the new default
	// since events bubble down and can have non trivial control flows, this gets complicated fast
	//
	// the only solution is to register both the first and last event listeners, so that you control the entire call stack
	// registering the first is easy, you just need to call it immediately after creation
	// registering the *last* is extremely difficult

	type EvtDesc = {
		originalcb: ((e: Event) => void) | EventListenerObject;
		/** registered in the page's listener's place, so a remove can find it */
		wrapper: (this: EventTarget, e: Event) => void;
		target: EventTarget;
		type: string;
	};
	let currentlyExecutingDesc: EvtDesc | null = null;
	const eventListeners: Map<EventTarget, EvtDesc[]> = new Map();

	// per event, not per listener: state left on a listener outlives the event
	// that set it and fires on the next one through the same element
	/** events one of our always-last listeners is still waiting to run for */
	const waiting = new WeakMap<Event, () => void>();
	/** the page listener each of those runs after */
	const runAfter = new WeakMap<Event, EvtDesc>();

	// a page listener is handed scramjet's stand-in for some events
	const realEvent = (e: Event): Event => client.box.standIns.get(e) ?? e;

	const isListener = (
		cb: unknown
	): cb is ((e: Event) => void) | EventListenerObject =>
		typeof cb === "function" || (typeof cb === "object" && cb !== null);

	/**
	 * `(AddEventListenerOptions or boolean)`, read through the same reader
	 * scramjet reads it with, and passed on in the page's place: the page's
	 * getters then run once, as they do natively, instead of once here and
	 * again underneath.
	 */
	const readOptions = (
		args: any[],
		read: (value: unknown) => { capture?: boolean; once?: boolean }
	) => {
		const options = args[2];
		if (
			options === null ||
			options === undefined ||
			typeof options === "object" ||
			typeof options === "function"
		) {
			const init = read(options);
			args[2] = init;

			return init;
		}

		return { capture: !!options, once: false };
	};

	const forget = (desc: EvtDesc) => {
		const descs = eventListeners.get(desc.target);
		if (!descs) return;
		const idx = descs.indexOf(desc);
		if (idx !== -1) descs.splice(idx, 1);
	};

	// start by recording every event registered so that we can rebuild the bubble path later
	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			const eventName = ctx.args[0] as string;
			const cb = ctx.args[1];
			const target = ctx.this as EventTarget;
			if (!whatToCapture.includes(eventName)) return;
			if (!isListener(cb)) return;
			const init = readOptions(ctx.args, readAddEventListenerOptions);
			// capture events don't go through the bubble process so we shouldn't include them
			if (init.capture) return;

			// the DOM dedupes on (type, callback, capture), so adding the same
			// listener again has to hand it the same wrapper
			const descs = eventListeners.get(target) ?? [];
			const existing = descs.find(
				(d) => d.type === eventName && d.originalcb === cb
			);
			if (existing) {
				ctx.args[1] = existing.wrapper;

				return;
			}

			const desc: EvtDesc = {
				originalcb: cb,
				target,
				type: eventName,
				wrapper: function (...args: any) {
					// the native drops a `once` listener before calling it
					if (init.once) forget(desc);

					// have a flag for the event that's currently running so that we know where we are in the stack if preventDefault() or stopPropagation() is called
					const previous = currentlyExecutingDesc;
					currentlyExecutingDesc = desc;
					try {
						if (typeof cb === "function") {
							Reflect.apply(cb, this, args);
						} else {
							Reflect.apply(cb.handleEvent, cb, args);
						}
					} finally {
						currentlyExecutingDesc = previous;

						const e = realEvent(args[0]);
						if (runAfter.get(e) === desc) waiting.get(e)?.();
					}
				},
			};

			descs.push(desc);
			eventListeners.set(target, descs);
			ctx.args[1] = desc.wrapper;
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			const eventName = ctx.args[0] as string;
			const cb = ctx.args[1];
			const target = ctx.this as EventTarget;
			if (!whatToCapture.includes(eventName)) return;
			if (!isListener(cb)) return;
			if (readOptions(ctx.args, readEventListenerOptions).capture) return;

			const desc = eventListeners
				.get(target)
				?.find((d) => d.type === eventName && d.originalcb === cb);
			if (!desc) return;

			ctx.args[1] = desc.wrapper;
			forget(desc);
		},
	});

	// if propagation is stopped it never gets to the last listener, so move
	// ours up to wherever the dispatch will now end
	client.Proxy("Event.prototype.stopImmediatePropagation", {
		apply(ctx) {
			const e = realEvent(ctx.this as Event);
			if (!waiting.has(e) || !currentlyExecutingDesc) return;

			// for stopImmediatePropagation this is the last one
			runAfter.set(e, currentlyExecutingDesc);
		},
	});
	client.Proxy("Event.prototype.stopPropagation", {
		apply(ctx) {
			const e = realEvent(ctx.this as Event);
			const current = currentlyExecutingDesc;
			if (!waiting.has(e) || !current) return;

			// stopPropagation means there might still be more listeners on the same element
			// find whatever the last one is on the this element and then inject after it too
			const descs = eventListeners.get(current.target) ?? [];
			const remaining = descs
				.slice(descs.indexOf(current) + 1)
				.filter((d) => d.type === current.type);

			runAfter.set(e, remaining[remaining.length - 1] ?? current);
		},
	});

	return function addAlwaysLastEventListener<T extends Event>(
		target: EventTarget,
		eventName: string,
		listener: (e: T) => void
	) {
		// this event will always run before all other ones, since it was registered at injectHistoryEmulation
		// * unless you registered the event before appending to the dom
		// * unless there's something inside of the <a> that has a listener on it
		// * unless there's a capture listener
		// TODO fix those cases

		new client.native.EventTarget(target).addEventListener(
			eventName,
			(e: T) => {
				const run = () => {
					waiting.delete(e);
					runAfter.delete(e);
					listener(e);
				};

				let lastlistener: EvtDesc | undefined;
				const path = new client.native.Event(e).composedPath();

				// travel the path, from the <a> all the way to Window
				for (const elm of path) {
					const descriptors = eventListeners
						.get(elm)
						?.filter((d) => d.type === eventName);
					// last descriptor was last added and will be called last
					if (descriptors?.length) {
						lastlistener = descriptors[descriptors.length - 1];
					}
				}

				// TODO: if a listener is added to a lower level of the dom inside the listener of a higher level, our lastlistener will not be correct
				if (!lastlistener) {
					// there are no other event listeners! great
					run();
				} else {
					// we know what the last listener is. run this to inject after it
					waiting.set(e, run);
					runAfter.set(e, lastlistener);
				}
			}
		);
	};
}

export type AddAlwaysLastEventListener = ReturnType<
	typeof setupAlwaysLastBubble
>;
