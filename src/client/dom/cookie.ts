import { parse } from "set-cookie-parser";
import { ScramjetClient } from "../client";
import IDBMapSync from "@webreflection/idb-map/sync";

export default function (client: ScramjetClient, self: typeof window) {
	let cookieStore = new IDBMapSync(client.url.host, {
		durability: "relaxed",
		prefix: "Cookies",
	});

	client.Trap("Document.prototype.cookie", {
		get(ctx) {
			let cookies = cookieStore.entries();
			if (client.url.protocol !== "https:") {
				cookies = cookies.filter(([_k, v]) => !v.args.includes(["Secure"]));
			}
			cookies = cookies.filter(([_k, v]) => !v.args.includes(["HttpOnly"]));
			cookies = Array.from(cookies.map(([k, v]) => `${k}=${v.value}`));
			return cookies.join("; ");
		},
		set(ctx, value: string) {
			// dbg.debug("setting cookie", value);
			const cookie = parse(value)[0];

			let date = new Date();
			let expires = cookie.expires;

			// dbg.error("expires", expires);
			// if (expires instanceof Date) {
			// 	if (isNaN(expires.getTime())) return;
			// 	if (expires.getTime() < date.getTime()) return;
			// }

			// set.call(document, `${cookie.name}=${cookie.value}`);
		},
	});

	// @ts-ignore
	delete self.cookieStore;
}
