import { encodeUrl } from "../shared";
import { importfn } from "./wrap";

export default function (client, self) {
	self[importfn] = function (base) {
		return function (url) {
			const resolved = new URL(url, base).href;

			return function () {}.constructor(
				`return import("${encodeUrl(resolved)}")`
			)();
		};
	};
}
