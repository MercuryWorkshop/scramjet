import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient) {
	client.Proxy("StorageManager.prototype.getDirectory", {
		apply(ctx) {
			const rootPromise = ctx.call() as Promise<FileSystemDirectoryHandle>;
			ctx.return(
				(async () => {
					const root = await rootPromise;
					const directory = await root.getDirectoryHandle(
						`${client.url.origin.replace(/\/|\s|\./g, "-")}`,
						{
							create: true,
						}
					);
					Object.defineProperty(directory, "name", {
						value: "",
						writable: false,
					});

					return directory;
				})()
			);
		},
	});
}
