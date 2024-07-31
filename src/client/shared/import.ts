import { config, encodeUrl } from "../shared";

export default function (client, self) {
	self[config.importfn] = function (base) {
		return function (url) {
			const resolved = new URL(url, base).href;

			return Function(`return import("${encodeUrl(resolved)}")`)();
		};
	};
}
