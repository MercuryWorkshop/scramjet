import { serverTest } from "../../../testcommon.ts";

const files: Record<string, string> = {
	"/dep.js": "export const dep = location.host;",
	"/mod.js":
		"import { dep } from './dep.js'; window.__mods = (window.__mods || []).concat('mod:' + dep + ':' + typeof import.meta.url);",
	"/mod2.js":
		"import { dep } from './dep.js'; window.__mods = (window.__mods || []).concat('mod2:' + dep);",
	"/mod3.js":
		"import { dep } from './dep.js'; window.__mods = (window.__mods || []).concat('mod3:' + dep);",
	"/mod4.js":
		"import { dep } from './dep.js'; window.__mods = (window.__mods || []).concat('mod4:' + dep);",
};

export default [
	serverTest({
		name: "rv2-modules-type-after-src",
		autoPass: true,
		js: `
			const load = (setup) => new Promise((res) => { const s = document.createElement("script"); setup(s); s.onload = () => res("load"); s.onerror = () => res("error"); document.head.appendChild(s); setTimeout(() => res("timeout"), 3000); });
			const r = [];
			r.push(await load((s) => { s.type = "module"; s.src = "/mod.js"; }));
			r.push(await load((s) => { s.src = "/mod2.js"; s.type = "module"; }));
			r.push(await load((s) => { s.setAttribute("src", "/mod3.js"); s.setAttribute("type", "module"); }));
			r.push(await load((s) => { s.innerHTML = ""; s.src = "/mod4.js"; s.setAttribute("TYPE", "module"); }));
			await new Promise((res) => setTimeout(res, 200));
			assertConsistent("events", r.join(","));
			assertConsistent("ran", (window.__mods || []).sort().join(","));
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				const src = files[path];
				if (src === undefined) return;
				res.writeHead(200, {
					"Content-Type": "application/javascript",
				});
				res.end(src);
			});
		},
	}),
];
