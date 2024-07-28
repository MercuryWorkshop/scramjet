import { ScramjetClient } from "../client";

export default function (client: ScramjetClient) {
	client.Proxy("window.postMessage", {
		apply(ctx) {
			// so we need to send the real origin here, since the recieving window can't possibly know.
			// except, remember that this code is being ran in a different realm than the invoker, so if we ask our `client` it may give us the wrong origin
			// but, the first argument given will be polluted with the real realm

			// this obtains a reference to the Function object of the real realm
			const {
				constructor: { constructor: Function },
			} = ctx.args[0];

			// and finally, invoking the stolen Function will execute inside the caller's realm
			const callerGlobalThis: Self = Function("return globalThis")();
			const callerClient: ScramjetClient =
				callerGlobalThis[ScramjetClient.SCRAMJET];

			ctx.args[0] = {
				$scramjet$origin: callerClient.url.origin,
				$scramjet$data: ctx.args[0],
			};

			// * origin because obviously
			if (typeof ctx.args[1] === "string") ctx.args[1] = "*";
		},
	});
}
