import { htmlTest } from "../../../testcommon.ts";

// Monitoring / polyfill libraries monkey-patch the very prototypes scramjet
// intercepts (XHR.open/send, fetch, EventTarget.addEventListener, history,
// setTimeout, console, Promise). Load the real bundles, then exercise those
// APIs and check the page still works.
const exercise = `
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	// fetch
	const r = await fetch("/", { headers: { "x-a": "1" } });
	assertEqual(r.status, 200, "fetch through instrumented fetch");
	assert((await r.text()).includes("<!DOCTYPE"), "fetch body");
	// XHR
	const xs = await new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open("GET", "/"); x.setRequestHeader("x-b", "2"); x.onload = () => res(x.status); x.onerror = () => rej(new Error("xhr error")); x.send(); });
	assertEqual(xs, 200, "xhr through instrumented XHR");
	// events on several target kinds
	let n = 0;
	const btn = document.createElement("button"); document.body.append(btn);
	const h = () => n++;
	btn.addEventListener("click", h); btn.click(); btn.removeEventListener("click", h); btn.click();
	window.addEventListener("rv0evt", h); window.dispatchEvent(new Event("rv0evt")); window.removeEventListener("rv0evt", h); window.dispatchEvent(new Event("rv0evt"));
	document.addEventListener("rv0evt", h, { once: true }); document.dispatchEvent(new Event("rv0evt")); document.dispatchEvent(new Event("rv0evt"));
	assertEqual(n, 3, "listeners add/remove/once through instrumented EventTarget");
	// history
	const before = location.href;
	history.pushState({ s: 1 }, "", "?pushed=1");
	assert(location.search.includes("pushed=1"), "pushState url: " + location.href);
	history.replaceState(null, "", before);
	assertEqual(location.href, before, "replaceState back");
	// timers + promises
	const v = await new Promise((res) => setTimeout(() => Promise.resolve(5).then(res), 1));
	assertEqual(v, 5, "timers/promises");
	// errors are captured but don't break
	setTimeout(() => { try { null.x; } catch {} }, 0);
	await wait(50);
`;

const page = (name: string, head: string, pre = "") =>
	htmlTest({
		name: `rv0-inst-${name}`,
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>
<script>
window.addEventListener("error", (e) => { if (!String(e.message).includes("rv0-ignore")) fail("page error: " + e.message + " @ " + e.filename + ":" + e.lineno); });
window.addEventListener("unhandledrejection", (e) => fail("unhandled rejection: " + (e.reason && e.reason.stack || e.reason)));
runTest(async () => {
${pre}
${exercise}
}, true);
</script></body></html>`,
	});

export default [
	page(
		"sentry8",
		`<script src="https://browser.sentry-cdn.com/8.33.1/bundle.tracing.min.js" crossorigin="anonymous"></script>`,
		`
		assert(window.Sentry, "Sentry loaded");
		Sentry.init({ dsn: "https://public@o0.ingest.sentry.io/0", integrations: [Sentry.browserTracingIntegration()], tracesSampleRate: 1.0, transport: () => ({ send: () => Promise.resolve({}), flush: () => Promise.resolve(true) }) });
		`
	),
	page(
		"datadog-rum",
		`<script src="https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js"></script>`,
		`
		assert(window.DD_RUM, "DD_RUM loaded");
		DD_RUM.init({ clientToken: "pub00000000000000000000000000000000", applicationId: "00000000-0000-0000-0000-000000000000", site: "datadoghq.com", service: "rv0", sessionSampleRate: 100, trackResources: true, trackLongTasks: true, trackUserInteractions: true, allowFallbackToLocalStorage: true });
		`
	),
	page(
		"corejs-full",
		`<script src="https://cdn.jsdelivr.net/npm/core-js-bundle@3.38.1/minified.js"></script>`,
		`assert(typeof structuredClone === "function", "core-js loaded");`
	),
	page(
		"zonejs",
		`<script src="https://cdn.jsdelivr.net/npm/zone.js@0.14.10/fesm2015/zone.min.js"></script>`,
		`assert(window.Zone, "zone.js loaded"); await Zone.current.fork({ name: "rv0" }).run(async () => {});`
	),
	page(
		"gtag",
		`<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
		 <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag("js", new Date()); gtag("config", "G-XXXXXXXXXX");</script>`,
		`await new Promise((r) => setTimeout(r, 1500));`
	),
	page(
		"posthog",
		`<script src="https://cdn.jsdelivr.net/npm/posthog-js@1.166.0/dist/array.full.js"></script>`,
		`assert(window.posthog, "posthog loaded"); posthog.init("phc_test", { api_host: "https://us.i.posthog.com", autocapture: true, capture_pageview: true, disable_session_recording: false });`
	),
	page(
		"logrocket-like-rrweb",
		`<script src="https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.4/dist/rrweb.min.js"></script>`,
		`assert(window.rrweb, "rrweb loaded"); const events = []; window.__stop = rrweb.record({ emit: (e) => events.push(e) }); await new Promise((r) => setTimeout(r, 200)); assert(events.length > 0, "rrweb recorded events: " + events.length);`
	),
	page(
		"polyfill-whatwg-fetch",
		`<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.20/dist/fetch.umd.js"></script>`,
		`window.fetch = window.WHATWGFetch.fetch;`
	),
];
