// import { encodeUrl } from "./shared";

navigator.sendBeacon = new Proxy(navigator.sendBeacon, {
	apply() {
		// argArray[0] = encodeUrl(argArray[0]);

		// return Reflect.apply(target, thisArg, argArray);
		return null;
	},
});
