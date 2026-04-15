import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	// protocol handlers will not work out of the box since there's no guarantee the service worker will be set up
	// or any other expectations that the user agent might need
	// sites can set this up themselves if they want to
	client.Proxy("Navigator.prototype.registerProtocolHandler", {
		apply(ctx) {
			ctx.return();
		},
	});
	client.Proxy("Navigator.prototype.unregisterProtocolHandler", {
		apply(ctx) {
			ctx.return(undefined);
		},
	});
}
