function storageProxy(scope: Storage): Storage {
    // sessionStorage isn't properly implemented currently, since everything is being stored in IDB

    const { set, get, keys, del, createStore } = self.__scramjet$bundle.idb;
    const store = createStore(window.__location.host, "store");

    return new Proxy(scope, {
        get(target, prop) {
            switch (prop) {
            case "getItem":
                return async function getItem(key: string) {
                    return await get(key, store);
                }

            case "setItem":
                return async function setItem(key: string, value: string) {
                    await set(key, value, store);
                }
                
            case "removeItem":
                return async function removeItem(key: string) {
                    await del(key, store);
                }

            case "clear":
                return async function clear() {
                    // clear can't be used because the names are the exact same
                    await self.__scramjet$bundle.idb.clear(store);
                }

            case "key":
                return async function key(index: number) {
                    // supposed to be key but key is the name of the function
                    return (await keys(store))[index];
                }

            case "length":
                return (async ()=>{
                    return (await keys(store)).length;
                })();
            }
        },
    });
}

const localStorageProxy = storageProxy(window.localStorage);
const sessionStorageProxy = storageProxy(window.sessionStorage);

delete window.localStorage;
delete window.sessionStorage;

window.localStorage = localStorageProxy;
window.sessionStorage = sessionStorageProxy;