// @ts-nocheck
import { ScramjetClient } from "./client";
import { nativeGetOwnPropertyDescriptor } from "./natives";
import { rewriteUrl } from "../shared";
import { UrlChangeEvent } from "./events";
import { iswindow } from ".";

export function createLocationProxy(
	client: ScramjetClient,
	self: typeof globalThis
) {
	const Location = iswindow ? self.Location : self.WorkerLocation;
	// location cannot be Proxy()d
	const fakeLocation = {};
	Object.setPrototypeOf(fakeLocation, Location.prototype);
	fakeLocation.constructor = Location;

	// for some reason it's on the object for Location and on the prototype for WorkerLocation??
	const descriptorSource = iswindow ? self.location : Location.prototype;
	const urlprops = [
		"protocol",
		"hash",
		"host",
		"hostname",
		"href",
		"origin",
		"pathname",
		"port",
		"search",
	];
	for (const prop of urlprops) {
		const native = nativeGetOwnPropertyDescriptor(descriptorSource, prop);
		if (!native) continue;

		const desc = {
			configurable: true,
			enumerable: true,
		};
		if (native.get) {
			desc.get = new Proxy(native.get, {
				apply() {
					return client.url[prop];
				},
			});
		}
		if (native.set) {
			desc.set = new Proxy(native.set, {
				apply(target, that, args) {
					if (prop === "href") {
						// special case
						client.url = args[0];

						return;
					}
					if (prop === "hash") {
						self.location.hash = args[0];
						const ev = new UrlChangeEvent(client.url.href);
						if (!client.isSubframe) client.frame?.dispatchEvent(ev);

						return;
					}
					const url = new URL(client.url.href);
					url[prop] = args[0];
					client.url = url;
				},
			});
		}
		Object.defineProperty(fakeLocation, prop, desc);
	}

	// functions
	fakeLocation.toString = new Proxy(self.location.toString, {
		apply() {
			return client.url.href;
		},
	});

	if (self.location.valueOf)
		fakeLocation.valueOf = new Proxy(self.location.valueOf, {
			apply() {
				return client.url.href;
			},
		});
	if (self.location.assign)
		fakeLocation.assign = new Proxy(self.location.assign, {
			apply(target, that, args) {
				args[0] = rewriteUrl(args[0], client.meta);
				Reflect.apply(target, self.location, args);
			},
		});
	if (self.location.reload)
		fakeLocation.reload = new Proxy(self.location.reload, {
			apply(target, that, args) {
				Reflect.apply(target, self.location, args);
			},
		});
	if (self.location.replace)
		fakeLocation.replace = new Proxy(self.location.replace, {
			apply(target, that, args) {
				args[0] = rewriteUrl(args[0], client.meta);
				Reflect.apply(target, self.location, args);
			},
		});

	return fakeLocation;
}
