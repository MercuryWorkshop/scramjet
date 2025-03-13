import { iswindow } from "..";
import { SCRAMJETCLIENT } from "../../symbols";
import { ScramjetClient } from "../client";
import { config } from "../../shared";
// import { argdbg } from "./err";
import { indirectEval } from "./eval";

export function createWrapFn(client: ScramjetClient, self: typeof globalThis) {
	return function (identifier: any, strict: boolean) {
		if (identifier === self) return client.globalProxy;
		if (identifier === self.location) return client.locationProxy;
		if (identifier === eval) return indirectEval.bind(client, strict);

		if (iswindow) {
			if (identifier === self.parent) {
				if (SCRAMJETCLIENT in self.parent) {
					// ... then we're in a subframe, and the parent frame is also in a proxy context, so we should return its proxy
					return self.parent[SCRAMJETCLIENT].globalProxy;
				} else {
					// ... then we should pretend we aren't nested and return the current window
					return client.globalProxy;
				}
			} else if (identifier === self.document) {
				return client.documentProxy;
			} else if (identifier === self.top) {
				// instead of returning top, we need to return the uppermost parent that's inside a scramjet context
				let current = self;

				for (;;) {
					const test = current.parent.self;
					if (test === current) break; // there is no parent, actual or emulated.

					// ... then `test` represents a window outside of the proxy context, and therefore `current` is the topmost window in the proxy context
					if (!(SCRAMJETCLIENT in test)) break;

					// test is also insde a proxy, so we should continue up the chain
					current = test;
				}

				return current[SCRAMJETCLIENT].globalProxy;
			}
		}

		return identifier;
	};
}

export const order = 4;
export default function (client: ScramjetClient, self: typeof globalThis) {
	// the main magic of the proxy. all attempts to access any "banned objects" will be redirected here, and instead served a proxy object
	// this contrasts from how other proxies will leave the root object alone and instead attempt to catch every member access
	// this presents some issues (see element.ts), but makes us a good bit faster at runtime!
	Object.defineProperty(self, config.globals.wrapfn, {
		value: client.wrapfn,
		writable: false,
		configurable: false,
	});
	Object.defineProperty(self, config.globals.wrapthisfn, {
		value: function (i) {
			if (i === self) return client.globalProxy;

			return i;
		},
		writable: false,
		configurable: false,
	});

	self.$scramitize = function (v) {
		if (v === self) debugger;
		if (v === location) debugger;
		if (iswindow) {
			if (v === self.parent) debugger;
			if (v === self.document) debugger;
			if (v === self.top) debugger;
		}

		if (typeof v === "string" && v.includes("scramjet")) debugger;
		if (typeof v === "string" && v.includes(location.origin)) debugger;

		return v;
	};

	// location = "..." can't be rewritten as wrapfn(location) = ..., so instead it will actually be rewritten as
	// ((t)=>$scramjet$tryset(location,"+=",t)||location+=t)(...);
	// it has to be a discrete function because there's always the possibility that "location" is a local variable
	// we have to use an IIFE to avoid duplicating side-effects in the getter
	Object.defineProperty(self, config.globals.trysetfn, {
		value: function (lhs: any, op: string, rhs: any) {
			if (lhs instanceof Location) {
				// @ts-ignore
				locationProxy.href = rhs;

				return true;
			}
		},
		writable: false,
		configurable: false,
	});
}
