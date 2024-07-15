import { locationProxy } from "./location";
import { documentProxy, windowProxy } from "./window";

function scope(identifier: any) {
	if (identifier instanceof Window) {
		return windowProxy;
	} else if (identifier instanceof Location) {
		return locationProxy;
	} else if (identifier instanceof Document) {
		return documentProxy;
	}

	return identifier;
}

// shorthand because this can get out of hand reall quickly
window.$s = scope;
