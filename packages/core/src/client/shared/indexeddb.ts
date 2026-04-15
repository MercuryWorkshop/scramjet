import { ScramjetClient } from "@client/index";
import { String } from "@/shared/snapshot";

export default function (client: ScramjetClient) {
	client.Proxy("IDBFactory.prototype.open", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Trap("IDBDatabase.prototype.name", {
		get(ctx) {
			const name = String(ctx.get());

			return name.substring(name.indexOf("@") + 1);
		},
	});
}
