import type { ScramjetClient } from "@mercuryworkshop/scramjet";

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
		injectafter?: (e: Event) => void;
		type: string;
	};
	let currentlyExecutingDesc: EvtDesc | null = null;
	const eventListeners: Map<EventTarget, EvtDesc[]> = new Map();

	// start by recording every event registered so that we can rebuild the bubble path later
	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			const eventName = ctx.args[0] as string;
			const cb = ctx.args[1] as ((e: Event) => void) | EventListenerObject;
			const options = ctx.args[2] as AddEventListenerOptions;
			const target = ctx.this as EventTarget;
			if (!whatToCapture.includes(eventName)) return;
			// capture events don't go through the bubble process so we shouldn't include them
			if (
				(typeof options === "boolean" && options) ||
				(typeof options === "object" && options.capture)
			)
				return;

			ctx.args[1] = function (...args: any) {
				// will always exist since we set it just below
				const descs = eventListeners.get(target)!;
				// find the one talking about us
				const desc = descs.find((d) => d.originalcb === cb)!;

				// have a flag for the event that's currently running so that we know where we are in the stack if preventDefault() or stopPropagation() is called
				currentlyExecutingDesc = desc;
				if (typeof cb === "function") {
					Reflect.apply(cb, this, args);
				} else if (typeof cb === "object" && cb !== null && cb.handleEvent) {
					Reflect.apply(cb.handleEvent, cb, args);
				}

				if (desc.injectafter) {
					desc.injectafter(args[0]);
					delete desc.injectafter;
				}
				currentlyExecutingDesc = null;
			};

			const desc: EvtDesc = {
				originalcb: cb,
				type: eventName,
			};

			if (eventListeners.has(target)) {
				eventListeners.get(target)!.push(desc);
			} else {
				eventListeners.set(target, [desc]);
			}
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

		const callListener = (e: T) => {
			// this goes into our code, so restore the original methods
			// TODO: we probably shouldnt do it like this
			e.stopPropagation =
				client.natives.store["Event.prototype.stopPropagation"];
			e.stopImmediatePropagation =
				client.natives.store["Event.prototype.stopImmediatePropagation"];
			listener(e);
		};

		client.natives.call(
			"EventTarget.prototype.addEventListener",
			target,
			eventName,
			(e: T) => {
				let lastlistener;
				const path = e.composedPath();

				// travel the path, from the <a> all the way to Window
				for (const elm of path) {
					let descriptors = eventListeners.get(elm);
					if (descriptors) {
						descriptors = descriptors.filter((d) => d.type === eventName);
						// last descriptor was last added and will be called last
						lastlistener = descriptors[descriptors.length - 1];
					}
				}

				// TODO: if a listener is added to a lower level of the dom inside the listener of a higher level, our lastlistener will not be correct
				if (!lastlistener) {
					// there are no other event listeners! great
					callListener(e);
				} else {
					// we know what the last listener is. run this to inject after it
					lastlistener.injectafter = (e) => {
						callListener(e);
					};
				}

				// except, if stopPropagation is called, it never gets to the lastlistener
				client.RawProxy(e, "stopImmediatePropagation", {
					apply() {
						if (!currentlyExecutingDesc)
							throw new Error(
								"stopImmediatePropagation called but no desc found?"
							);
						// for stopImmediatePropagation this is the last one
						currentlyExecutingDesc.injectafter = (e) => {
							// in case preventDefault is called after stopImmediatePropagation(), wait for the event handler to be done
							callListener(e as T);
						};
					},
				});
				client.RawProxy(e, "stopPropagation", {
					apply(ctx) {
						if (!currentlyExecutingDesc)
							throw new Error("stopPropagation called but no desc found?");
						// stopPropagation means there might still be more listeners on the same element
						// find whatever the last one is on the this element and then inject after it too

						const ev = ctx.this as Event;
						if (!ev.target) throw new Error("no target");
						const descs = eventListeners.get(ev.target);
						if (!descs) throw new Error("no descs found in stopPropagation()");
						const idx = descs.indexOf(currentlyExecutingDesc);
						if (idx == -1)
							throw new Error("couldn't find currentlyExecutingDesc");
						const remaining = descs.slice(idx + 1, descs.length);
						if (remaining.length > 0) {
							const last = remaining[remaining.length - 1];
							// finally we have the last in the chain after propagation is cut off
							last.injectafter = (e) => {
								callListener(e as T);
							};
						}
					},
				});
			}
		);
	};
}

export type AddAlwaysLastEventListener = ReturnType<
	typeof setupAlwaysLastBubble
>;
