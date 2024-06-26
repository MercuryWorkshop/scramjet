import "./location";
import "./trustedTypes.ts";
import "./eval.ts";
import "./storage";
import "./element.ts";
import "./fetch.ts";
import "./xmlhttprequest.ts";

declare global {
    interface Window {
        __location: Location;
    }
}
