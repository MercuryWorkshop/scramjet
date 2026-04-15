import { ScramjetClient } from "@client/index";
import { Object_defineProperty } from "@/shared/snapshot";

export default function (client: ScramjetClient) {
	client.Proxy("StorageManager.prototype.getDirectory", {
		apply(ctx) {
			const rootPromise = ctx.call();
			ctx.return(
				(async () => {
					const root = await rootPromise;
					const directory = await root.getDirectoryHandle(
						`${client.url.origin.replace(/\/|\s|\./g, "-")}`,
						{
							create: true,
						}
					);
					Object_defineProperty(directory, "name", {
						value: "",
						writable: false,
					});

					return directory;
				})()
			);
		},
	});
}
