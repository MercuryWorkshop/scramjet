import { serverTest } from "../../../testcommon.ts";

// what an animation loop does to inline style, timed. The assertion is there
// to print the numbers, not to pass
export default [
	serverTest({
		name: "v3-perf-style-writes",
		start: async (server) => {
			server.on("request", (req, res) => {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`<!doctype html><div id=d style="color: red; background: url(/a.png)"></div><div id=e></div><script>
runTest(async () => {
	const t = (fn) => { const s = performance.now(); fn(); return Math.round(performance.now() - s); };
	const N = 20000;
	const out = {};
	out.writeTransform = t(() => { for (let i = 0; i < N; i++) d.style.transform = "translateX(" + i + "px)"; });
	out.writeTransformBare = t(() => { for (let i = 0; i < N; i++) e.style.transform = "translateX(" + i + "px)"; });
	out.readOpacity = t(() => { let x; for (let i = 0; i < N; i++) x = d.style.opacity; });
	out.setProperty = t(() => { for (let i = 0; i < N; i++) e.style.setProperty("--x", i + "px"); });
	out.cssText = t(() => { for (let i = 0; i < 2000; i++) e.style.cssText = "left:" + i + "px;top:3px"; });
	out.computed = t(() => { let x; for (let i = 0; i < N; i++) x = getComputedStyle(e).left; });
	const mo = new MutationObserver(() => {}); mo.observe(document.body, { attributes: true, subtree: true });
	out.writeWithMO = t(() => { for (let i = 0; i < N; i++) e.style.left = i + "px"; });
	assertConsistent("times", out);
}, true);
</script>`);
			});
		},
	}),
];
