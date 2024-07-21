import { locationProxy } from "./location";
import { documentProxy, windowProxy } from "./window";

export const iswindow = "window" in self;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;

function scope(identifier: any) {
	// this will break iframe postmessage!
	if (
		iswindow &&
		(identifier instanceof Window ||
			identifier instanceof top.window.Window ||
			identifier instanceof parent.window.Window)
	) {
		return windowProxy;
	} else if (
		(iswindow && identifier instanceof Location) ||
		(isworker && identifier instanceof WorkerLocation)
	) {
		return locationProxy;
	} else if (iswindow && identifier instanceof Document) {
		return documentProxy;
	} else if (isworker && identifier instanceof WorkerGlobalScope) {
		return windowProxy;
	}

	return identifier;
}

// shorthand because this can get out of hand reall quickly
self.$s = scope;

self.$tryset = function (lhs: any, op: string, rhs: any) {
	if (lhs instanceof Location) {
		// @ts-ignore
		locationProxy.href = rhs;

		return true;
	}
};
