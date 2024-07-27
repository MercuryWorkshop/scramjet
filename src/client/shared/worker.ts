import { encodeUrl } from "../../shared/rewriters/url";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof globalThis) {
	client.Proxy("Worker", {
		construct({ args }) {
			if (args[0] instanceof URL) args[0] = args[0].href;
			if (args[0].startsWith("blob:") || args[0].startsWith("data:")) {
				// TODO
				return;
			}

			args[0] = encodeUrl(args[0]) + "?dest=worker";

			if (args[1] && args[1].type === "module") {
				args[0] += "&type=module";
			}
		},
	});
}
