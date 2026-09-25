import { basicTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + String(e.message).replace(/https?:[^ ']*/g, "URL"); } assertConsistent(label, v === undefined ? "UNDEF" : v); };
const logger = (names, extra = {}) => { const log = []; const o = {}; for (const n of names) Object.defineProperty(o, n, { get() { log.push(n); return extra[n]; }, enumerable: true }); return [o, log]; };`;

export default [
	basicTest({
		name: "rv3-idl-dicts",
		js: `${C}
c("ael-order", () => { const [o, log] = logger(["signal", "passive", "once", "capture", "zzz"]); addEventListener("rv3o", () => {}, o); return log.join(","); });
c("rel-order", () => { const [o, log] = logger(["signal", "passive", "once", "capture"]); removeEventListener("rv3o", () => {}, o); return log.join(","); });
c("ael-signal-null", () => { addEventListener("rv3s", () => {}, { signal: null }); return "ok"; });
c("ael-signal-undef", () => { addEventListener("rv3s", () => {}, { signal: undefined }); return "ok"; });
c("ael-signal-obj", () => { addEventListener("rv3s", () => {}, { signal: {} }); return "ok"; });
c("ael-signal-aborted", () => { let n = 0; const ac = new AbortController(); ac.abort(); addEventListener("rv3sa", () => n++, { signal: ac.signal }); dispatchEvent(new Event("rv3sa")); return n; });
c("ael-once-str", () => { let n = 0; addEventListener("rv3once", () => n++, { once: "yes" }); dispatchEvent(new Event("rv3once")); dispatchEvent(new Event("rv3once")); return n; });
c("ael-opts-num", () => { let n = 0; const f = () => n++; addEventListener("rv3n", f, 1); removeEventListener("rv3n", f, true); dispatchEvent(new Event("rv3n")); return n; });
c("ael-dup", () => { let n = 0; const f = () => n++; addEventListener("rv3d", f); addEventListener("rv3d", f, {}); addEventListener("rv3d", f, false); dispatchEvent(new Event("rv3d")); removeEventListener("rv3d", f); return n; });
c("ael-dup-capture", () => { let n = 0; const f = () => n++; addEventListener("rv3d2", f, true); addEventListener("rv3d2", f, false); dispatchEvent(new Event("rv3d2")); removeEventListener("rv3d2", f, {capture: true}); dispatchEvent(new Event("rv3d2")); return n; });
c("worker-order", () => { const [o, log] = logger(["type", "name", "credentials"]); const w = new Worker(URL.createObjectURL(new Blob([""], {type: "text/javascript"})), o); w.terminate(); return log.join(","); });
c("worker-name-null", () => { const w = new Worker(URL.createObjectURL(new Blob(["postMessage(self.name)"], {type: "text/javascript"})), { name: null }); w.terminate(); return 1; });
c("es-order", () => { const [o, log] = logger(["withCredentials", "other"]); const e = new EventSource("/es", o); e.close(); return log.join(","); });
c("fetch-init-getters", () => { const [o, log] = logger(["method", "headers", "body", "mode", "credentials", "cache", "redirect", "referrer", "referrerPolicy", "integrity", "keepalive", "signal", "window", "duplex", "priority"]); try { new Request("/r", o); } catch (e) {} return log.join(","); });
c("open-null-features", () => { const w = open("about:blank", "rv3win1", null); if (!w) return "blocked"; const v = [w.menubar.visible, w.toolbar.visible]; w.close(); return JSON.stringify(v); });
c("open-empty-features", () => { const w = open("about:blank", "rv3win2", ""); if (!w) return "blocked"; const v = [w.menubar.visible, w.toolbar.visible]; w.close(); return JSON.stringify(v); });
c("open-undef-name", () => { const w = open("about:blank", undefined); if (!w) return "blocked"; const v = w.name; w.close(); return JSON.stringify(v); });
c("open-null-name", () => { const w = open("about:blank", null); if (!w) return "blocked"; const v = w.name; w.close(); return JSON.stringify(v); });
c("open-null-url", () => { const w = open(null, "rv3win3"); if (!w) return "blocked"; const v = w.location.href; w.close(); return v.replace(/:\\d+/, ""); });
c("open-noopener-null", () => String(open("about:blank", "_blank", "noopener")));
`,
	}),
];
