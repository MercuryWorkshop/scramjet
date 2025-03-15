import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("StorageManager.prototype.getDirectory", {
		apply(ctx) {
			const directoryPromise = ctx.call() as Promise<FileSystemDirectoryHandle>;
			ctx.return(
				(async () => {
					const directory = await directoryPromise;

					return directory.getDirectoryHandle(
						`${client.url.hostname.replace(/\/|\s|\./g, "-")}`,
						{
							create: true,
						}
					);
				})()
			);
		},
	});
}
