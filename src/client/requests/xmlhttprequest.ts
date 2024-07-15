import { encodeUrl, rewriteHeaders } from "../shared";

XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
	apply(target, thisArg, argArray) {
		if (argArray[1]) argArray[1] = encodeUrl(argArray[1]);

		return Reflect.apply(target, thisArg, argArray);
	},
});

XMLHttpRequest.prototype.setRequestHeader = new Proxy(
	XMLHttpRequest.prototype.setRequestHeader,
	{
		apply(target, thisArg, argArray) {
			let headerObject = Object.fromEntries([argArray]);
			headerObject = rewriteHeaders(headerObject);

			argArray = Object.entries(headerObject)[0];

			return Reflect.apply(target, thisArg, argArray);
		},
	}
);
