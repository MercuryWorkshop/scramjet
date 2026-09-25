import { site, page } from "./lib.ts";

const workerBody = `
const out = {};
const g = async (k, f) => { try { out[k] = (await f()).default; } catch (e) { out[k] = "ERR " + e.name + ": " + String(e.message).replace(/localhost:[0-9]+/g, "HOST").slice(0, 90); } };
(async () => {
  await g("rel", () => import("./m.js"));
  await g("abs", () => import("/w/m.js"));
  await g("data", () => import("data:text/javascript,export default 'data'"));
  await g("blob", () => import(URL.createObjectURL(new Blob(["export default 'blob'"], { type: "text/javascript" }))));
  out.meta = typeof importScripts;
  postMessage(out);
})();
`;

export default [
	site("rv16-worker-import", {
		"/w/m.js": "export default 'wm';",
		"/w/classic.js": workerBody,
		"/w/module.js": workerBody,
		"/": page(`
const run = (w) => new Promise((r) => { w.onmessage = (e) => r(JSON.stringify(e.data)); w.onerror = (e) => r("onerror " + (e.message || "")); setTimeout(() => r("timeout"), 4000); });
c("classic", await run(new Worker("/w/classic.js")));
c("module", await run(new Worker("/w/module.js", { type: "module" })));
`),
	}),
];
