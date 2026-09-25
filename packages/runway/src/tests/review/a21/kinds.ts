import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

// Recipients of many document kinds; the sender targets the origin the recipient really has.
const LISTEN = `addEventListener("message", (e) => { if (e.data && e.data.probe) e.source.postMessage({ ack: e.data.probe, sawOrigin: e.origin }, "*"); });`;
export default [
	withOrigins(
		"rv21-kinds-recipients",
		`
		${PRE}
		const R = {};
		const L = ${JSON.stringify(LISTEN)};
		const probe = async (label, win, to) => {
			const p = waitMsg((e) => e.data && e.data.ack === label, 1500);
			try { win.postMessage({ probe: label }, to); } catch (e) { R[label] = "throws:" + e.name; return; }
			const e = await p;
			R[label] = e ? "ok:" + (e.data.sawOrigin === location.origin ? "SELF" : e.data.sawOrigin.replace(/\\d+$/, "N")) : "DROPPED";
		};
		const me = location.origin;
		// 1. window.open("") + write
		const w1 = window.open("", "rv21k1", "width=200,height=200"); w1.document.write("<script>" + L + "<\\/script>"); w1.document.close();
		await probe("popupBlankWritten", w1, me);
		w1.close();
		// 2. explicit about:blank iframe + eval
		const f2 = document.createElement("iframe"); f2.src = "about:blank"; document.body.appendChild(f2); await new Promise((r) => setTimeout(r, 100)); f2.contentWindow.eval(L);
		await probe("iframeAboutBlankSrc", f2.contentWindow, me);
		// 3. about:blank?x and #x
		const f3 = document.createElement("iframe"); f3.src = "about:blank#frag"; document.body.appendChild(f3); await new Promise((r) => setTimeout(r, 100)); f3.contentWindow.eval(L);
		await probe("iframeAboutBlankHash", f3.contentWindow, me);
		// 4. blob document
		const f4 = document.createElement("iframe"); f4.src = URL.createObjectURL(new Blob(["<script>" + L + "<\\/script>"], { type: "text/html" }));
		let ld = new Promise((r) => f4.onload = r); document.body.appendChild(f4); await ld;
		await probe("iframeBlob", f4.contentWindow, me);
		// 5. cross-origin child (P0) which makes a srcdoc, an about:blank and a blob grandchild
		const c = document.createElement("iframe"); c.src = P[0] + "/kids";
		const rdy = waitMsg((e) => e.data === "kids-ready", 6000);
		document.body.appendChild(c); await rdy;
		const cw = c.contentWindow;
		await probe("crossChild", cw, P[0]);
		await probe("crossChild_wrongIsParent", cw, me);
		await probe("gcSrcdoc", cw.frames[0], P[0]);
		await probe("gcBlank", cw.frames[1], P[0]);
		await probe("gcBlob", cw.frames[2], P[0]);
		await probe("gcSrcdoc_wrongIsTop", cw.frames[0], me);
		// 6. iframe navigated to about:blank by the parent after a cross-origin page loaded in it
		const f6 = document.createElement("iframe"); f6.src = P[0] + "/plain"; ld = new Promise((r) => f6.onload = r); document.body.appendChild(f6); await ld;
		ld = new Promise((r) => f6.onload = r); f6.src = "about:blank"; await ld; f6.contentWindow.eval(L);
		await probe("navigatedToBlankByParent", f6.contentWindow, me);
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
		() => ({
			"/plain": [H, `<!doctype html><p>plain`],
			"/kids": [
				H,
				`<!doctype html><body><script>
			const L = ${JSON.stringify(LISTEN)};
			${LISTEN}
			const a = document.createElement("iframe"); a.srcdoc = "<script>" + L + "<\\/script>"; document.body.appendChild(a);
			const b = document.createElement("iframe"); document.body.appendChild(b); b.contentWindow.eval(L);
			const c = document.createElement("iframe"); c.src = URL.createObjectURL(new Blob(["<script>" + L + "<\\/script>"], { type: "text/html" })); document.body.appendChild(c);
			setTimeout(() => parent.postMessage("kids-ready", "*"), 800);
		</script></body>`,
			],
		}),
		{
			timeoutMs: 40000,
		}
	),
] as Test[];
