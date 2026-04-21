import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: Self) {
	client.Trap("Document.prototype.cookie", {
		get() {
			return client.context.cookieJar.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			client.context.cookieJar.setCookies(value, client.url);
			client.init.sendSetCookie([
				{
					url: client.url,
					cookie: value,
				},
			]);
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
