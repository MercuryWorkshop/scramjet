import { ScramjetClient } from "../client";
import { config, encodeUrl } from "../../shared";

export default function (client: ScramjetClient, self: Self) {
	const Function = client.natives.Function;

	self[config.importfn] = function (base: string) {
		return function (url: string) {
			const resolved = new URL(url, base).href;

			return Function(`return import("${encodeUrl(resolved)}")`)();
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
