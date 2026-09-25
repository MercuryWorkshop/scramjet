import { basicTest, htmlTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv1-union-node-from-unhooked-frame",
		js: `
			// a Node from a realm scramjet hasn't hooked yet (reached via window[0] /
			// frames[0] / event.source) fails box.instanceof, so the (Node or DOMString)
			// union stringifies it into a text node
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const w = window[0];
			const n = w.document.createElement("b");
			document.body.append(n);
			assertEqual(document.body.lastChild.nodeName, "B", "append() of a foreign-realm node");
			const n2 = frames[0].document.createElement("i");
			const holder = document.createElement("div");
			document.body.appendChild(holder);
			holder.replaceChildren(n2);
			assertEqual(holder.innerHTML, "<i></i>", "replaceChildren() of a foreign-realm node");
		`,
	}),
	basicTest({
		name: "rv1-trap-accessors-native-looking",
		js: `
			// accessors newly installed through client.Trap on develop expose their
			// minified source and lose their "get x" name (main left them native)
			const cases = [
				[window, "event", "get"],
				[SVGUseElement.prototype, "href", "get"],
				[SVGImageElement.prototype, "href", "get"],
				[HTMLBodyElement.prototype, "onmessage", "get"],
				[HTMLBodyElement.prototype, "onhashchange", "set"],
				[EventSource.prototype, "onmessage", "get"],
			];
			const bad = [];
			for (const [o, k, half] of cases) {
				const d = Object.getOwnPropertyDescriptor(o, k);
				const fn = d[half];
				const src = Function.prototype.toString.call(fn);
				if (!src.includes("[native code]") || fn.name !== half + " " + k) bad.push(k + ":" + half + " -> " + fn.name + " " + src.slice(0, 60));
			}
			assert(bad.length === 0, bad.join(" | "));
		`,
	}),
	basicTest({
		name: "rv1-popup-about-blank-base-url",
		js: `
			// window.open("") inherits the opener's base URL (Chrome: baseURI is the
			// opener's). develop's reflect layer only inherits through frameElement,
			// so URL-reflecting getters in a popup return the raw relative string
			const w = open("");
			assert(w, "popup blocked");
			try {
				const a = w.document.createElement("a");
				a.href = "/p";
				const img = w.document.createElement("img");
				img.src = "x.png";
				assertEqual(a.href, new URL("/p", location.href).href, "popup a.href");
				assertEqual(img.src, new URL("x.png", location.href).href, "popup img.src");
			} finally {
				w.close();
			}
		`,
	}),
];
