import { flagEnabled } from "@/shared";
import { ScramjetClient } from "@client/index";

export const enabled = (client: ScramjetClient) =>
	flagEnabled("captureErrors", client.url);
export function argdbg(arg, recurse = []) {
	switch (typeof arg) {
		case "string":
			break;
		case "object":
			if (
				arg &&
				arg[Symbol.iterator] &&
				typeof arg[Symbol.iterator] === "function"
			)
				for (const prop in arg) {
					// make sure it's not a getter
					const desc = Object.getOwnPropertyDescriptor(arg, prop);
					if (desc && desc.get) continue;

					const ar = arg[prop];
					if (recurse.includes(ar)) continue;
					recurse.push(ar);
					argdbg(ar, recurse);
				}
			break;
	}
}

export default function (client: ScramjetClient, self: typeof globalThis) {
	const warn = console.warn;
	self.$scramerr = function scramerr(e) {
		warn("CAUGHT ERROR", e);
	};

	self.$scramdbg = function scramdbg(args, t) {
		if (args && typeof args === "object" && args.length > 0) argdbg(args);
		argdbg(t);

		return t;
	};

	client.Proxy("Promise.prototype.catch", {
		apply(ctx) {
			if (ctx.args[0])
				ctx.args[0] = new Proxy(ctx.args[0], {
					apply(target, that, args) {
						// console.warn("CAUGHT PROMISE REJECTION", args);
						Reflect.apply(target, that, args);
					},
				});
		},
	});
}
