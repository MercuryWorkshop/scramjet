import { parse } from "set-cookie-parser";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.Trap("Document.prototype.cookie", {
		get(ctx) {
			const cookiestring = ctx.get();
			dbg.log("original cookiestring", cookiestring);
			//
			// 	if (!cookiestring) return "";
			//
			//
			// 	let string = "";
			//
			// 	for (const cookiestr of cookiestring.split(";")) {
			// 		const cookie = parse(cookiestr.trim())[0];
			// 		if (cookie.name.startsWith(client.url.hostname + "@")) {
			// 			let name = cookie.name.substring(client.url.hostname.length + 1);
			// 			string += `${name}=${cookie.value}; `;
			// 		}
			// 	}
			//
			// 	return string.trimEnd();

			return "sp_t=00246e00653d39d1341bbe9d10f138c4; OptanonConsent=isGpcEnabled=0&datestamp=Sat+Jul+20+2024+16%3A11%3A26+GMT-0400+(Eastern+Daylight+Time)&version=202405.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&landingPath=https%3A%2F%2Fopen.spotify.com%2F&groups=BG169%3A1%2Ct00%3A1%2Ci00%3A1%2CBG170%3A1%2Cs00%3A1%2Cf00%3A1%2Cm00%3A1%2Cf11%3A1";
		},
		set(ctx, value: string) {
			dbg.debug("setting cookie", value);
			const cookie = parse(value)[0];

			let date = new Date();
			let expires = cookie.expires;

			dbg.error("expires", expires);
			// if (expires instanceof Date) {
			// 	if (isNaN(expires.getTime())) return;
			// 	if (expires.getTime() < date.getTime()) return;
			// }

			// set.call(document, `${cookie.name}=${cookie.value}`);
		},
	});

	// @ts-ignore
	delete self.cookieStore;

	// sp_t=00e49dc8-59d0-4b5f-9beb-ec7b67368498; path=/; expires=Invalid Date
	// OTZ=7653361_72_76_104100_72_446760;path=/;expires=Mon, 19 Aug 2024 20:01:06 GMT;secure
}
