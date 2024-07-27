import { ScramjetClient } from "../client";

export const iswindow = "window" in self;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;

export default function (client: ScramjetClient, self: typeof globalThis) {
	function scope(identifier: any) {
		// this will break iframe postmessage!
		if (
			iswindow &&
			(identifier instanceof self.Window ||
				identifier instanceof self.top.window.Window ||
				identifier instanceof self.parent.window.Window)
		) {
			return client.windowProxy;
		} else if (
			(iswindow && identifier instanceof Location) ||
			(isworker && identifier instanceof WorkerLocation)
		) {
			return client.locationProxy;
		} else if (iswindow && identifier instanceof Document) {
			return client.documentProxy;
		} else if (isworker && identifier instanceof WorkerGlobalScope) {
			return client.windowProxy;
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
}
