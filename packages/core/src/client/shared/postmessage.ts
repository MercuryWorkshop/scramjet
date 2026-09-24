import { iswindow, isworker } from "@client/entry";
import { GlobalScope, ScramjetClient } from "@client/index";
import {
	Math_random,
	Object_hasOwn,
	Reflect_get,
	Object_getPrototypeOf,
	String_startsWith,
	_URL,
} from "@/shared/snapshot";
import { Arguments, dictionaryReader, idlConverter } from "@client/webidl";
import { incumbencyMode } from "@/shared/incumbency";
import { incumbentFor, interceptDepth } from "./incumbency";

/**
 * https://html.spec.whatwg.org/multipage/nav-history-apis.html#windowpostmessageoptions
 *
 * `transfer` is inherited from `StructuredSerializeOptions`, so it is read and
 * converted before `targetOrigin`.
 */
const readWindowPostMessageOptions = dictionaryReader(
	"WindowPostMessageOptions",
	{ targetOrigin: `USVString = "/"` },
	{ transfer: "sequence<object> = []" }
);
const toTargetOrigin = idlConverter(
	"USVString",
	"Failed to execute 'postMessage' on 'Window': The provided value cannot be converted to a string."
);
const toTransfer = idlConverter(
	"sequence<object>",
	"Failed to execute 'postMessage' on 'Window': The provided value cannot be converted to a sequence."
);

/**
 * The overload a Window `postMessage` call resolves to, converted.
 *
 *     postMessage(any message, USVString targetOrigin, optional sequence<object> transfer = []);
 *     postMessage(any message, optional WindowPostMessageOptions options = {});
 *
 * Only the second argument distinguishes them, and only when there are two:
 * undefined, null and any Object - a callable one included - are the
 * dictionary, and every other value is the string.
 * https://webidl.spec.whatwg.org/#es-overloads
 */
function resolveWindowPostMessage(args: any[]): {
	targetOrigin: string;
	transfer: object[];
} {
	const second = args[1];
	const dictionary =
		args.length < 3 &&
		(second === undefined ||
			second === null ||
			typeof second === "object" ||
			typeof second === "function");

	if (dictionary) {
		const options = readWindowPostMessageOptions(second);

		return {
			targetOrigin: options.targetOrigin,
			transfer: options.transfer,
		};
	}

	const targetOrigin = toTargetOrigin(second) as string;
	const transfer =
		args[2] === undefined ? [] : (toTransfer(args[2]) as object[]);

	return { targetOrigin, transfer };
}

/**
 * What a Window message is sent as. The page's data is one member of it, so a
 * page payload that happens to carry the same property names is still only
 * data.
 */
export type WindowMessageEnvelope = {
	$scramjet$messagetype: "window";
	/** the sender's origin, serialized - what `MessageEvent.origin` says */
	$scramjet$origin: string;
	$scramjet$data: any;
	$scramjet$clientid: string;
	/**
	 * The {@link ScramjetClient.originKey} the recipient's document has to have
	 * for the message to be delivered, or null for `"*"`.
	 */
	$scramjet$target: string | null;
};

/** whether `data` is an envelope {@link WindowMessageEnvelope} describes */
export function isWindowEnvelope(data: unknown): data is WindowMessageEnvelope {
	return (
		typeof data === "object" &&
		data !== null &&
		Object_hasOwn(data, "$scramjet$messagetype") &&
		(data as WindowMessageEnvelope).$scramjet$messagetype === "window" &&
		Object_hasOwn(data, "$scramjet$target")
	);
}

/** `MessageEvent.origin` for an origin key: an opaque origin is "null". */
export function serializeOriginKey(key: string): string {
	return String_startsWith(key, "about-opaque://") ? "null" : key;
}

export default function (client: ScramjetClient, self: Self) {
	const getLegacyRealm = (args: any[]) => {
		let pollutant: any;

		if (typeof args[0] === "object" && args[0] !== null) {
			pollutant = args[0]; // try to use the first object we can find
		} else if (typeof args[2] === "object" && args[2] !== null) {
			pollutant = args[2]; // next try to use transfer
		} else {
			pollutant = {}; // give up
		}

		const objectPrototype = Object_getPrototypeOf(pollutant);
		return client.box.objectPrototypes.get(objectPrototype);
	};

	if (iswindow) {
		client.Intercept(class extends GlobalScope {
			// https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
			static postMessage(...args: any[]) {
				// https://webidl.spec.whatwg.org/#dfn-create-operation-function
				// the receiver is checked before any argument is converted, and
				// converting the options runs getters. A global member gets no
				// `checkReceiver` from `Intercept`, so the brand check is a side
				// effect free native getter on the page's own receiver
				new client.native.window(this).closed;

				// too few arguments: the native throws the arity error itself
				if (args.length === 0) return super.postMessage();

				// the incumbent is whoever called in, which has to be asked
				// before anything below can run page code: converting the
				// options runs getters, and a getter that posts a message of
				// its own is not the caller of this one
				let sender: ScramjetClient | null | undefined = incumbentFor(
					client,
					interceptDepth(client)
				);
				if (incumbencyMode(client.context, client.topUrl) === "none") {
					// `none` records no evidence. The payload's prototype is not
					// evidence of the caller either, but it is all this mode has
					sender = getLegacyRealm(args);
				}
				// no script on the stack and no bound sink running: nothing to
				// answer with but the realm being called
				sender ??= client;

				const message = args[0];
				const { targetOrigin, transfer } = resolveWindowPostMessage(args);

				let target: string | null;
				if (targetOrigin === "*") {
					target = null;
				} else if (targetOrigin === "/") {
					target = sender.originKey;
				} else {
					let origin: string;
					try {
						origin = new _URL(targetOrigin).origin;
					} catch {
						throw client.errors.domException("SyntaxError", {
							execute: "postMessage",
							on: "Window",
							detail: `Invalid target origin '${targetOrigin}' in a call to 'postMessage'.`,
						});
					}
					// a URL with an opaque origin gets a fresh one, equal to no
					// document's
					target =
						origin === "null" ? `about-opaque://${Math_random()}` : origin;
				}

				const envelope: WindowMessageEnvelope = {
					$scramjet$messagetype: "window",
					$scramjet$origin: serializeOriginKey(sender.originKey),
					$scramjet$data: message,
					$scramjet$clientid: sender.id,
					$scramjet$target: target,
				};

				// serialization, transfer and its errors, and the queued task
				// are all the native's. Every document here shares the proxy's
				// real origin, so the native's own origin check is left at "/",
				// and the page's is made by the recipient - see `event.ts`
				super.postMessage(envelope, "/", transfer);
			}
		});

		// a bound `postMessage` carries its binder's incumbent
		client.box.incumbentSinks.add(Reflect_get(self, "postMessage"));

		/**
		 * Step 3 of the posted task: "if the targetOrigin argument is not a
		 * single literal U+002A ASTERISK character (*) and targetWindow's
		 * associated Document's origin is not same origin with targetOrigin,
		 * then return." Judged here, against this document - the one the
		 * message is being delivered to.
		 *
		 * Once per event rather than once per listener, and before any
		 * listener runs: a message HTML drops is never dispatched, so it must
		 * not reach an `onmessage`, nor use up a `{ once: true }` listener
		 * that a wrapper then declines to call. Registered at hook time,
		 * before any page script, and capturing - so it is the first listener
		 * the target phase runs, and `stopImmediatePropagation` stops all the
		 * rest.
		 */
		const gate = (event: MessageEvent) => {
			if (!event.isTrusted) return;

			const data = new client.native.MessageEvent(event).data;
			if (!isWindowEnvelope(data)) return;

			const target = data.$scramjet$target;
			if (target === null || target === client.originKey) return;

			new client.native.Event(event).stopImmediatePropagation();
		};
		new client.native.EventTarget(self).addEventListener("message", gate, true);
	}

	// if (iswindow)
	// 	client.Proxy("window.postMessage", {
	// 		apply(ctx) {
	// 						// console.log(
	// 			// 	callerClient,
	// 			// 	client,
	// 			// 	callerGlobalThisProxied.document,
	// 			// 	self.document,
	// 			// 	callerClient === client
	// 			// );
	// 			const inherit =
	// 				callerClient.url.href === "about:srcdoc" ||
	// 				callerClient.url.href === "about:blank";
	// 			ctx.args[0] = {
	// 				$scramjet$messagetype: "window",
	// 				$scramjet$origin: inherit
	// 					? callerClient.global.parent[SCRAMJETCLIENT].url.origin
	// 					: callerClient.url.origin,
	// 				$scramjet$data: ctx.args[0],
	// 			};
	// 			// console.error("?", ctx.args);
	// 			// eval("debugger");

	// 			// * origin because obviously
	// 			if (typeof ctx.args[1] === "string") ctx.args[1] = "*";
	// 			if (typeof ctx.args[1] === "object") ctx.args[1].targetOrigin = "*";

	// 			ctx.return(wrappedPostMessage.call(ctx.fn, ...ctx.args));
	// 		},
	// 	});

	client.Proxy("BroadcastChannel.prototype.postMessage", {
		apply(ctx) {
			ctx.args[0] = {
				$scramjet$messagetype: "window",
				// TODO: need to actually look up the broadcastchannel itself in box i think
				$scramjet$origin: client.url.origin,
				$scramjet$data: ctx.args[0],
			};
		},
	});

	const makeWorkerPostMessageBody = (message: any) => {
		return {
			$scramjet$messagetype: "worker",
			$scramjet$data: message,
		};
	};

	if (isworker) {
		client.Intercept(class extends GlobalScope {
			@Arguments(
				"any",
				"(sequence<object> or optional StructuredSerializeOptions = {})"
			)
			static postMessage(message: any, transferoptions: any) {
				super.postMessage(makeWorkerPostMessageBody(message), transferoptions);
			}
		});
	}

	client.Intercept(class extends MessagePort {
		@Arguments(
			"any",
			"(sequence<object> or optional StructuredSerializeOptions = {})"
		)
		postMessage(message: any, transferoptions: any) {
			super.postMessage(makeWorkerPostMessageBody(message), transferoptions);
		}
	});

	client.Intercept(class extends Worker {
		@Arguments(
			"any",
			"(sequence<object> or optional StructuredSerializeOptions = {})"
		)
		postMessage(message: any, transferoptions: any) {
			super.postMessage(makeWorkerPostMessageBody(message), transferoptions);
		}
	});
}
