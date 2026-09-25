import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const echo = (): Record<string, [string, string]> => ({
	"/echo": [H, `<!doctype html><body><script src="/echo.js"></script></body>`],
	"/echo.js": [
		J,
		`
		const T = (window.opener && window.opener !== window) ? window.opener : parent;
		addEventListener("message", (e) => { if (e.data && e.data.ping) T.postMessage({ echo: e.data.ping, origin: e.origin, src: e.source === T }, "*"); });
		T.postMessage("ready", "*");
	`,
	],
});

const probe = (open: string, after = "") => `
	${PRE}
	let w;
	const ready = waitMsg((e) => e.data === "ready", 6000);
	${open}
	assert(await ready, "ready");
	${after}
	const results = {};
	for (const [label, to] of [["star", "*"], ["exact", P[0]], ["slash", P[0] + "/path"], ["wrong", "http://wrong.example"]]) {
		const p = waitMsg((e) => e.data && e.data.echo === label, 1500);
		w.postMessage({ ping: label }, to);
		const e = await p;
		results[label] = e ? (e.data.origin === location.origin) + "/" + e.data.src : "DROPPED";
	}
	try { w.close && w !== frames[0] && w.close(); } catch {}
	console.log("RV21", JSON.stringify(results));
	assertConsistent("results", JSON.stringify(results));
	assertEqual(JSON.stringify(results), JSON.stringify({ star: "true/true", exact: "true/true", slash: "true/true", wrong: "DROPPED" }), "results");
`;

export default [
	withOrigins(
		"rv21-reuse-iframe-untouched",
		probe(
			`
		const f = document.createElement("iframe"); f.src = P[0] + "/echo"; document.body.appendChild(f);
	`,
			"w = document.querySelector('iframe').contentWindow;"
		),
		echo
	),
	withOrigins(
		"rv21-reuse-iframe-touched",
		probe(`
		const f = document.createElement("iframe"); f.src = P[0] + "/echo"; document.body.appendChild(f);
		void f.contentWindow.document.body; w = f.contentWindow;
	`),
		echo
	),
	withOrigins(
		"rv21-reuse-popup",
		probe(`
		w = window.open(P[0] + "/echo", "rv21p", "width=300,height=300");
	`),
		echo
	),
	withOrigins(
		"rv21-reuse-popup-tab",
		probe(`
		w = window.open(P[0] + "/echo");
	`),
		echo
	),
	withOrigins(
		"rv21-reuse-popup-blank-then-nav",
		probe(`
		w = window.open("", "rv21q", "width=300,height=300"); w.location.href = P[0] + "/echo";
	`),
		echo
	),
] as Test[];
