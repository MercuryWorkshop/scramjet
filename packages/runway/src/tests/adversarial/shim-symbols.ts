import { htmlTest } from "../../testcommon.ts";

export default [
	// the client's own symbol is on the global, where no browser has one
	htmlTest({
		name: "native-no-scramjet-symbols",
		html: `<script>runTest(async () => {
			assertEqual(JSON.stringify(Reflect.ownKeys(window).filter((k) => typeof k === "symbol").map(String)), "[]");
			assertEqual(JSON.stringify(Object.getOwnPropertySymbols(window).map(String)), "[]");
			assertEqual(JSON.stringify(Object.getOwnPropertySymbols(Object.getOwnPropertyDescriptors(window)).map(String)), "[]");
		}, true);</script>`,
	}),
	// the global's enumerable keys hold nothing of the proxy's either
	htmlTest({
		name: "native-no-scramjet-enumerable-globals",
		html: `<script>runTest(async () => {
			const keys = Object.keys(window).filter((k) => /scramjet/i.test(k));
			const forIn = [];
			for (const k in window) if (/scramjet/i.test(k)) forIn.push(k);
			assertEqual(JSON.stringify([keys, forIn]), "[[],[]]");
		}, true);</script>`,
	}),
	// an ordinary object's keys are the page's own, whatever they are called,
	// and the array they come back in is of the realm that was asked
	htmlTest({
		name: "native-reflection-of-ordinary-objects-untouched",
		html: `<script>runTest(async () => {
			const record = { $scramjetVersion: 3 };
			assertEqual(JSON.stringify(Reflect.ownKeys(record)), '["$scramjetVersion"]');
			assertEqual(Object.keys(Object.getOwnPropertyDescriptors(record)).length, 1);
			const frame = document.createElement("iframe");
			document.documentElement.appendChild(frame);
			const w = frame.contentWindow;
			assert(w.Reflect.ownKeys({}) instanceof w.Array, "ownKeys array realm");
			assert(w.Reflect.ownKeys(w) instanceof w.Array, "ownKeys of the global, array realm");
		}, true);</script>`,
	}),
];
