import { iswindow } from "..";
import { ScramjetClient } from "../client";
import { unproxy } from "./unproxy";

const realOnEvent = Symbol.for("scramjet original onevent function");

export default function (client: ScramjetClient, self: Self) {
	const handlers = {
		message: {
			origin() {
				if (typeof this.data === "object" && "$scramjet$origin" in this.data)
					return this.data.$scramjet$origin;

				// then it must be from a worker, which we aren't currently rewriting
				return client.url.origin;
			},
			data() {
				if (typeof this.data === "object" && "$scramjet$data" in this.data)
					return this.data.$scramjet$data;

				return this.data;
			},
		},
	};

	function wraplistener(listener: (...args: any) => any) {
		return new Proxy(listener, {
			apply(target, thisArg, argArray) {
				const realEvent: Event = argArray[0];

				// we only need to handle events dispatched from the browser
				if (realEvent.isTrusted) {
					const type = realEvent.type;

					if (type in handlers) {
						let handler = handlers[type];
						argArray[0] = new Proxy(realEvent, {
							get(_target, prop, reciever) {
								if (prop in handler) {
									return handler[prop].call(_target);
								}

								return Reflect.get(target, prop, reciever);
							},
						});
					}
				}

				return Reflect.apply(target, thisArg, argArray);
			},
		});
	}

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			// if (ctx.args[0] === "message" && iswindow) debugger;
			if (typeof ctx.args[1] === "function")
				ctx.args[1] = wraplistener(ctx.args[1]);
		},
	});

	// TODO: removeEventListener

	if (!iswindow) return;

	const targets = [self.window, self.HTMLElement.prototype];

	for (const target of targets) {
		const keys = Reflect.ownKeys(target);

		for (const key of keys) {
			if (
				typeof key === "string" &&
				key.startsWith("on") &&
				handlers[key.slice(2)]
			) {
				const descriptor = Object.getOwnPropertyDescriptor(target, key);
				if (!descriptor.get || !descriptor.set || !descriptor.configurable)
					continue;

				// these are the `onmessage`, `onclick`, etc. properties
				client.RawTrap(target, key, {
					get(ctx) {
						if (this[realOnEvent]) return this[realOnEvent];

						return ctx.get();
					},
					set(ctx, value: any) {
						this[realOnEvent] = value;

						if (typeof value !== "function") return ctx.set(value);

						ctx.set(wraplistener(value));
					},
				});
			}
		}
	}
}
