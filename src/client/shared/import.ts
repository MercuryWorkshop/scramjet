import { ScramjetClient } from "@client/index";
import { config } from "@/shared";
import { rewriteUrl } from "@rewriters/url";

export default function (client: ScramjetClient, self: Self) {
	const Function = client.natives.store["Function"];

	self[config.globals.importfn] = function (base: string, url: string) {
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
	};

	self[config.globals.metafn] = function (base: string) {
		return {
			url: base,
			resolve: function (url: string) {
				return new URL(url, base).href;
			},
		};
	};
}
