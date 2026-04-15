import { ScramjetClient } from "@client/index";
import { String } from "@/shared/snapshot";

export default function (client: ScramjetClient, _self: Self) {
	client.Trap("PerformanceEntry.prototype.name", {
		get(ctx) {
			// name is going to be a url typically
			const name = String(ctx.get());

			if (name && name.startsWith(client.context.prefix.href)) {
				return client.unrewriteUrl(name);
			}

			return name;
		},
	});

	const filterEntries = (entries: PerformanceEntry[]) => {
		return entries.filter((entry) => {
			for (const file of client.config.maskedfiles) {
				if (String(entry.name).endsWith(file)) {
					return false;
				}
			}

			return true;
		});
	};

	client.Proxy(
		[
			"Performance.prototype.getEntries",
			"Performance.prototype.getEntriesByType",
			"Performance.prototype.getEntriesByName",
			"PerformanceObserverEntryList.prototype.getEntries",
			"PerformanceObserverEntryList.prototype.getEntriesByType",
			"PerformanceObserverEntryList.prototype.getEntriesByName",
		],
		{
			apply(ctx) {
				const entries = ctx.call() as PerformanceEntry[];

				return ctx.return(filterEntries(entries));
			},
		}
	);
}
