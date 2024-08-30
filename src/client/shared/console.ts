import { ScramjetClient } from "../client";

export default function (client: ScramjetClient) {
	client.Proxy("console.clear", {
		apply(ctx) {
			// fuck you
			ctx.return(undefined);
		},
	});
}
