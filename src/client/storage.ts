import IDBMapSync from "@webreflection/idb-map/sync";
import { locationProxy } from "./location";

const store = new IDBMapSync(locationProxy.host, {
	prefix: "Storage",
	durability: "relaxed",
});

await store.sync();

function storageProxy(scope: Storage): Storage {
	return new Proxy(scope, {
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
						store.keys()[index];
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
}

const localStorageProxy = storageProxy(window.localStorage);
const sessionStorageProxy = storageProxy(window.sessionStorage);

delete window.localStorage;
delete window.sessionStorage;

window.localStorage = localStorageProxy;
window.sessionStorage = sessionStorageProxy;
