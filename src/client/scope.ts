import { locationProxy } from "./location";
import { documentProxy, windowProxy } from "./window";

function scope(identifier: any) {
	// this will break iframe postmessage!
	if (
		identifier instanceof Window ||
		identifier instanceof top.window.Window ||
		identifier instanceof parent.window.Window
	) {
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

window.$tryset = function (lhs: any, op: string, rhs: any) {
	if (lhs instanceof Location) {
		// @ts-ignore
		locationProxy.href = rhs;

		return true;
	}
};
