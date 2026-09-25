import { basicTest } from "../../../testcommon.ts";

// small fidelity checks found while sweeping the interception layer. Run
// WITHOUT RUNWAY_FAST (assertConsistent against bare Chrome).
export default [
	basicTest({
		name: "rv12-misc",
		js: String.raw`
const R = {};
const T = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 100); } R[label] = v; };
const el = document.createElement("a");
T("setAttribute invalid name", () => { el.setAttribute("1bad", "x"); return "no throw"; });
T("setAttribute invalid name href-like", () => { el.setAttribute("href x", "/y"); return "no throw"; });
T("toggleAttribute invalid", () => { el.toggleAttribute("1bad"); return "no throw"; });
T("new Request bad url", () => { new Request("http://a b"); return "no throw"; });
T("new Request credentials url", () => { new Request("http://u:p@example.com/"); return "no throw"; });
T("Storage.clear fake receiver", () => { Storage.prototype.clear.call({}); return "no throw"; });
T("Storage.clear fake proto receiver", () => { Storage.prototype.clear.call(Object.create(Storage.prototype)); return "no throw"; });
T("console.log assignable", () => { const f = function () {}; const o = console.log; console.log = f; const ok = console.log === f; console.log = o; return ok; });
for (const [k, v] of Object.entries(R)) assertConsistent(k, v);
const p = caches.match("http://[bad").then(() => "resolved", (e) => e.name + ": " + e.message + " " + (e instanceof TypeError));
assertConsistent("caches.match bad url", await p);
`,
	}),
];
