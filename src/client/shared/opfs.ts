import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("StorageManager.prototype.getDirectory", {
		apply(ctx) {
			const directory = ctx.call() as FileSystemDirectoryHandle;
			ctx.return(
				directory.getDirectoryHandle(client.url.origin, { create: true })
			);
		},
	});
}
