import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: typeof window) {
	client.Trap("Document.prototype.cookie", {
		get() {
			return client.context.cookieJar.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			client.context.cookieJar.setCookies([value], client.url);
			client.init.sendSetCookie(client.url, value);
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
