import "./window.ts";
import "./event.ts";
import "./native/eval.ts";
import "./location.ts";
import "./trustedTypes.ts";
import "./requests/fetch.ts";
import "./requests/xmlhttprequest.ts";
import "./requests/websocket.ts"
import "./element.ts";
import "./storage.ts";
import "./css.ts";
import "./history.ts"
import "./worker.ts";
import "./scope.ts";

declare global {
    interface Window {
        __location: Location;
        __window: Window;
        //@ts-ignore scope function cant be typed
        __s: any;
    }
}

const scripts = document.querySelectorAll("script:not([data-scramjet])");

for (const script of scripts) {
    const clone = document.createElement("script");

    for (const attr of Array.from(script.attributes)) {
        clone.setAttribute(attr.name, attr.value);
    }

    if (script.innerHTML !== "") {
        clone.innerHTML = script.innerHTML;
    }

    script.insertAdjacentElement("afterend", clone);
    script.remove();
}