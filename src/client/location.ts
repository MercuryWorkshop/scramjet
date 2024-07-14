// @ts-nocheck
import { encodeUrl, decodeUrl } from "../shared";

export function LocationProxy() {
    const loc = new URL(decodeUrl(location.href));
    loc.assign = (url: string) => location.assign(encodeUrl(url));
    loc.reload = () => location.reload();
    loc.replace = (url: string) => location.replace(encodeUrl(url));
    loc.toString = () => loc.href;

    return new Proxy(window.location, {
        get(target, prop) {
            return loc[prop];
        },
        
        set(obj, prop, value) {
            if (prop === "href") {
                location.href = encodeUrl(value);
            } else {
                loc[prop] = value;
            }

            return true;
        }
    })
}

window.__location = LocationProxy();