import { t } from "./net.ts";

/* eslint-disable quotes */

const frame = `
	const f = document.createElement("iframe");
	f.src = "/echo?frame";
	document.body.appendChild(f);
	await new Promise(r => f.onload = r);
	const w = f.contentWindow;
`;

export default [
	t("rv4-c-iframe-load", frame + `assert(w.fetch, "has fetch");`),
	t(
		"rv4-c-iframe-fetch",
		frame +
			`
		const r = await Promise.race([w.fetch("/text"), new Promise((_, rej) => setTimeout(() => rej(new Error("iframe fetch hung")), 5000))]);
		assertEqual(r.url, location.origin + "/text", "iframe fetch url");
		assertEqual(r.headers.get("x-custom"), "abc", "iframe headers");
	`
	),
	t(
		"rv4-c-iframe-fetch-call",
		frame +
			`
		const r2 = await Promise.race([fetch.call(w, "/text"), new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 5000))]);
		assert(r2.ok, "cross-realm this");
	`
	),
	t(
		"rv4-c-iframe-request",
		frame +
			`
		const req = new w.Request("/echo?x");
		assertEqual(req.url, location.origin + "/echo?x", "iframe Request url");
		const r3 = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 5000))]);
		assert(r3.ok, "fetch foreign Request");
		assertEqual(r3.url, location.origin + "/echo?x", "foreign request url");
	`
	),
	t(
		"rv4-c-srcdoc-fetch",
		`
		const f = document.createElement("iframe");
		f.srcdoc = "<p>hi</p>";
		document.body.appendChild(f);
		await new Promise(r => f.onload = r);
		const w = f.contentWindow;
		const r = await Promise.race([w.fetch("/text"), new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 5000))]);
		assertEqual(await r.text(), "hello", "srcdoc fetch");
		assertEqual(r.headers.get("x-custom"), "abc", "hdr");
	`
	),
	t(
		"rv4-c-aboutblank-fetch",
		`
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const w = f.contentWindow;
		const r = await Promise.race([w.fetch("/text"), new Promise((_, rej) => setTimeout(() => rej(new Error("hung")), 5000))]);
		assertEqual(await r.text(), "hello", "about:blank fetch");
		assertEqual(r.url, location.origin + "/text", "url");
		assertEqual(r.headers.get("x-custom"), "abc", "hdr");
		const x = new w.XMLHttpRequest();
		x.open("GET", "/text");
		await new Promise(r => { x.onload = r; x.send(); });
		assertEqual(x.getResponseHeader("x-custom"), "abc", "xhr hdr");
		assertEqual(x.responseURL, location.origin + "/text", "xhr url");
		w.document.cookie = "fr=1";
		assert(document.cookie.includes("fr=1"), "about:blank cookie shared: " + document.cookie);
	`
	),
];
