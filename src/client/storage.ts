// import IDBMap from "@webreflection/idb-map";

// this will be converted to use IDB later but i can't figure out how to make it work synchronously

function filterStorage(scope: Storage) {
    return Object.keys(scope).filter((key) => key.startsWith(window.__location.host));
}

function storageProxy(scope: Storage): Storage {
    // const store = new IDBMap(window.__location.host);

    return new Proxy(scope, {
        get(target, prop) {
            switch (prop) {
            case "getItem":
                return (key: string) => {
                    return target.getItem(window.__location.host + "@" + key);
                }

            case "setItem":
                return (key: string, value: string) => {
                    target.setItem(window.__location.host + "@" + key, value);
                }

            case "removeItem":
                return (key: string) => {
                    target.removeItem(window.__location.host + "@" + key);
                }

            case "clear":
                return () => {
                    filterStorage(target).forEach((key) => target.removeItem(key));
                }

            case "key":
                return (index: number) => {
                    return target[filterStorage(target)[index]];
                }

            case "length":
                return filterStorage(target).length;
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