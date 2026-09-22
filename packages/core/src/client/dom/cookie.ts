import { ScramjetClient } from "@client/index";
import { Type } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	client.Intercept(class extends Document {
		@Type("USVString")
		get cookie(): string {
			void super.cookie;
			return client.context.cookieJar.getCookies(client.url, true);
		}
		@Type("USVString")
		set cookie(value: string) {
			void super.cookie;
			client.context.cookieJar.setCookies(value, client.url);
			client.init.sendSetCookie([
				{
					url: client.url,
					cookie: value,
				},
			]);
		}
	});
}
