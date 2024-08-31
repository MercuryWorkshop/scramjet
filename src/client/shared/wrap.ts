import { iswindow, isworker } from "..";
import { SCRAMJETCLIENT } from "../../symbols";
import { ScramjetClient } from "../client";
import { config } from "../../shared";

export function createWrapFn(client: ScramjetClient, self: typeof globalThis) {
	return function (identifier: any, args: any) {
		if (args && typeof args === "object" && args.length === 0)
			for (const arg of args) {
				// argdbg(arg);
			}
		if (iswindow && identifier instanceof self.Window) {
			return client.globalProxy;
		} else if (iswindow && identifier instanceof self.parent.self.Window) {
			if (SCRAMJETCLIENT in self.parent.self) {
				// ... then we're in a subframe, and the parent frame is also in a proxy context, so we should return its proxy
				return self.parent.self[SCRAMJETCLIENT].globalProxy;
			} else {
				// ... then we should pretend we aren't nested and return the current window
				return client.globalProxy;
			}
		} else if (iswindow && identifier instanceof self.top.self.Window) {
			// instead of returning top, we need to return the uppermost parent that's inside a scramjet context
			let current = self.self;

			for (;;) {
				const test = current.parent.self;
				if (test === current) break; // there is no parent, actual or emulated.

				// ... then `test` represents a window outside of the proxy context, and therefore `current` is the topmost window in the proxy context
				if (!(SCRAMJETCLIENT in test)) break;

				// test is also insde a proxy, so we should continue up the chain
				current = test;
			}

			return current[SCRAMJETCLIENT].globalProxy.window;
		} else if (
			(iswindow && identifier instanceof self.Location) ||
			(isworker && identifier instanceof self.WorkerLocation)
		) {
			return client.locationProxy;
		} else if (iswindow && identifier instanceof self.Document) {
			return client.documentProxy;
		} else if (isworker && identifier instanceof self.WorkerGlobalScope) {
			return client.globalProxy;
		}

		return identifier;
	};
}

export default function (client: ScramjetClient, self: typeof globalThis) {
	// the main magic of the proxy. all attempts to access any "banned objects" will be redirected here, and instead served a proxy object
	// this contrasts from how other proxies will leave the root object alone and instead attempt to catch every member access
	// this presents some issues (see element.ts), but makes us a good bit faster at runtime!
	Object.defineProperty(self, config.wrapfn, {
		value: client.wrapfn,
		writable: false,
		configurable: false,
	});

	// location = "..." can't be rewritten as wrapfn(location) = ..., so instead it will actually be rewritten as
	// ((t)=>$scramjet$tryset(location,"+=",t)||location+=t)(...);
	// it has to be a discrete function because there's always the possibility that "location" is a local variable
	// we have to use an IIFE to avoid duplicating side-effects in the getter
	Object.defineProperty(self, config.trysetfn, {
		value: function (lhs: any, op: string, rhs: any) {
			if (lhs instanceof Location) {
				// @ts-ignore
				locationProxy.href = rhs;

				return true;
			}
		},
		writable: false,
		configurable: false,
	});

	function argdbg(arg) {
		switch (typeof arg) {
			case "string":
				if (arg.includes("scramjet") && !arg.includes("\n")) debugger;
				break;
			case "object":
				if (arg instanceof Location) debugger;
				if (
					arg &&
					arg[Symbol.iterator] &&
					typeof arg[Symbol.iterator] === "function"
				)
					for (let ar of arg) argdbg(ar);
				break;
		}
	}
	self.$scramerr = function scramerr(e) {
		console.warn("CAUGHT ERROR", e);
	};

	self.$scramdbg = function scramdbg(args, t) {
		if (args && typeof args === "object" && args.length > 0) argdbg(args);
		argdbg(t);
		return t;
	};

	client.Proxy("Promise.prototype.catch", {
		apply(ctx) {
			ctx.args[0] = new Proxy(ctx.args[0], {
				apply(target, thisArg, argArray) {
					// console.warn("CAUGHT PROMISE REJECTION", argArray);
					Reflect.apply(target, thisArg, argArray);
				},
			});
		},
	});
}
