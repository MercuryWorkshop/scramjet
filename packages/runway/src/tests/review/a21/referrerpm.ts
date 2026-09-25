import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

// A widget posting to its embedder with `document.referrer` as targetOrigin.
const child = (): Record<string, [string, string]> => ({
	"/child": [
		H,
		`<!doctype html><body><script src="/child.js"></script></body>`,
	],
	"/child.js": [
		J,
		`
		const T = (window.opener && window.opener !== window) ? window.opener : parent;
		try { T.postMessage({ rv21ref: "ok", ref: document.referrer }, document.referrer); }
		catch (e) { T.postMessage({ rv21ref: "threw " + e.name + ": " + e.message, ref: document.referrer }, "*"); }
	`,
	],
});
const body = (open: string) => `
	${PRE}
	const p = waitMsg((e) => e.data && e.data.rv21ref, 6000);
	${open}
	const e = await p;
	const r = e ? e.data.rv21ref : "DROPPED";
	assertEqual(r, "ok", "referrer-targeted message (referrer=" + JSON.stringify(e && e.data.ref) + ")");
`;
export default [
	withOrigins(
		"rv21-refpm-iframe-cross",
		body(
			`const f = document.createElement("iframe"); f.src = P[0] + "/child"; document.body.appendChild(f);`
		),
		child
	),
	withOrigins(
		"rv21-refpm-iframe-same",
		body(
			`const f = document.createElement("iframe"); f.src = "/child"; document.body.appendChild(f);`
		),
		child,
		{
			mainFiles: child,
		}
	),
	withOrigins(
		"rv21-refpm-popup",
		body(
			`const w = window.open(P[0] + "/child", "rv21refpop", "width=300,height=300"); setTimeout(() => { try { w.close(); } catch {} }, 5000);`
		),
		child
	),
] as Test[];
