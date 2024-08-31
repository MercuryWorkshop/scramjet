// @ts-nocheck
import { ScramjetClient } from "./client";
import { nativeGetOwnPropertyDescriptor } from "./natives";
import { encodeUrl, decodeUrl } from "./shared";

export function createLocationProxy(
	client: ScramjetClient,
	self: typeof globalThis
) {
	// location cannot be Proxy()d
	const fakeLocation = {};
	Object.setPrototypeOf(fakeLocation, self.Location.prototype);
	fakeLocation.constructor = self.Location;

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
		const native = nativeGetOwnPropertyDescriptor(self.location, prop);
		const desc = {
			configurable: true,
			enumerable: true,
			get: new Proxy(native.get, {
				apply() {
					return client.url[prop];
				},
			}),
		};
		if (native.set) {
			desc.set = new Proxy(native.set, {
				apply(target, thisArg, args) {
					let url = new URL(client.url.href);
					url[prop] = args[0];
					self.location.href = encodeUrl(url.href);
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
	fakeLocation.valueOf = new Proxy(self.location.valueOf, {
		apply() {
			return client.url.href;
		},
	});
	fakeLocation.assign = new Proxy(self.location.assign, {
		apply(target, thisArg, args) {
			args[0] = encodeUrl(args[0]);
			Reflect.apply(target, thisArg, args);
		},
	});
	fakeLocation.reload = new Proxy(self.location.reload, {
		apply(target, thisArg, args) {
			Reflect.apply(target, thisArg, args);
		},
	});
	fakeLocation.replace = new Proxy(self.location.replace, {
		apply(target, thisArg, args) {
			args[0] = encodeUrl(args[0]);
			Reflect.apply(target, thisArg, args);
		},
	});

	return fakeLocation;
}
