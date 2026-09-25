import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv2-reexec-scripts",
		autoPass: true,
		js: `
			window.__rx = [];
			const html = "<div id=w><script>window.__rx.push('inline:' + location.host)<\\/script><script src='/ext.js' data-x=1 async><\\/script><script type=module>window.__rx.push('mod:' + import.meta.url.length)<\\/script><script type='application/json' id=cfg>{\\"a\\":1}<\\/script></div>";
			const div = document.createElement("div");
			div.innerHTML = html;
			document.body.appendChild(div);
			const loads = [];
			div.querySelectorAll("script").forEach((old) => {
				const s = document.createElement("script");
				for (const a of old.attributes) s.setAttribute(a.name, a.value);
				s.textContent = old.textContent;
				if (s.src) loads.push(new Promise((r) => { s.onload = r; s.onerror = r; }));
				old.replaceWith(s);
			});
			await Promise.all(loads);
			await new Promise((r) => setTimeout(r, 300));
			assertConsistent("ran", window.__rx.sort().join(","));
			assertConsistent("cfg", document.getElementById("cfg").textContent);
			assertConsistent("attrs", Array.from(div.querySelectorAll("script")).map((s) => s.getAttributeNames().join("+")).join(" "));
		`,
		start: async (server) => {
			server.on("request", (req, res) => {
				if ((req.url ?? "").startsWith("/ext.js")) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						"window.__rx.push('ext:' + document.currentScript.getAttribute('data-x') + ':' + location.host)"
					);
				}
			});
		},
	}),
];
