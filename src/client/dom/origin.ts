import { ScramjetClient } from "../client";
import { decodeUrl } from "../shared";

export default function (client: ScramjetClient, self: typeof window) {
	client.Trap("origin", {
		get() {
			return client.url.origin;
		},
		set() {
			return false;
		},
	});

	client.Trap("document.URL", {
		get() {
			return client.url;
		},
		set() {
			return false;
		},
	});

	client.Trap("document.baseURI", {
		get() {
			return decodeUrl(self.location.href);
		},
		set() {
			return false;
		},
	});

	client.Trap("document.domain", {
		get() {
			return client.url.hostname;
		},
		set() {
			return false;
		},
	});
}
