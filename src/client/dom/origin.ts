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
			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Trap("document.baseURI", {
		get() {
			const base = self.document.querySelector("base");
			if (base) {
				return new URL(base.href, client.url).href;
			}

			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Trap("document.documentURI", {
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
