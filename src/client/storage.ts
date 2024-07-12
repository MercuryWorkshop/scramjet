import IDBMapSync from "@webreflection/idb-map/sync";

function storageProxy(scope: Storage): Storage {
    const store = new IDBMapSync(window.__location.host);

    return new Proxy(scope, {
        async get(target, prop) {
            await store.sync();

            switch (prop) {
            case "getItem":
                return (key: string) => {
                    return store.get(key);
                }

            case "setItem":
                return (key: string, value: string) => {
                    store.set(key, value);
                }

            case "removeItem":
                return (key: string) => {
                    store.delete(key);
                }

            case "clear":
                return () => {
                    store.clear();
                }

            case "key":
                return (index: number) => {
                    store.keys()[index];
                }

            case "length":
                return store.size;
            }
        },

        defineProperty(target, property, attributes) {
            target.setItem(property as string, attributes.value);
            
            return true;
        },
    })
}

const localStorageProxy = storageProxy(window.localStorage);
const sessionStorageProxy = storageProxy(window.sessionStorage);

delete window.localStorage;
delete window.sessionStorage;

window.localStorage = localStorageProxy;
window.sessionStorage = sessionStorageProxy;