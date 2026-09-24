import { rewriteJs } from "@rewriters/js";
import { GlobalScope, ScramjetClient } from "@client/index";
import { String, TextDecoder_decode } from "@/shared/snapshot";
import { Arguments, Returns } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	const rewriteHandler = (handler: TimerHandler): TimerHandler => {
		if (typeof handler === "function") return handler;

		const rewritten = rewriteJs(
			String(handler),
			"(setTimeout string eval)",
			client.context,
			client.meta,
			false,
			client
		);

		return typeof rewritten === "string"
			? rewritten
			: TextDecoder_decode(rewritten);
	};

	// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers
	client.Intercept(class extends GlobalScope {
		@Arguments("TimerHandler", "optional long timeout = 0", "any... arguments")
		@Returns("long")
		static setTimeout(
			handler: TimerHandler,
			timeout?: number,
			...args: any[]
		): number {
			// through the receiver, not a captured `self`. A `this` that is not
			// a global inherits the native's brand check, where a fixed
			// receiver silently made `setTimeout.call({}, fn, 0)` work; and a
			// bare call passes undefined, which WebIDL sends to the global for
			// a member of a [Global] interface, so that still resolves
			return new client.native.window(this).setTimeout(
				rewriteHandler(handler),
				timeout,
				...args
			);
		}

		@Arguments("TimerHandler", "optional long timeout = 0", "any... arguments")
		@Returns("long")
		static setInterval(
			handler: TimerHandler,
			timeout?: number,
			...args: any[]
		): number {
			return new client.native.window(this).setInterval(
				rewriteHandler(handler),
				timeout,
				...args
			);
		}
	});
}
