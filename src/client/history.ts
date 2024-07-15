import { decodeUrl } from "./shared";

window.history.pushState = new Proxy(window.history.pushState, {
	apply(target, thisArg, argArray) {
		argArray[2] = decodeUrl(argArray[2]);

		return Reflect.apply(target, thisArg, argArray);
	},
});

window.history.replaceState = new Proxy(window.history.replaceState, {
	apply(target, thisArg, argArray) {
		argArray[2] = decodeUrl(argArray[2]);

		return Reflect.apply(target, thisArg, argArray);
	},
});
