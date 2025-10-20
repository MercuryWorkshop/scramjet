import { iface } from "@/shared";
import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: typeof window) {
	iface.onClientbound("setCookie", ({ cookie, url }) => {
		client.cookieStore.setCookies([cookie], new URL(url));
		return undefined;
	});

	client.Trap("Document.prototype.cookie", {
		get() {
			return client.cookieStore.getCookies(client.url, true);
		},
		set(ctx, value: string) {
			iface.sendServerbound("setCookie", {
				cookie: value,
				url: client.url.href,
			});
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
