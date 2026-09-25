import { basicTest } from "../../../testcommon.ts";

// browser.js (packages/chrome/src/proxy/scramjet.ts) runs scramjet with
// defaultConfigDev.flags, i.e. debugTrampolines: true. Measure under both.
const js = `
	const med = (a) => { a.sort((x, y) => x - y); return +a[a.length >> 1].toFixed(2); };
	const install = [];
	for (let i = 0; i < 12; i++) {
		const f = document.createElement("iframe");
		document.body.appendChild(f);
		const t = performance.now();
		f.contentWindow.document;
		install.push(performance.now() - t);
	}
	const bench = (fn, n) => { fn(0); const t = performance.now(); for (let i = 0; i < n; i++) fn(i); return +((performance.now() - t) * 1000 / n).toFixed(2); };
	const d = document.createElement("div"); document.body.appendChild(d);
	const a = document.createElement("a");
	const res = {
		install_ms: med(install),
		append_us: bench(() => { d.append("x"); d.firstChild.remove(); }, 5000),
		setAttr_us: bench((i) => a.setAttribute("data-x", i), 5000),
		href_us: bench((i) => { a.href = "/p" + (i & 7); }, 3000),
		addrm_listener_us: bench(() => { const f = () => {}; d.addEventListener("click", f); d.removeEventListener("click", f); }, 5000),
		getAttr_us: bench(() => a.getAttribute("href"), 5000),
		classList_us: bench((i) => d.classList.toggle("c" + (i & 3)), 5000),
		qs_us: bench(() => document.querySelector("div"), 5000),
	};
	console.log("RV10PERF " + JSON.stringify(res));
	fail("RV10PERF " + JSON.stringify(res));
`;

const on = basicTest({
	name: "rv10-prodflags-perf-trampolines-on",
	js,
	autoPass: false,
	scramjetOnly: true,
});
(on as any).debugTrampolines = true;
const off = basicTest({
	name: "rv10-prodflags-perf-trampolines-off",
	js,
	autoPass: false,
	scramjetOnly: true,
});
(off as any).debugTrampolines = false;

export default [on, off];
