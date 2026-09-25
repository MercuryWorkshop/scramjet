import { htmlTest } from "../../../testcommon.ts";
export default [
	htmlTest({
		name: "rv0-alpine-probe",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<script>
window.__log = [];
document.addEventListener("alpine:init", () => __log.push("init"));
document.addEventListener("alpine:initialized", () => __log.push("initialized"));
</script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>
</head><body>
<div x-data="{ n: 1 }" id="root"><span id="s" x-text="'n=' + n">raw</span></div>
<script>
runTest(async () => {
	await new Promise((r) => setTimeout(r, 2500));
	const root = document.getElementById("root");
	const info = {
		log: __log,
		qsa: document.querySelectorAll("[x-data]").length,
		attrs: Array.from(root.attributes).map((a) => a.name + "=" + a.value),
		dataStack: !!root._x_dataStack,
		text: document.getElementById("s").textContent,
	};
	try { info.evaluate = Alpine.evaluate(root, "n + 1"); } catch (e) { info.evalErr = String(e); }
	try { info.asyncCtor = String(Object.getPrototypeOf(async function(){}).constructor === Function); const AF = Object.getPrototypeOf(async function(){}).constructor; info.af = await new AF("return 7")(); } catch (e) { info.afErr = String(e); }
	try { Alpine.initTree(root); info.afterManual = document.getElementById("s").textContent; } catch (e) { info.manualErr = String(e && e.stack || e).slice(0, 400); }
	fail("ALPINEPROBE " + JSON.stringify(info));
}, false);
</script></body></html>`,
	}),
];
