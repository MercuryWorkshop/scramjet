import { encodeUrl } from "../shared/rewriters/url";

self.$sImport = function (base) {
	return function (url) {
		const resolved = new URL(url, base).href;

		return function () {}.constructor(
			`return import("${encodeUrl(resolved)}")`
		)();
	};
};
