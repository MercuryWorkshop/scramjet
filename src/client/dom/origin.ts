import { ScramjetClient } from "../client";
import { decodeUrl } from "../../shared";

export default function (client: ScramjetClient, self: typeof window) {
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
