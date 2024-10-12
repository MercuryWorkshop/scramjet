import { ScramjetClient } from "../client";
const realf = fetch;
export default function (client: ScramjetClient) {
	client.Proxy("URL.revokeObjectURL", {
		apply(ctx) {
			ctx.return(undefined);
		},
	});

	client.Proxy("URL.createObjectURL", {
		apply(ctx) {
			const url: string = ctx.call();
			// additional origin concealer. also you need this for youtube for some fucking reason

			const start = "blob:" + location.origin;
			if (url.startsWith(start)) {
				const id = url.substring(start.length);
				ctx.return("blob:" + client.url.origin + id);
			} else {
				ctx.return(url);
			}
		},
	});
}
