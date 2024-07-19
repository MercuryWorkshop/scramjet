// ts throws an error if you dont do window.fetch

import { encodeUrl, rewriteHeaders } from "../shared";
import { client } from "../index";

window.fetch = new Proxy(window.fetch, {
	async apply(target, thisArg, argArray) {
		// @ts-expect-error
		const response = await client.fetch(...argArray);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers
		});
	}
});

Headers = new Proxy(Headers, {
	construct(target, argArray, newTarget) {
		argArray[0] = rewriteHeaders(argArray[0]);

		return Reflect.construct(target, argArray, newTarget);
	},
});

Request = new Proxy(Request, {
	construct(target, argArray, newTarget) {
		if (typeof argArray[0] === "string") argArray[0] = encodeUrl(argArray[0]);

		return Reflect.construct(target, argArray, newTarget);
	},
});

Response.redirect = new Proxy(Response.redirect, {
	apply(target, thisArg, argArray) {
		argArray[0] = encodeUrl(argArray[0]);

		return Reflect.apply(target, thisArg, argArray);
	},
});
