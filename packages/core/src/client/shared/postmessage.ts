import { iswindow } from "@client/entry";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
import { config } from "@/shared";

export default function (client: ScramjetClient, self: Self) {
	if (iswindow) {
		client.Proxy("window.postMessage", {
			apply(ctx) {
				// when you do top.postMessage, you're calling top's postMessage function, not a function on your own window
				// this seems obvious but the important distinction is that even though you're initiating the action, the function and therefore this proxy handler is top's
				// meaning that if we proxy it naiively here, MessageEvent.source will be top, not the window that actually called postMessage
				//
				// so we need to know what the invoker of this function is, which is impossible normally
				// so `object.postMessage` is rewritten to `wrappostmessagefn(object)`, returning a different function and passing the real source
				dbg.error("window.postMessage called directly - should never happen");
			},
		});
		Object.defineProperty(self, config.globals.wrappostmessagefn, {
			value: function (obj: any) {
				if (typeof obj !== "object" || obj === null) return obj.postMessage;
				let realPostMessage;
				if (client.box.instanceof(obj, "Window")) {
					// this is a real window, not a WindowProxy
					// since it's a real window we can get its client
					const winClient: ScramjetClient = obj[SCRAMJETCLIENT];
					if (!winClient) {
						// should be unreachable
						throw new Error(
							"wrappedPostMessage called with a Window that has no ScramjetClient?"
						);
					}
					realPostMessage = winClient.natives.store["window.postMessage"];
				} else {
					const isWindowProxy = () => {
						if (!("frames" in obj && "postMessage" in obj && "location" in obj))
							return false;
						// really wish there was a better way of doing this
						try {
							// will throw if it's a WindowProxy from another origin
							obj.hawktuah();
						} catch (e) {
							// don't have to box this but should anyway
							if (
								client.box.instanceof(e, "DOMException") &&
								e.name === "SecurityError"
							) {
								return true;
							}
						}
						return false;
					};
					if (isWindowProxy()) {
						// this can never be rewritten. only thing that could ever throw this off is obj being a Proxy which i don't care about
						realPostMessage = obj.postMessage;
					} else {
						// not a window at all (messageport or some custom object)
						// the bind worries me but i don't know how else to do it
						return obj.postMessage.bind(obj);
					}
				}
				return new Proxy(realPostMessage, {
					apply(fn, thisArg, args) {
						args[0] = {
							$scramjet$messagetype: "window",
							$scramjet$origin: client.url.origin,
							$scramjet$data: args[0],
						};
						// force * origin
						if (typeof args[1] === "string") args[1] = "*";
						if (typeof args[1] === "object") args[1].targetOrigin = "*";
						return Reflect.apply(fn, null, args);
					},
				});
			},
			configurable: false,
			writable: false,
			enumerable: false,
		});
	}
	// worker postmessage below
	const toproxy = ["MessagePort.prototype.postMessage"];
	if (self.Worker) toproxy.push("Worker.prototype.postMessage");
	if (!iswindow) toproxy.push("self.postMessage"); // only do the generic version if we're in a worker
	client.Proxy(toproxy, {
		apply(ctx) {
			// origin/source doesn't need to be preserved - it's null in the message event
			ctx.args[0] = {
				$scramjet$messagetype: "worker",
				$scramjet$data: ctx.args[0],
			};
		},
	});
}
