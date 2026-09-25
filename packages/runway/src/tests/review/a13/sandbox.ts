import { htmlTest } from "../../../testcommon.ts";

// The `sandbox` rule strips the attribute from the live iframe, so none of the
// sandbox's restrictions apply. Probe what sandboxed content can do.

export default [
	htmlTest({
		name: "rv13-sandbox-restrictions",
		html: `<!doctype html><body>
<iframe id=f1 sandbox srcdoc="<script>try { parent.RAN1 = 1 } catch (e) {}</script><p>x</p>"></iframe>
<iframe id=f2 sandbox="allow-scripts" srcdoc="<script>var r; try { r = typeof parent.document.body + ':' + (parent.SECRET) } catch (e) { r = 'blocked:' + e.name } parent.postMessage({ k: 'f2', r: r }, '*')</script>"></iframe>
<iframe id=f3 sandbox="allow-scripts" srcdoc="<script>var r; try { r = document.cookie = 'sbx=1'; r = 'cookie-ok:' + document.cookie } catch (e) { r = 'blocked:' + e.name } parent.postMessage({ k: 'f3', r: r }, '*')</script>"></iframe>
<iframe id=f4 sandbox="allow-scripts" srcdoc="<script>var r; try { localStorage.setItem('sbx', '1'); r = 'ls-ok' } catch (e) { r = 'blocked:' + e.name } parent.postMessage({ k: 'f4', r: r }, '*')</script>"></iframe>
<iframe id=f5 sandbox="allow-scripts" srcdoc="<script>var w = null; try { w = window.open('about:blank') } catch (e) {} parent.postMessage({ k: 'f5', r: w ? 'popup-opened' : 'popup-blocked' }, '*'); if (w) w.close()</script>"></iframe>
<iframe id=f6 sandbox="allow-scripts" srcdoc="<script>parent.postMessage({ k: 'f6', r: String(self.origin) }, '*')</script>"></iframe>
<script>
window.SECRET = "s3cret";
const got = {};
addEventListener("message", (e) => { if (e.data && e.data.k) got[e.data.k] = e.data.r; });
runTest(async () => {
	await new Promise((r) => setTimeout(r, 1500));
	assertConsistent("no allow-scripts: script ran", String(window.RAN1));
	for (const k of ["f2", "f3", "f4", "f5", "f6"]) assertConsistent(k, String(got[k]));
	assertConsistent("sandbox attr", [document.getElementById("f2").getAttribute("sandbox"), document.getElementById("f2").sandbox.value].join("|"));
	// script-set sandbox on a fresh frame
	const f7 = document.createElement("iframe");
	f7.setAttribute("sandbox", "");
	f7.srcdoc = "<script>parent.RAN7 = 1<" + "/script>";
	document.body.append(f7);
	await new Promise((r) => setTimeout(r, 800));
	assertConsistent("script-set sandbox: script ran", String(window.RAN7));
}, true);
</script></body>`,
	}),
];
