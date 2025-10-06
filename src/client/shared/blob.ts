import { rewriteBlob, unrewriteBlob } from "@rewriters/url";
import { ScramjetClient } from "@client/index";
export default function (client: ScramjetClient) {
	// hide the origin from object urls from the page
	client.Proxy("URL.createObjectURL", {
		apply(ctx) {
			const url: string = ctx.call();
			if (url.startsWith("blob:")) {
				ctx.return(rewriteBlob(url, client.meta));
			} else {
				ctx.return(url);
			}
		},
	});

	client.Proxy("URL.revokeObjectURL", {
		apply(ctx) {
			setTimeout(() => {
				// scramjet rewrites blob urls to pass through the service worker first
				// this is neccesary if rewrites need to be applied to the blob
				// the issue is that if you call revokeObjectURL immediately after using the blob
				// the service worker will not have had time to download the blob
				// for some reason this is not an issue natively
				// simple delay is enough
				// TODO: find a way to make this not necessary
				ctx.args[0] = unrewriteBlob(ctx.args[0], client.meta);
				ctx.call();
			}, 1000);
			ctx.return(undefined);
		},
	});
}
