import { iswindow } from "..";
import { unrewriteUrl } from "../../shared";
import { SCRAMJETCLIENT } from "../../symbols";
import { ScramjetClient } from "../client";
import { getOwnPropertyDescriptorHandler } from "../helpers";
import { nativeGetOwnPropertyDescriptor } from "../natives";
import { unproxy } from "./unproxy";

const realOnEvent = Symbol.for("scramjet original onevent function");

export default function (client: ScramjetClient, self: Self) {
	const handlers = {
		message: {
			_init() {
				if (typeof this.data === "object" && "$scramjet$type" in this.data) {
					// this is a ctl message
					return false;
				}

				return true;
			},
			ports() {
				// don't know why i have to do this?
				return this.ports;
			},
			source() {
				if (this.source === null) return null;

				const scram: ScramjetClient = this.source[SCRAMJETCLIENT];

				if (scram) return scram.globalProxy;

				return this.source;
			},
			origin() {
				if (typeof this.data === "object" && "$scramjet$origin" in this.data)
					return this.data.$scramjet$origin;

				return client.url.origin;
			},
			data() {
				if (typeof this.data === "object" && "$scramjet$data" in this.data)
					return this.data.$scramjet$data;

				return this.data;
			},
		},
		hashchange: {
			oldURL() {
				return unrewriteUrl(this.oldURL);
			},
			newURL() {
				return unrewriteUrl(this.newURL);
			},
		},
		storage: {
			_init() {
				return this.key.startsWith(client.url.host + "@");
			},
			key() {
				return this.key.substring(this.key.indexOf("@") + 1);
			},
			url() {
				return unrewriteUrl(this.url);
			},
		},
	};

	function wraplistener(listener: (...args: any) => any) {
		return new Proxy(listener, {
			apply(target, that, args) {
				const realEvent: Event = args[0];

				// we only need to handle events dispatched from the browser
				if (realEvent.isTrusted) {
					const type = realEvent.type;

					if (type in handlers) {
						const handler = handlers[type];

						if (handler._init) {
							if (handler._init.call(realEvent) === false) return;
						}

						args[0] = new Proxy(realEvent, {
							get(target, prop, reciever) {
								const value = Reflect.get(target, prop);
								if (prop in handler) {
									return handler[prop].call(target);
								}

								if (typeof value === "function") {
									return new Proxy(value, {
										apply(target, that, args) {
											if (that === reciever) {
												return Reflect.apply(target, realEvent, args);
											}

											return Reflect.apply(target, that, args);
										},
									});
								}

								return value;
							},
							getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
						});
					}
				}

				if (!self.event) {
					Object.defineProperty(self, "event", {
						get() {
							return args[0];
						},
						configurable: true,
					});
				}

				const rv = Reflect.apply(target, that, args);

				return rv;
			},
			getOwnPropertyDescriptor: getOwnPropertyDescriptorHandler,
		});
	}

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			unproxy(ctx, client);
			if (typeof ctx.args[1] !== "function") return;

			const origlistener = ctx.args[1];
			const proxylistener = wraplistener(origlistener);

			ctx.args[1] = proxylistener;

			let arr = client.eventcallbacks.get(ctx.this);
			arr ||= [] as any;
			arr.push({
				event: ctx.args[0] as string,
				originalCallback: origlistener,
				proxiedCallback: proxylistener,
			});
			client.eventcallbacks.set(ctx.this, arr);
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			unproxy(ctx, client);
			if (typeof ctx.args[1] !== "function") return;

			const arr = client.eventcallbacks.get(ctx.this);
			if (!arr) return;

			const i = arr.findIndex(
				(e) => e.event === ctx.args[0] && e.originalCallback === ctx.args[1]
			);
			if (i === -1) return;

			const r = arr.splice(i, 1);
			client.eventcallbacks.set(ctx.this, arr);

			ctx.args[1] = r[0].proxiedCallback;
		},
	});

	client.Proxy("EventTarget.prototype.dispatchEvent", {
		apply(ctx) {
			unproxy(ctx, client);
		},
	});

	const targets = [self.self, self.MessagePort.prototype] as Array<any>;
	if (iswindow) targets.push(self.HTMLElement.prototype);
	if (self.Worker) targets.push(self.Worker.prototype);

	for (const target of targets) {
		const keys = Reflect.ownKeys(target);

		for (const key of keys) {
			if (
				typeof key === "string" &&
				key.startsWith("on") &&
				handlers[key.slice(2)]
			) {
				const descriptor = nativeGetOwnPropertyDescriptor(target, key);
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
