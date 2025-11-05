import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: typeof window) {
	client.rpc.onClientbound("setCookie", ({ cookie, url }) => {
		client.cookieStore.setCookies([cookie], new URL(url));
		return undefined;
	});

	client.Trap("Document.prototype.cookie", {
		get() {
			return client.cookieStore.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			client.rpc.sendServerbound("setCookie", {
				cookie: value,
				url: client.url.href,
			});
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
