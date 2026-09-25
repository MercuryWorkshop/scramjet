import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;

export default [
	withOrigins(
		"rv21-opts-window-postmessage",
		`
		${PRE}
		const R = {};
		const log = [];
		const opts = {};
		for (const k of ["targetOrigin", "transfer", "includeUserActivation", "delegate"]) Object.defineProperty(opts, k, { get() { log.push(k); return k === "targetOrigin" ? "*" : k === "transfer" ? [] : undefined; }, enumerable: true });
		const p = new Promise((res) => addEventListener("message", (e) => res(e), { once: true }));
		postMessage("x", opts);
		const e = await p;
		R.optionReads = log.join(",");
		R.userActivationProp = String("userActivation" in e) + ":" + String(e.userActivation);
		// delegate validation errors
		const tryPost = (o) => { try { postMessage("y", o); return "ok"; } catch (x) { return "throws:" + x.name; } };
		R.delegateBogus = tryPost({ targetOrigin: "*", delegate: "bogus" });
		R.delegatePaymentNoActivation = tryPost({ targetOrigin: "*", delegate: "payment" });
		R.delegateFullscreenStarTarget = tryPost({ targetOrigin: "*", delegate: "fullscreen" });
		R.delegateFullscreenNoActivation = tryPost({ targetOrigin: location.origin, delegate: "fullscreen" });
		// includeUserActivation: the receiving event's userActivation
		const p2 = new Promise((res) => addEventListener("message", (e) => { if (e.data === "ua") res(e); }));
		postMessage("ua", { targetOrigin: "*", includeUserActivation: true });
		const e2 = await p2;
		R.includeUA = String(e2.userActivation === null ? "null" : typeof e2.userActivation);
		${report}
	`,
		() => ({})
	),
] as Test[];
