import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("IDBFactory.prototype.open", {
		apply(ctx) {
			ctx.args[0] = `${client.url.origin}@${ctx.args[0]}`;
		},
	});

	client.Trap("IDBDatabase.prototype.name", {
		get(ctx) {
			const name = ctx.get() as string;

			return name.substring(name.indexOf("@") + 1);
		},
	});
}
