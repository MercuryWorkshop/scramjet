// @ts-nocheck
import { encodeUrl, decodeUrl } from "./shared";

function createLocation() {
	const loc = new URL(decodeUrl(location.href));
	loc.assign = (url: string) => location.assign(encodeUrl(url));
	loc.reload = () => location.reload();
	loc.replace = (url: string) => location.replace(encodeUrl(url));
	loc.toString = () => loc.href;

	return loc;
}

export const locationProxy = new Proxy(window.location, {
	get(target, prop) {
		const loc = createLocation();

		return loc[prop];
	},

	set(obj, prop, value) {
		const loc = createLocation();

		if (prop === "href") {
			location.href = encodeUrl(value);
		} else {
			loc[prop] = value;
		}

		return true;
	},
});
