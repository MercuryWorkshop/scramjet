import { serverTest } from "../../../testcommon.ts";
import { probeServer } from "./matrix.ts";

export default [
	serverTest({
		name: "rv19-blank-script-probe",
		autoPass: true,
		js: `
			const out = {};
			const f = document.createElement("iframe"); document.body.appendChild(f);
			const d = f.contentDocument;
			const s0 = d.createElement("script"); s0.textContent = "self.inlineRan = 1; self.lsv = (()=>{try{return localStorage.getItem('x')}catch(e){return 'ERR'+e}})()"; d.body.appendChild(s0);
			out.inlineRan = f.contentWindow.inlineRan;
			out.lsv = f.contentWindow.lsv;
			const s = d.createElement("script"); s.src = location.origin + "/ext.js";
			out.ext = await new Promise((res) => { s.onload = () => res("load:" + f.contentWindow.extRan); s.onerror = () => res("error"); setTimeout(() => res("timeout"), 3000); d.body.appendChild(s); });
			assertConsistent("out", out);
			fail(JSON.stringify(out));
		`,
		start: async (server, port) =>
			probeServer(server, port, (req, res, path) => {
				if (path === "/ext.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end("self.extRan = 1;");
					return true;
				}
				return false;
			}),
	}),
];
