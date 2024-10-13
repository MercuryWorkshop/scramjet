import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, _self: typeof window) {
	client.Trap("origin", {
		get() {
			// this isn't right!!
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

	client.Trap("document.documentURI", {
		get() {
			return client.url.href;
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
