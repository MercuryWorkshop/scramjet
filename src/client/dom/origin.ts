import { ScramjetClient } from "../client";
import { unrewriteUrl } from "../../shared";

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

	client.Trap("Document.prototype.URL", {
		get() {
			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Trap("Document.prototype.documentURI", {
		get() {
			return client.url.href;
		},
		set() {
			return false;
		},
	});

	client.Trap("Document.prototype.domain", {
		get() {
			return client.url.hostname;
		},
		set() {
			return false;
		},
	});
}
