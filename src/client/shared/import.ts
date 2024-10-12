import { ScramjetClient } from "../client";
import { config } from "../../shared";
import { rewriteUrl } from "../../shared/rewriters/url";

export default function (client: ScramjetClient, self: Self) {
	const Function = client.natives.Function;

	self[config.importfn] = function (base: string) {
		return function (url: string) {
			const resolved = new URL(url, base).href;

			return Function(
				`return import("${rewriteUrl(resolved, client.meta)}")`
			)();
		};
	};

	self[config.metafn] = function (base: string) {
		return {
			url: base,
			resolve: function (url: string) {
				return new URL(url, base).href;
			},
		};
	};
}
