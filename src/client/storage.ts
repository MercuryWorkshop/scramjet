import IDBMapSync from "@webreflection/idb-map/sync";
import { locationProxy } from "./location";

const store = new IDBMapSync(locationProxy.host, {
	prefix: "Storage",
	durability: "relaxed",
});

await store.sync();

const localStorageProxy =  new Proxy(window.localStorage, {
	get(target, prop) {
		switch (prop) {
			case "getItem":
				return (key: string) => {
					return store.get(key);
				};

			case "setItem":
				return (key: string, value: string) => {
					store.set(key, value);
					store.sync();
				};

			case "removeItem":
				return (key: string) => {
					store.delete(key);
					store.sync();
				};

			case "clear":
				return () => {
					store.clear();
					store.sync();
				};

			case "key":
				return (index: number) => {
					return [...store.keys()][index];
				};
			case "length":
				return store.size;
			default:
				if (prop in Object.prototype) {
					return Reflect.get(target, prop);
				}

				return store.get(prop);
		}
	},

	//@ts-ignore
	set(target, prop, value) {
		store.set(prop, value);
		store.sync();
	},

	defineProperty(target, property, attributes) {
		store.set(property as string, attributes.value);

		return true;
	},
});

const sessionStorageProxy = new Proxy(window.sessionStorage, {
	get(target, prop) {
		switch (prop) {
			case "getItem":
				return (key: string) => {
					return target.getItem(locationProxy.host + "@" + key);
				}

			case "setItem":
				return (key: string, value: string) => {
					target.setItem(locationProxy.host + "@" + key, value);
				}

			case "removeItem":
				return (key: string) => {
					target.removeItem(locationProxy.host + "@" + key);
				}

			case "clear":
				return () => {
					for (const key in Object.keys(target)) {
						if (key.startsWith(locationProxy.host)) {
							target.removeItem(key);
						}
					}
				}

			case "key":
				return (index: number) => {
					const keys = Object.keys(target).filter((key) => key.startsWith(locationProxy.host));

					return target.getItem(keys[index]);
				}

			case "length":
				return target.length;

			default:
				if (prop in Object.prototype) {
					return Reflect.get(target, prop);
				}

				return target.getItem(locationProxy.host + "@" + (prop as string));
		}
	},

	defineProperty(target, property, attributes) {
		target.setItem(locationProxy.host + "@" + (property as string), attributes.value);
		
		return true;
	},
});

delete window.localStorage;
delete window.sessionStorage;

window.localStorage = localStorageProxy;
window.sessionStorage = sessionStorageProxy;