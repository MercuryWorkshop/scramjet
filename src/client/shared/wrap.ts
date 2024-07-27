import { ScramjetClient } from "../client";

export const iswindow = "window" in self;
export const isworker = "WorkerGlobalScope" in self;
export const issw = "ServiceWorkerGlobalScope" in self;
export const isdedicated = "DedicatedWorkerGlobalScope" in self;
export const isshared = "SharedWorkerGlobalScope" in self;

export const wrapfn = "$scramjet$wrap";
export const trysetfn = "$scramjet$tryset";
export const importfn = "$scramjet$import";

export default function (client: ScramjetClient, self: typeof globalThis) {
	// the main magic of the proxy. all attempts to access any "banned objects" will be redirected here, and instead served a proxy object
	// this contrasts from how other proxies will leave the root object alone and instead attempt to catch every member access
	// this presents some issues (see element.ts), but makes us a good bit faster at runtime!

	self[wrapfn] = function (identifier: any) {
		if (
			iswindow &&
			(identifier instanceof self.Window ||
				identifier instanceof self.top.window.Window ||
				identifier instanceof self.parent.window.Window)
		) {
			// this will break iframe postmessage!
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
	};

	// location = "..." can't be rewritten as wrapfn(location) = ..., so instead it will actually be rewritten as
	// ((t)=>$scramjet$tryset(location,"+=",t)||location+=t)(...);
	// it has to be a discrete function because there's always the possibility that "location" is a local variable
	// we have to use an IIFE to avoid duplicating side-effects in the getter
	self[trysetfn] = function (lhs: any, op: string, rhs: any) {
		if (lhs instanceof Location) {
			// @ts-ignore
			locationProxy.href = rhs;

			return true;
		}
	};
}
