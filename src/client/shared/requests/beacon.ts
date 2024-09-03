import { encodeUrl } from "../../../shared/rewriters/url";
import { ScramjetClient } from "../../client";

export default function (client: ScramjetClient, self) {
	client.Proxy("navigator.sendBeacon", {
		apply(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0], client.meta);
		},
	});
}
