import { encodeUrl } from "../shared/rewriters/url";

class ScramjetServiceWorkerRuntime {
	constructor() {
		addEventListener("message", (event) => {
			if ("scramjet$type" in event.data) {
				event.stopImmediatePropagation();

				return;
			}
		});
	}
}

declare global {
	interface Window {
		ScramjetServiceWorkerRuntime: typeof ScramjetServiceWorkerRuntime;
	}
}

self.ScramjetServiceWorkerRuntime = ScramjetServiceWorkerRuntime;
