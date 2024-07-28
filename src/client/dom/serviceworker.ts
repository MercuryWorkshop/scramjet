import { encodeUrl } from "../../shared/rewriters/url";
import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: Self) {
	client.Proxy("Worklet.prototype.addModule", {
		apply(ctx) {
			ctx.args[0] = encodeUrl(ctx.args[0]);
		},
	});

	// client.Proxy("navigator.serviceWorker.register", {
	//   apply(ctx) {
	//     if (ctx.args[0] instanceof URL) ctx.args[0] = ctx.args[0].href;
	//     let url = encodeUrl(ctx.args[0]) + "?dest=serviceworker";
	//     if (ctx.args[1] && ctx.args[1].type === "module") {
	//       url += "&type=module";
	//     }
	//     let worker = new SharedWorker(url);
	//
	//     let handle = worker.port;
	//
	//     navigator.serviceWorker.controller.postMessage({
	//       scramjet$type: "registerServiceWorker",
	//       port: handle,
	//     });
	//
	//     const fakeRegistration = new Proxy(
	//       {
	//         __proto__: ServiceWorkerRegistration.prototype,
	//       },
	//       {
	//         get(target, prop) {
	//           if (prop === "installing") {
	//             return null;
	//           }
	//           if (prop === "waiting") {
	//             return null;
	//           }
	//           if (prop === "active") {
	//             return handle;
	//           }
	//           if (prop === "scope") {
	//             return ctx.args[0];
	//           }
	//
	//           return Reflect.get(target, prop);
	//         },
	//       }
	//     );
	//
	//     ctx.return(new Promise((resolve) => resolve(fakeRegistration)));
	//   },
	// });

	delete self.navigator.serviceWorker;
}
