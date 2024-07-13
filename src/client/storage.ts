import IDBMapSync from "@webreflection/idb-map/sync";

const store = new IDBMapSync(window.__location.host, {
    prefix: "Storage",
    durability: "relaxed"
});

await store.sync();

function storageProxy(scope: Storage): Storage {

    return new Proxy(scope, {
        get(target, prop) {
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
            
            default:
                return store.get(prop);
            }
        },

        defineProperty(target, property, attributes) {
            store.set(property as string, attributes.value);
            
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