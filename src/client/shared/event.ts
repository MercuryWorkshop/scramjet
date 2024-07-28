import { iswindow } from "..";
import { ScramjetClient } from "../client";

const realOnEvent = Symbol.for("scramjet original onevent function");

export default function (client: ScramjetClient, self: Self) {
	const handlers = {
		message: {
			origin() {
				return this.data.$scramjet$origin;
			},
			data() {
				return this.data.$scramjet$data;
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

				return listener.apply(self, argArray);
			},
		});
	}

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			ctx.args[1] = wraplistener(ctx.args[1]);
		},
	});

	if (!iswindow) return;

	const targets = [self.window, self.HTMLElement.prototype];

	for (const target of targets) {
		const keys = Reflect.ownKeys(target);

		for (const key of keys) {
			if (typeof key === "string" && key.startsWith("on")) {
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

						ctx.set(wraplistener(value));
					},
				});
			}
		}
	}
}
