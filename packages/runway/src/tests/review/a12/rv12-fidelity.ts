import { serverTest } from "../../../testcommon.ts";
import fs from "node:fs";

// Dumps the shape of every member of every global interface (prototype
// chain + statics + the global's own members) and the result of calling each
// prototype method/getter with a fake receiver, in bare Chrome and through
// scramjet, to scratch-a12/fid-<build>-<sj|bare>.json. Diff offline.
// Run WITHOUT RUNWAY_FAST so the bare run happens too.
const build = process.cwd().includes("/sjreview/main/") ? "main" : "dev";
const OUT = "/home/velzie/.cache/sjreview/scratch-a12";

export const FIDELITY = String.raw`
function fidelity(g) {
  const FTS = Function.prototype.toString;
  const out = { members: {}, order: {}, calls: {} };
  const isCtor = (f) => { try { Reflect.construct(String, [], f); return true; } catch (e) { return false; } };
  const fsig = (f) => { if (typeof f !== "function") return typeof f; let ts; try { ts = FTS.call(f); } catch (e) { ts = "THROW " + e.message; } let own; try { own = Reflect.ownKeys(f).map(String).join(","); } catch (e) { own = "?"; } return { name: f.name, length: f.length, ts: ts.length > 200 ? ts.slice(0, 200) + "…" : ts, own, ctor: isCtor(f), proto: Object.getPrototypeOf(f) === g.Function.prototype ? "FP" : String(Object.getPrototypeOf(f) && Object.getPrototypeOf(f).name) }; };
  const dsig = (d) => { const s = { k: Object.keys(d).join(","), e: d.enumerable, c: d.configurable, w: d.writable }; if ("value" in d) s.v = typeof d.value === "function" ? fsig(d.value) : typeof d.value; if (d.get) s.g = fsig(d.get); if (d.set) s.s = fsig(d.set); return s; };
  const errsig = (e) => e && typeof e === "object" ? (e.constructor && e.constructor.name) + ": " + String(e.message).slice(0, 160) : "nonobj " + String(e).slice(0, 80);
  const seen = new Set();
  const dumpObj = (label, o, callable) => {
    if (!o || seen.has(o)) return; seen.add(o);
    let keys; try { keys = Reflect.ownKeys(o); } catch (e) { return; }
    out.order[label] = keys.map(String).join(",");
    for (const k of keys) {
      if (typeof k === "symbol" && k !== Symbol.iterator && k !== Symbol.toStringTag && k !== Symbol.toPrimitive && k !== Symbol.asyncIterator) continue;
      const d = Object.getOwnPropertyDescriptor(o, k);
      const key = label + "." + String(k);
      out.members[key] = dsig(d);
      if (callable && k !== "constructor") {
        const fake = Object.create(o);
        const tryit = (fn, args) => { try { const r = Reflect.apply(fn, fake, args); if (r && typeof r.then === "function") { r.catch(() => {}); return "promise"; } return "ok " + typeof r; } catch (e) { return errsig(e); } };
        if (typeof d.value === "function") out.calls[key] = tryit(d.value, []);
        if (d.get) out.calls[key + "#get"] = tryit(d.get, []);
        if (d.set) out.calls[key + "#set"] = tryit(d.set, [undefined]);
      }
    }
  };
  const skipCall = /^(Location)$/;
  for (const name of Object.getOwnPropertyNames(g)) {
    let v; try { v = g[name]; } catch (e) { continue; }
    if (typeof v !== "function" || !/^[A-Z]/.test(name)) continue;
    dumpObj(name + "(static)", v, false);
    let p = v.prototype, depth = 0;
    while (p && p !== g.Object.prototype && depth < 12) {
      const cd = Object.getOwnPropertyDescriptor(p, "constructor");
      const pn = cd && typeof cd.value === "function" ? cd.value.name : name + "^" + depth;
      dumpObj(pn + ".prototype", p, !skipCall.test(pn));
      p = Object.getPrototypeOf(p); depth++;
    }
  }
  dumpObj("GLOBAL", g, false);
  for (const o of ["console", "CSS", "JSON", "Math", "Reflect"]) dumpObj(o + "(obj)", g[o], false);
  return out;
}
`;

export default [
	serverTest({
		name: "rv12-fidelity",
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (!req.url.startsWith("/report")) return;
				let body = "";
				req.on("data", (c: any) => (body += c));
				req.on("end", () => {
					const mode = req.url.includes("sj=1") ? "sj" : "bare";
					fs.writeFileSync(`${OUT}/fid-${build}-${mode}.json`, body);
					res.writeHead(200);
					res.end("ok");
				});
			});
		},
		js: `
${FIDELITY}
const sj = Symbol.for("scramjet client global") in window;
const data = fidelity(window);
await fetch("/report?sj=" + (sj ? 1 : 0), { method: "POST", body: JSON.stringify(data) });
pass();
`,
	}),
];
