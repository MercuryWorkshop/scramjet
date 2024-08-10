import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.Trap("Document.prototype.cookie", {
		get() {
			return client.cookieStore.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			client.cookieStore.setCookies([value], client.url);
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
