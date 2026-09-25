import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const report = `
	const keys = Object.keys(R).sort();
	console.log("RV21", JSON.stringify(R));
	for (const k of keys) assertConsistent(k, R[k]);
`;
const S = (f) => {
	try {
		const v = f();
		return typeof v === "string" ? v : JSON.stringify(v);
	} catch (e) {
		return "throws:" + e.name;
	}
};

export default [
	withOrigins(
		"rv21-fid-wrapper",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const seen = [];
		const wm = new WeakMap();
		await new Promise((res) => {
			const l1 = (e) => {
				seen.push(e); wm.set(e, 1);
				R.instanceofME = S(() => e instanceof MessageEvent);
				R.instanceofEvent = S(() => e instanceof Event);
				R.ctor = S(() => e.constructor === MessageEvent);
				R.proto = S(() => Object.getPrototypeOf(e) === MessageEvent.prototype);
				R.toStringTag = S(() => Object.prototype.toString.call(e));
				R.ownKeys = S(() => Reflect.ownKeys(e).map(String));
				R.keys = S(() => Object.keys(e));
				R.json = S(() => JSON.stringify(e));
				R.descData = S(() => String(Object.getOwnPropertyDescriptor(e, "data")));
				R.descTrusted = S(() => { const d = Object.getOwnPropertyDescriptor(e, "isTrusted"); return typeof d.get + d.configurable; });
				R.inData = S(() => "data" in e);
				R.dataIdentity = S(() => e.data === e.data);
				R.data = S(() => e.data);
				R.origin = S(() => e.origin === location.origin);
				R.source = S(() => e.source === window);
				R.ports = S(() => [Array.isArray(e.ports), Object.isFrozen(e.ports), e.ports === e.ports, e.ports.length]);
				R.lastEventId = S(() => e.lastEventId);
				R.windowEvent = S(() => window.event === e);
				R.composedPath = S(() => e.composedPath().length + ":" + (e.composedPath()[0] === window));
				R.target = S(() => [e.target === window, e.currentTarget === window, e.eventPhase, e.srcElement === window]);
				R.cancelable = S(() => [e.cancelable, e.bubbles, e.composed, e.defaultPrevented, e.returnValue, e.cancelBubble]);
				R.pdThenDP = S(() => { e.preventDefault(); return e.defaultPrevented; });
				R.protoPD = S(() => { Event.prototype.preventDefault.call(e); return "ok"; });
				R.protoData = S(() => Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data").get.call(e));
				R.protoOrigin = S(() => Object.getOwnPropertyDescriptor(MessageEvent.prototype, "origin").get.call(e) === location.origin);
				R.protoType = S(() => Object.getOwnPropertyDescriptor(Event.prototype, "type").get.call(e));
				R.reflectGet = S(() => Reflect.get(MessageEvent.prototype, "data", e));
				R.methodIdentity = S(() => e.stopPropagation === e.stopPropagation && e.stopPropagation === Event.prototype.stopPropagation);
				R.methodName = S(() => e.stopPropagation.name + "/" + e.stopPropagation.length + "/" + Function.prototype.toString.call(e.stopPropagation));
				R.structuredClone = S(() => structuredClone(e.data));
				R.structuredCloneEvent = S(() => structuredClone(e));
				R.copyME = S(() => { const c = new MessageEvent("message", e); return [c.data, c.origin === location.origin, c.source === window, c.lastEventId]; });
				R.copyEv = S(() => { const c = new Event("x", e); return [c.bubbles, c.cancelable]; });
				R.spread = S(() => { const c = { ...e }; return Object.keys(c); });
				R.assign = S(() => { e.rv21 = 5; return e.rv21; });
				R.defineProp = S(() => { Object.defineProperty(e, "rv21b", { value: 1 }); return e.rv21b; });
				R.freezeable = S(() => Object.isExtensible(e));
				R.initME = S(() => { e.initMessageEvent("zz", false, false, "d"); return e.type + ":" + e.data; });
				R.stopImm = S(() => { e.stopImmediatePropagation(); return "ok"; });
			};
			const l2 = (e) => { R.l2ran = "yes"; };
			addEventListener("message", l1);
			addEventListener("message", l2);
			onmessage = (e) => { R.onmsgran = "yes"; };
			postMessage({ a: 1, $scramjet$data: "x", nested: { $scramjet$origin: "evil" } }, "*");
			setTimeout(() => { removeEventListener("message", l1); removeEventListener("message", l2); onmessage = null; res(); }, 300);
		});
		// after dispatch
		const e = seen[0];
		R.afterData = S(() => e.data);
		R.afterWindowEvent = S(() => String(window.event));
		R.redispatchWin = await new Promise((res) => {
			const d = document.createElement("div");
			d.addEventListener("zz", (ev) => res(S(() => [ev === e, ev.data, ev.isTrusted, typeof ev.origin])));
			d.addEventListener("message", (ev) => res(S(() => [ev === e, ev.data, ev.isTrusted])));
			try { d.dispatchEvent(e); } catch (x) { res("throws:" + x.name); }
			setTimeout(() => res("none"), 300);
		});
		R.l2afterStopImm = R.l2ran || "no";
		R.onmsgAfterStopImm = R.onmsgran || "no";
		${report}
	`,
		() => ({})
	),
	withOrigins(
		"rv21-fid-identity",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const evs = [];
		const obj = { handleEvent(e) { evs.push(["obj", e]); } };
		await new Promise((res) => {
			addEventListener("message", (e) => evs.push(["fn", e]));
			addEventListener("message", obj);
			addEventListener("message", (e) => evs.push(["cap", e]), true);
			onmessage = (e) => evs.push(["on", e]);
			document.body.setAttribute("onmessage", "window.__rv21attr = event");
			postMessage("hi", "*");
			setTimeout(res, 300);
		});
		R.order = S(() => evs.map((x) => x[0]));
		R.allSame = S(() => evs.every((x) => x[1] === evs[0][1]));
		R.attrSame = S(() => window.__rv21attr === evs[0][1]);
		R.attrData = S(() => window.__rv21attr && window.__rv21attr.data);
		R.data = S(() => evs.map((x) => x[1].data));
		// stopImmediatePropagation in the first stops the rest
		const ran = [];
		await new Promise((res) => {
			const a = (e) => { ran.push("a"); e.stopImmediatePropagation(); };
			const b = () => ran.push("b");
			addEventListener("message", a); addEventListener("message", b);
			postMessage("s", "*");
			setTimeout(() => { removeEventListener("message", a); removeEventListener("message", b); res(); }, 300);
		});
		R.stopImm = S(() => ran);
		${report}
	`,
		() => ({})
	),
	withOrigins(
		"rv21-fid-hashchange",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const e = await new Promise((res) => { addEventListener("hashchange", res, { once: true }); location.hash = "rv21"; });
		R.newURL = S(() => e.newURL === location.href);
		R.oldURL = S(() => e.oldURL === location.href.replace("#rv21", ""));
		R.inst = S(() => [e instanceof HashChangeEvent, e.constructor === HashChangeEvent, Object.prototype.toString.call(e)]);
		R.copy = S(() => { const c = new HashChangeEvent("hashchange", e); return c.newURL === location.href; });
		R.proto = S(() => Object.getOwnPropertyDescriptor(HashChangeEvent.prototype, "newURL").get.call(e) === location.href);
		R.pop = await new Promise((res) => { addEventListener("popstate", (p) => res(S(() => [p.state, p instanceof PopStateEvent, p.hasUAVisualTransition])), { once: true }); history.back(); setTimeout(() => res("none"), 1000); });
		${report}
	`,
		() => ({})
	),
] as Test[];
