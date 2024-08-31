import { config } from "../../shared";
import { ScramjetClient } from "../client";

export const enabled = () => config.flags.captureErrors;

export default function (client: ScramjetClient, self: typeof globalThis) {
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
