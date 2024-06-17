import "./location";
import "./storage";
import "./element.ts";
import "./eval.ts";
import "./fetch.ts";
import "./trustedTypes.ts";

declare global {
    interface Window {
        __location: Location;
    }
}