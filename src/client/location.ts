// @ts-nocheck
import { ScramjetClient } from "./client";
import { encodeUrl, decodeUrl } from "./shared";

export function createLocationProxy(
	client: ScramjetClient,
	self: typeof globalThis
) {
	function createLocation() {
		const loc = new URL(client.url.href);

		loc.assign = (url: string) => self.location.assign(encodeUrl(url));
		loc.reload = () => self.location.reload();
		loc.replace = (url: string) => self.location.replace(encodeUrl(url));
		loc.toString = () => loc.href;

		return loc;
	}

	return new Proxy(
		{
			host: "",
		},
		{
			get(target, prop) {
				const loc = createLocation();

				return loc[prop];
			},

			set(obj, prop, value) {
				const loc = createLocation();

				if (prop === "href") {
					self.location.href = encodeUrl(value);
				} else {
					loc[prop] = value;
				}

				return true;
			},
		}
	);
}
