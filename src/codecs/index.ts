// for some reason eslint was parsing the type inside of the function params as a variable
export interface Codec {
	// eslint-disable-next-line
	encode: (str: string | undefined) => string;
	// eslint-disable-next-line
	decode: (str: string | undefined) => string;
}

const none = {
	encode: (str: string | undefined) => str,
	decode: (str: string | undefined) => str,
};

const plain = {
	encode: (str: string | undefined) => {
		if (!str) return str;

		return encodeURIComponent(str);
	},
	decode: (str: string | undefined) => {
		if (!str) return str;

		return decodeURIComponent(str);
	},
};

const xor = {
	encode: (str: string | undefined, key: number = 2) => {
		if (!str) return str;

		let result = "";
		for (let i = 0; i < str.length; i++) {
			result += i % key ? String.fromCharCode(str.charCodeAt(i) ^ key) : str[i];
		}

		return encodeURIComponent(result);
	},
	decode: (str: string | undefined, key: number = 2) => {
		if (!str) return str;

		const [input, ...search] = str.split("?");
		let result = "";
		const decoded = decodeURIComponent(input);
		for (let i = 0; i < decoded.length; i++) {
			result +=
				i % key ? String.fromCharCode(decoded.charCodeAt(i) ^ key) : decoded[i];
		}

		return result + (search.length ? "?" + search.join("?") : "");
	},
};

const base64 = {
	encode: (str: string | undefined) => {
		if (!str) return str;

		return decodeURIComponent(btoa(str));
	},
	decode: (str: string | undefined) => {
		if (!str) return str;

		return atob(str);
	},
};

if (typeof self.$scramjet === "undefined") {
	//@ts-expect-error really dumb workaround
	self.$scramjet = {};
}
self.$scramjet.codecs = {
	none,
	plain,
	xor,
	base64,
};

if ("document" in self && document.currentScript) {
	document.currentScript.remove();
}
