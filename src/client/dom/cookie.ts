import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.serviceworker.addEventListener("message", ({ data }) => {
		if (!("scramjet$type" in data)) return;

		if (data.scramjet$type === "cookie") {
			this.cookieStore.setCookies([data.cookie], new URL(data.url));
			return;
		}
	});

	client.Trap("Document.prototype.cookie", {
		get() {
			return client.cookieStore.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			client.cookieStore.setCookies([value], client.url);

			// TODO hardcode because scoping whatever
			client.serviceworker.controller!.postMessage({
				scramjet$type: "cookie",
				cookie: value,
				url: client.url.href,
			});
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
