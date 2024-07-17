import "./scope.ts";
import "./window.ts";
import "./event.ts";
import "./native/eval.ts";
import "./location.ts";
import "./trustedTypes.ts";
import "./requests/fetch.ts";
import "./requests/xmlhttprequest.ts";
import "./requests/websocket.ts";
import "./element.ts";
import "./storage.ts";
import "./css.ts";
import "./history.ts";
import "./worker.ts";
import "./beacon.ts";
import "./origin.ts";
import "./import.ts";

declare global {
	interface Window {
		$s: any;
		$sImport: any;
	}
}
