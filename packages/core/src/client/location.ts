import { ScramjetClient } from "@client/index";
import { Tap } from "@/Tap";
import { iswindow } from "@client/entry";
import {
	Reflect_apply,
	Object_setPrototypeOf,
	_URL,
	Object_defineProperty,
} from "@/shared/snapshot";

export function createLocationProxy(client: ScramjetClient, self: GlobalThis) {
	const Location = iswindow ? self.Location : self.WorkerLocation;
	// location cannot be Proxy()d
	const fakeLocation: any = {};
	Object_setPrototypeOf(fakeLocation, Location.prototype);
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
		const native = client.natives.call(
			"Object.getOwnPropertyDescriptor",
			null,
			descriptorSource,
			prop
		);
		if (!native) continue;

		const desc: Partial<PropertyDescriptor> = {
			configurable: false,
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
						Tap.dispatch(
							client.hooks.lifecycle.navigate,
							{
								type: "hashchange",
							},
							{
								url: client.url.href,
							}
						);

						return;
					}
					const url = new _URL(client.url.href);
					url[prop] = args[0];
					client.url = url;
				},
			});
		}
		Object_defineProperty(fakeLocation, prop, desc);
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
				return fakeLocation;
			},
		});
	if (self.location.assign)
		fakeLocation.assign = new Proxy(self.location.assign, {
			apply(target, that, args) {
				args[0] = client.rewriteUrl(args[0]);
				Reflect_apply(target, self.location, args);
				Tap.dispatch(
					client.hooks.lifecycle.navigate,
					{
						type: "location",
					},
					{
						url: client.url.href,
					}
				);
			},
		});
	if (self.location.reload)
		fakeLocation.reload = new Proxy(self.location.reload, {
			apply(target, that, args) {
				Reflect_apply(target, self.location, args);
			},
		});
	if (self.location.replace)
		fakeLocation.replace = new Proxy(self.location.replace, {
			apply(target, that, args) {
				args[0] = client.rewriteUrl(args[0]);
				Reflect_apply(target, self.location, args);

				Tap.dispatch(
					client.hooks.lifecycle.navigate,
					{
						type: "location",
					},
					{
						url: client.url.href,
					}
				);
			},
		});

	// TODO: ancestorOrigins

	return fakeLocation;
}
