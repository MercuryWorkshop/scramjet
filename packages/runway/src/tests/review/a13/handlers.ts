import { htmlTest } from "../../../testcommon.ts";

// Event handler content attributes missing from `eventAttributes`
// (shared/rewriters/html.ts) are neither rewritten by the SW nor by the
// attribute layer, so their code runs against the real globals.

export default [
	htmlTest({
		name: "rv13-handlers-unlisted",
		html: `<!doctype html><body onhashchange="window.R_hash = location.href" onpageshow="window.R_pageshow = location.href" onpopstate="window.R_popstate = location.href" onbeforeprint="0">
<div id=d onbeforecopy="window.R_beforecopy = location.href" onanimationcancel="window.R_animcancel = location.href"></div>
<button id=b oncommand="window.R_command = location.href"></button>
<script>
runTest(async () => {
	const d = document.getElementById("d"), b = document.getElementById("b");
	location.hash = "#h1";
	await new Promise((r) => setTimeout(r, 300));
	history.pushState(null, "", location.pathname + "?p=1" + location.hash);
	dispatchEvent(new PopStateEvent("popstate"));
	d.dispatchEvent(new Event("beforecopy"));
	d.dispatchEvent(new Event("animationcancel"));
	b.dispatchEvent(new Event("command"));
	// script-set content attributes
	document.body.setAttribute("onmessage", "window.R_message = location.href");
	postMessage("x", "*");
	const e = document.createElement("div");
	e.setAttribute("onbeforepaste", "window.R_beforepaste = location.href");
	e.dispatchEvent(new Event("beforepaste"));
	document.body.setAttribute("onstorage", "window.R_storage = location.href");
	dispatchEvent(new StorageEvent("storage"));
	await new Promise((r) => setTimeout(r, 300));
	const clean = (v) => typeof v === "string" ? v.replace(/#.*$/, "").replace(/\\?p=1$/, "") : String(v);
	for (const k of ["hash", "pageshow", "popstate", "beforecopy", "animcancel", "command", "message", "beforepaste", "storage"]) assertConsistent(k, clean(window["R_" + k]));
	assertConsistent("attr readback", [document.body.getAttribute("onhashchange"), d.getAttribute("onbeforecopy")].join(" | "));
}, true);
</script></body>`,
	}),
];
