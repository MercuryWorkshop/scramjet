import { serverTest } from "../../../testcommon.ts";
import fs from "node:fs";

// Enumerates every patch the client installs in a fresh window realm
// (a raw about:blank iframe, hooked by hand with an instrumented client),
// on either build, and dumps it to scratch-a12/enum-<build>.json.
const build = process.cwd().includes("/sjreview/main/") ? "main" : "dev";
const OUT = "/home/velzie/.cache/sjreview/scratch-a12";

function reporter(name: string) {
	return (server: any) => {
		server.on("request", (req: any, res: any) => {
			if (!req.url.startsWith("/report")) return;
			let body = "";
			req.on("data", (c: any) => (body += c));
			req.on("end", () => {
				fs.writeFileSync(`${OUT}/${name}-${build}.json`, body);
				res.writeHead(200);
				res.end("ok");
			});
		});
	};
}

export const INSTR = `
function instrument(w, parentClient) {
  const c = new parentClient.constructor(w, parentClient.init);
  const nm = (o) => { try { if (o === w) return "window"; if (typeof o === "function") return (o.name || "?") + "(static)"; const d = Object.getOwnPropertyDescriptor(o, "constructor"); if (d && typeof d.value === "function") return d.value.name + ".prototype"; return Object.prototype.toString.call(o); } catch (e) { return "?"; } };
  const whereOwn = (t, k) => { let o = t; while (o) { const d = Object.getOwnPropertyDescriptor(o, k); if (d) return { owner: nm(o), d }; o = Object.getPrototypeOf(o); } return null; };
  const log = { raw: [], skips: [], installs: [], nullpath: [], intercepts: [], errors: [], resolved: [], mismatch: [], globalStatics: [] };
  const origRP = c.RawProxy, origRT = c.RawTrap;
  c.RawProxy = function (target, prop, handler, dn) {
    const wo = target && prop ? whereOwn(target, prop) : null;
    log.raw.push({ kind: "proxy", name: dn || prop, target: nm(target), owner: wo && wo.owner, own: !!(target && Object.getOwnPropertyDescriptor(target, prop)) });
    return origRP.apply(this, arguments);
  };
  c.RawTrap = function (target, prop, handler, dn) {
    const wo = target && prop ? whereOwn(target, prop) : null;
    log.raw.push({ kind: "trap", name: dn || prop, target: nm(target), owner: wo && wo.owner, own: !!(target && Object.getOwnPropertyDescriptor(target, prop)), accessor: !!(wo && (wo.d.get || wo.d.set)), get: !!handler.get, set: !!handler.set });
    return origRT.apply(this, arguments);
  };
  if (c.resolvePath) {
    const orp = c.resolvePath;
    c.resolvePath = function (name) { const r = orp.call(this, name); if (!r) log.nullpath.push(name); return r; };
  }
  if (c.resolveNative) {
    const orn = c.resolveNative;
    c.resolveNative = function (target, key, dn) {
      const r = orn.call(this, target, key, dn);
      if (r) { const tn = nm(target), on = nm(r.owner); log.resolved.push({ name: dn, target: tn, owner: on, kind: r.descriptor.get || r.descriptor.set ? "acc" : typeof r.descriptor.value }); }
      if (!r) { const wo = whereOwn(target, key); log.skips.push({ name: dn, key: String(key), target: nm(target), reason: !wo ? "absent" : !wo.d.configurable ? "nonconfigurable" : "already", owner: wo && wo.owner }); }
      return r;
    };
    const oin = c.installNative;
    c.installNative = function (native, next) {
      log.installs.push({ owner: nm(native.owner), key: String(native.key), kinds: Object.keys(next).join(",") });
      return oin.call(this, native, next);
    };
  }
  if (c.Intercept) {
    const oi = c.Intercept;
    c.Intercept = function (handler, cr) {
      const base = Object.getPrototypeOf(handler);
      log.intercepts.push({ base: base && base.name, present: !!(base && (base.name in w)) , members: Reflect.ownKeys(handler.prototype).map(String).filter(k=>k!=="constructor"), statics: Reflect.ownKeys(handler).map(String).filter(k=>!["length","name","prototype"].includes(k)) });
      try {
        const isg = base && base.name === "" ;
        const isGlob = !(base && base.name && typeof w[base.name] === "function"); const bc = isGlob ? w : w[base.name];
        const chk = (hdescs, tgt, where) => { for (const k of Reflect.ownKeys(hdescs)) { if (["constructor","prototype","length","name"].includes(k) || typeof k === "symbol") continue; const hd = hdescs[k]; const wo = tgt ? whereOwn(tgt, k) : null; if (!wo) continue; const nd = wo.d; const hk = (hd.get?"g":"")+(hd.set?"s":"")+("value" in hd?"v":""); const nk = (nd.get?"g":"")+(nd.set?"s":"")+("value" in nd?"v":""); const bad = (hk.includes("v") && !nk.includes("v")) || (!hk.includes("v") && nk.includes("v")) || (hk.includes("g") && !nk.includes("g")) || (hk.includes("s") && !nk.includes("s")); if (bad) log.mismatch.push({ base: base.name || "GlobalScope", where, key: k, handler: hk, native: nk, nativeType: typeof nd.value }); } };
        if (bc) { if (!isGlob) chk(Object.getOwnPropertyDescriptors(handler.prototype), bc.prototype, "proto"); else log.globalStatics.push(Reflect.ownKeys(handler).map(String)); chk(Object.getOwnPropertyDescriptors(handler), bc, "static"); }
      } catch (e) { log.errors.push("chk " + e); }
      return oi.apply(this, arguments);
    };
  }
  const oerr = w.console.error;
  const cerr = console.error;
  const cap = function () { try { log.errors.push(Array.from(arguments).map(String).join(" ").replace(/%c/g, "").slice(0, 300)); } catch (e) {} };
  console.error = function () { cap.apply(null, arguments); return cerr.apply(this, arguments); };
  try { c.hook(); } catch (e) { log.errors.push("HOOK THREW " + e); }
  console.error = cerr;
  return { c, log };
}
`;

export default [
	serverTest({
		name: "rv12-enum-window",
		scramjetOnly: true,
		start: async (server) => reporter("enum-window")(server),
		js: `
${INSTR}
const SJ = Symbol.for("scramjet client global");
const parentClient = window[SJ];
const f = document.createElement("iframe");
document.body.appendChild(f);
const w = window[0];
assert(!(SJ in w), "frame already hooked");
const { log } = instrument(w, parentClient);
await fetch("/report", { method: "POST", body: JSON.stringify(log) });
pass();
`,
	}),
];
