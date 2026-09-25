import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;
const child = (): Record<string, [string, string]> => ({
	"/child": [
		H,
		`<!doctype html><body><script>parent.postMessage({ ref: document.referrer, dyn: 0 }, "*")</script></body>`,
	],
	"/childm": [
		H,
		`<!doctype html><meta name="referrer" content="unsafe-url"><body><script>parent.postMessage({ ref: document.referrer }, "*")</script></body>`,
	],
});
const norm = `const norm = (r) => r.replace(location.origin, "SELF").replace(/localhost:\\d+/, "localhost:N");`;

export default [
	withOrigins(
		"rv21-referrer-iframe",
		`
		${PRE}
		${norm}
		const R = {};
		const run = async (label, make) => {
			const p = waitMsg((e) => e.data && "ref" in e.data, 6000);
			const f = make(); document.body.appendChild(f);
			const e = await p;
			R[label] = e ? norm(e.data.ref) : "none";
		};
		await run("crossScript", () => { const f = document.createElement("iframe"); f.src = P[0] + "/child"; return f; });
		await run("sameScript", () => { const f = document.createElement("iframe"); f.src = "/samechild"; return f; });
		await run("crossPolicyUnsafe", () => { const f = document.createElement("iframe"); f.referrerPolicy = "unsafe-url"; f.src = P[0] + "/child"; return f; });
		await run("crossNoRef", () => { const f = document.createElement("iframe"); f.referrerPolicy = "no-referrer"; f.src = P[0] + "/child"; return f; });
		${report}
	`,
		child,
		{
			mainFiles: () => ({
				"/samechild": [
					H,
					`<!doctype html><body><script>parent.postMessage({ ref: document.referrer }, "*")</script></body>`,
				],
			}),
		}
	),
	withOrigins(
		"rv21-referrer-parsed-iframe",
		`
		${PRE}
		${norm}
		const R = {};
		const p = waitMsg((e) => e.data && "ref" in e.data, 6000);
		document.body.insertAdjacentHTML("beforeend", '<iframe src="' + P[0] + '/child"></iframe>');
		const e = await p;
		R.innerHTMLIframe = e ? norm(e.data.ref) : "none";
		const p2 = waitMsg((e) => e.data && "ref" in e.data, 6000);
		const w = window.open(P[0] + "/child2", "rv21ref", "width=300,height=300");
		const e2 = await p2;
		R.popup = e2 ? norm(e2.data.ref) : "none";
		try { w.close(); } catch {}
		${report}
	`,
		() => ({
			"/child": [
				H,
				`<!doctype html><body><script>parent.postMessage({ ref: document.referrer }, "*")</script></body>`,
			],
			"/child2": [
				H,
				`<!doctype html><body><script>opener.postMessage({ ref: document.referrer }, "*")</script></body>`,
			],
		})
	),
] as Test[];
