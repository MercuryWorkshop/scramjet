import { ScramjetClient } from "@client/index";

export default function (client: ScramjetClient, self: typeof window) {
	const handler: ProxyHandler<Storage> = {
		get(target, prop) {
			switch (prop) {
				case "getItem":
					return (key: string) => {
						return target.getItem(client.url.host + "@" + key);
					};

				case "setItem":
					return (key: string, value: string) => {
						return target.setItem(client.url.host + "@" + key, value);
					};

				case "removeItem":
					return (key: string) => {
						return target.removeItem(client.url.host + "@" + key);
					};

				case "clear":
					return () => {
						for (const key in Object.keys(target)) {
							if (key.startsWith(client.url.host)) {
								target.removeItem(key);
							}
						}
					};

				case "key":
					return (index: number) => {
						const keys = Object.keys(target).filter((key) =>
							key.startsWith(client.url.host)
						);

						return target.getItem(keys[index]);
					};

				case "length":
					return Object.keys(target).filter((key) =>
						key.startsWith(client.url.host)
					).length;

				default:
					if (prop in Object.prototype || typeof prop === "symbol") {
						return Reflect.get(target, prop);
					}

					return target.getItem(client.url.host + "@" + (prop as string));
			}
		},

		set(target, prop, value) {
			target.setItem(client.url.host + "@" + (prop as string), value);

			return true;
		},

		ownKeys(target) {
			return Reflect.ownKeys(target)
				.filter((f) => typeof f === "string" && f.startsWith(client.url.host))
				.map((f) =>
					typeof f === "string" ? f.substring(client.url.host.length + 1) : f
				);
		},

		getOwnPropertyDescriptor(target, property) {
			return {
				value: target.getItem(client.url.host + "@" + (property as string)),
				enumerable: true,
				configurable: true,
				writable: true,
			};
		},

		defineProperty(target, property, attributes) {
			target.setItem(
				client.url.host + "@" + (property as string),
				attributes.value
			);

			return true;
		},
	};

	const realLocalStorage = self.localStorage;

	const localStorageProxy = new Proxy(self.localStorage, handler);
	const sessionStorageProxy = new Proxy(self.sessionStorage, handler);

	delete self.localStorage;
	delete self.sessionStorage;

	self.localStorage = localStorageProxy;
	self.sessionStorage = sessionStorageProxy;
}
