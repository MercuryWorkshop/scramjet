import { ScramjetClient } from "@client/index";
import { Constructor, Type } from "@client/webidl";
import { readEventSourceInit } from "@client/helpers";

export const enabled = (client: ScramjetClient, self: Self) =>
	"EventSource" in self;

export default function (client: ScramjetClient) {
	client.Intercept(class extends EventSource {
		// https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface
		@Constructor("USVString", "optional EventSourceInit")
		static konstructor(url: string, eventSourceInitDict?: EventSourceInit) {
			const { withCredentials } = readEventSourceInit(eventSourceInitDict);

			return new this(
				client.rewriteUrl(url, {
					mode: "cors",
					credentials: withCredentials ? "include" : undefined,
				}),
				{ withCredentials }
			);
		}

		@Type("USVString")
		get url(): string {
			return client.unrewriteUrl(super.url);
		}
	});
}
