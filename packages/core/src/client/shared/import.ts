import { ScramjetClient } from "@client/index";
import { config } from "@/shared";
import { rewriteUrl } from "@rewriters/url";

export default function (client: ScramjetClient, self: Self) {
	const boundimport = client.natives.call(
		"Function",
		null,
		"url",
		"return import(url)"
	);

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
				return boundimport(`${rewriteUrl(resolved, client.meta)}?type=module`);
			} else {
				// this is a specifier handled by importmaps
				return boundimport(url);
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
