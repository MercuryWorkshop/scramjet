import { rewriteJs } from "@rewriters/js";
import { GlobalScope, ScramjetClient } from "@client/index";
import { String, TextDecoder_decode, Reflect_apply } from "@/shared/snapshot";
import { Arguments, Returns } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	/**
	 * `(handler, timeout, ...args)` as one array for `Reflect_apply`. Spreading
	 * `args` into the call would run the page-replaceable iteration protocol,
	 * so the timer need not be called with what the coercion approved.
	 */
	const timerArguments = (
		handler: TimerHandler,
		timeout: number | undefined,
		args: any[]
	) => {
		const call: any[] = [handler, timeout];
		for (let i = 0; i < args.length; i++) call[i + 2] = args[i];

		return call;
	};

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
			return Reflect_apply(
				new client.native.window(this).setTimeout,
				null,
				timerArguments(rewriteHandler(handler), timeout, args)
			);
		}

		@Arguments("TimerHandler", "optional long timeout = 0", "any... arguments")
		@Returns("long")
		static setInterval(
			handler: TimerHandler,
			timeout?: number,
			...args: any[]
		): number {
			return Reflect_apply(
				new client.native.window(this).setInterval,
				null,
				timerArguments(rewriteHandler(handler), timeout, args)
			);
		}
	});
}
