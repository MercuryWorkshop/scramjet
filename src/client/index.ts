import "./native/eval.ts";
import "./location.ts";
import "./trustedTypes.ts";
import "./requests/fetch.ts";
import "./requests/xmlhttprequest.ts";
import "./requests/websocket.ts"
import "./element.ts";
import "./storage.ts";
import "./css.ts";
import "./worker.ts"

declare global {
    interface Window {
        __location: Location;
    }
}
