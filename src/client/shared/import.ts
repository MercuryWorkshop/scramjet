import { ScramjetClient } from "@client/index";
import { config } from "@/shared";
import { rewriteUrl } from "@rewriters/url";

export default function (client: ScramjetClient, self: Self) {
	const Function = client.natives.store["Function"];

	Object.defineProperty(self, config.globals.importfn, {
		value: function (base: string, url: string) {
			const resolved = new URL(url, base).href;

			if (
				url.includes(":") ||
				url.startsWith("/") ||
				url.startsWith(".") ||
				url.startsWith("..")
			) {
				// this is a url
				return Function(
					`return import("${rewriteUrl(resolved, client.meta)}?type=module")`
				)();
			} else {
				// this is a specifier handled by importmaps
				return Function(`return import("${url}")`)();
			}
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
	Object.defineProperty(self, config.globals.metafn, {
		value: function (metaobj: any, base: string) {
			metaobj.url = base;
			metaobj.resolve = function (url: string) {
				return new URL(url, base).href;
			};

			return metaobj;
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
}
