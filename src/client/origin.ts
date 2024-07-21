import { client } from ".";
import { decodeUrl } from "../shared/rewriters/url";

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
		return decodeUrl(location.href);
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
