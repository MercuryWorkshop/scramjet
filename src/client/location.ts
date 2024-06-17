// @ts-nocheck

function urlLocation() {
    let loc = new URL(self.__scramjet$bundle.rewriters.url.decodeUrl(location.href));
    loc.assign = (url: string) => location.assign(self.__scramjet$bundle.rewriters.url.encodeUrl(url));
    loc.reload = () => location.reload();
    loc.replace = (url: string) => location.replace(self.__scramjet$bundle.rewriters.url.encodeUrl(url));
    loc.toString = () => loc.href;
        
    return loc;
}

export function LocationProxy() {
    const loc = urlLocation();

    return new Proxy(window.location, {
        get(target, prop) {
            return loc[prop];
        },
        
        set(obj, prop, value) {
            if (prop === "href") {
                location.href = self.__scramjet$bundle.rewriters.url.encodeUrl(value);
            } else {
                loc[prop] = value;
            }

            return true;
        }
    })
}

window.__location = LocationProxy();