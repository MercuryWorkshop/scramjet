import "./location";
import "./trustedTypes.ts";
import "./eval.ts";
import "./storage";
import "./element.ts";
import "./requests/fetch.ts";
import "./requests/xmlhttprequest.ts";
import "./requests/websocket.ts"
import "./css.ts";

declare global {
    interface Window {
        __location: Location;
    }
}
