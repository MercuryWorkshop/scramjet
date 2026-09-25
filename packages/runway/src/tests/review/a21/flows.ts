import type { Test } from "../../../testcommon.ts";
import { withOrigins, PRE, H, J } from "./common.ts";

const S = (f) => {
	try {
		const v = f();
		return typeof v === "string" ? v : JSON.stringify(v);
	} catch (e) {
		return "throws:" + e.name;
	}
};
const report = `console.log("RV21", JSON.stringify(R)); for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);`;

export default [
	// sibling iframes on two other origins, one posting to the other via parent.frames[i]
	withOrigins(
		"rv21-flow-siblings",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const a = document.createElement("iframe"); a.src = P[0] + "/sib?to=1&name=a";
		const b = document.createElement("iframe"); b.src = P[1] + "/sib?to=0&name=b";
		const got = [];
		const done = new Promise((res) => addEventListener("message", (e) => { if (e.data && e.data.report) { got.push(e.data); if (got.length === 2) res(); } }));
		document.body.append(a, b);
		await Promise.race([done, new Promise((r) => setTimeout(r, 6000))]);
		got.sort((x, y) => x.name < y.name ? -1 : 1);
		R.reports = JSON.stringify(got.map((g) => [g.name, g.fromName, g.originOk, g.sourceOk, g.exactDelivered, g.wrongDelivered]));
		${report}
	`,
		(mp, ports) => ({
			"/sib": [
				H,
				`<!doctype html><body><script src="/sib.js"></script></body>`,
			],
			"/sib.js": [
				J,
				`
			const q = new URLSearchParams(location.search); const to = +q.get("to"); const name = q.get("name");
			const ports = ${JSON.stringify(ports)};
			const other = "http://localhost:" + ports[to];
			const rep = { report: 1, name, exactDelivered: false, wrongDelivered: false };
			addEventListener("message", (e) => {
				if (e.data && e.data.hello) {
					rep.fromName = e.data.hello; rep.originOk = e.origin === other; rep.sourceOk = e.source === parent.frames[to];
					if (e.data.kind === "exact") rep.exactDelivered = true;
					if (e.data.kind === "wrong") rep.wrongDelivered = true;
				}
			});
			// wait for sibling to exist and load
			const go = () => {
				try { parent.frames[to].postMessage({ hello: name, kind: "exact" }, other); } catch (x) { rep.err = String(x); }
				try { parent.frames[to].postMessage({ hello: name, kind: "wrong" }, "http://nope.example"); } catch (x) {}
				setTimeout(() => parent.postMessage(rep, "*"), 800);
			};
			setTimeout(go, 800);
		`,
			],
		}),
		{ n: 2 }
	),
	// top -> child(P0) -> grandchild(P1) -> great-grandchild(top origin) : great-grandchild posts to top with exact origin; top replies via e.source
	withOrigins(
		"rv21-flow-nested3",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const f = document.createElement("iframe"); f.src = P[0] + "/l1?top=" + encodeURIComponent(location.origin);
		const p = waitMsg((e) => e.data && e.data.deep, 8000);
		document.body.appendChild(f);
		const e = await p;
		R.got = S(() => !!e);
		R.origin = S(() => e.origin === location.origin);
		R.source = S(() => e.source === f.contentWindow.frames[0].frames[0]);
		R.sourceTop = S(() => e.source.parent.parent.parent === window);
		const p2 = waitMsg((x) => x.data && x.data.back, 3000);
		e.source.postMessage({ reply: 1 }, e.origin);
		const e2 = await p2;
		R.back = S(() => e2 && [e2.data.back, e2.data.originOk]);
		// l1 (P0) posts to top with "/"-like mistakes: exact P0 origin from l2 (P1) must be dropped
		R.l2wrong = S(() => window.__l2got || "none");
		${report}
	`,
		(mp, ports) => ({
			"/l1": [
				H,
				`<!doctype html><body><script>const i = document.createElement("iframe"); i.src = "http://localhost:${ports[1]}/l2" + location.search; document.body.appendChild(i);</script></body>`,
			],
			"/l2": [
				H,
				`<!doctype html><body><script>const i = document.createElement("iframe"); i.src = new URLSearchParams(location.search).get("top") + "/l3"; document.body.appendChild(i); parent.parent.postMessage({ l2: 1 }, "http://localhost:${ports[0]}")</script></body>`,
			],
		}),
		{
			n: 2,
			mainFiles: (mp) => ({
				"/l3": [
					H,
					`<!doctype html><body><script src="/l3.js"></script></body>`,
				],
				"/l3.js": [
					J,
					`
			const T = parent.parent.parent;
			addEventListener("message", (e) => { if (e.data && e.data.reply) T.postMessage({ back: 1, originOk: e.origin === location.origin && e.source === T }, location.origin); });
			T.postMessage({ deep: 1 }, location.origin);
		`,
				],
			}),
		}
	),
	// opaque (sandboxed) child and data: child
	withOrigins(
		"rv21-flow-opaque",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const s = document.createElement("iframe"); s.setAttribute("sandbox", "allow-scripts"); s.src = P[0] + "/op";
		let p = waitMsg((e) => e.data && e.data.op, 5000);
		document.body.appendChild(s);
		let e = await p;
		R.sbOrigin = S(() => e && e.origin);
		R.sbSource = S(() => e && e.source === s.contentWindow);
		p = waitMsg((x) => x.data && x.data.opback, 3000);
		s.contentWindow.postMessage({ q: 1 }, "*");
		e = await p;
		R.sbBack = S(() => e && e.data.seen);
		p = waitMsg((x) => x.data && x.data.opback, 1500);
		s.contentWindow.postMessage({ q: 2 }, P[0]);
		e = await p;
		R.sbBackExact = S(() => e ? e.data.seen : "DROPPED");
		const d = document.createElement("iframe");
		d.src = "data:text/html,<script>parent.postMessage({dat:1, o: self.origin}, '*'); addEventListener('message', (e) => parent.postMessage({datback: e.origin}, '*'))<\/script>";
		p = waitMsg((x) => x.data && x.data.dat, 5000);
		document.body.appendChild(d);
		e = await p;
		R.dataOrigin = S(() => e && [e.origin, e.data.o]);
		R.dataSource = S(() => e && e.source === d.contentWindow);
		p = waitMsg((x) => x.data && x.data.datback, 3000);
		d.contentWindow.postMessage("x", "*");
		e = await p;
		R.dataBack = S(() => e && e.data.datback === location.origin);
		${report}
	`,
		() => ({
			"/op": [H, `<!doctype html><body><script src="/op.js"></script></body>`],
			"/op.js": [
				J,
				`
			parent.postMessage({ op: 1 }, "*");
			addEventListener("message", (e) => parent.postMessage({ opback: 1, seen: [e.origin === "http://localhost:" + location.port ? "self" : e.origin.replace(/\\d+/, "N"), e.source === parent, self.origin] }, "*"));
		`,
			],
		})
	),
	// call shapes from a cross-origin child (pst attribution)
	withOrigins(
		"rv21-flow-callshapes",
		`
		${PRE}
		const R = {};
		const S = ${S.toString()};
		const f = document.createElement("iframe"); f.src = P[0] + "/cs";
		const got = {};
		const done = new Promise((res) => addEventListener("message", (e) => { if (e.data && e.data.cs) { got[e.data.cs] = (e.origin === P[0]) + "/" + (e.source === f.contentWindow); if (e.data.cs === "END") res(); } }));
		document.body.appendChild(f);
		await Promise.race([done, new Promise((r) => setTimeout(r, 8000))]);
		for (const k of Object.keys(got)) R["cs_" + k] = got[k];
		${report}
	`,
		() => ({
			"/cs": [
				H,
				`<!doctype html><body><button id=b onclick="parent.postMessage({cs:'inlineHandler'}, '*')">x</button><a id=j href="javascript:parent.postMessage({cs:'jsurl'},'*')">j</a><script src="/cs.js"></script></body>`,
			],
			"/cs.js": [
				J,
				`
			const pm = parent.postMessage;
			const m = (k) => ({ cs: k });
			setTimeout(parent.postMessage, 0, m("timeoutUnbound"), "*");
			Promise.resolve().then(() => 0).then(pm.bind(parent, m("thenBoundLate"), "*", []));
			addEventListener("rv21x", pm.bind(parent, m("listenerBound"), "*", [])); dispatchEvent(new Event("rv21x"));
			new MutationObserver(pm.bind(parent, m("moBound"), "*", [])).observe(document.body, { attributes: true }); document.body.setAttribute("data-x", "1");
			requestAnimationFrame(pm.bind(parent, m("rafBound"), "*", []));
			parent.postMessage(m("direct"), "*");
			pm.call(parent, m("call"), "*");
			pm.apply(parent, [m("apply"), "*"]);
			Reflect.apply(pm, parent, [m("reflect"), "*"]);
			pm.bind(parent)(m("bound"), "*");
			pm.bind(parent, m("boundArgs"), "*")();
			[m("forEachBuiltin")].forEach(function (x) { parent.postMessage(x, "*"); });
			[[m("forEachDirect"), "*"]].forEach((a) => Function.prototype.apply.call(pm, parent, a));
			new Promise((r) => r()).then(() => parent.postMessage(m("promise"), "*"));
			Promise.resolve(m("thenBound")).then((v) => pm.bind(parent)(v, "*"));
			Promise.resolve(m("thenBoundDirect")).then(pm.bind(parent, m("thenBoundDirect"), "*", []));
			setTimeout(pm.bind(parent, m("timeoutBound"), "*", []));
			setTimeout("parent.postMessage({cs:'stringTimer'}, '*')");
			eval("parent.postMessage({cs:'eval'}, '*')");
			new Function("parent.postMessage({cs:'newFunction'}, '*')")();
			(0, eval)("parent.postMessage({cs:'indirectEval'}, '*')");
			const s = document.createElement("script"); s.textContent = "parent.postMessage({cs:'dynScript'}, '*')"; document.body.appendChild(s);
			document.getElementById("b").click();
			const ev = document.createElement("div"); ev.setAttribute("onclick", "parent.postMessage({cs:'setAttrHandler'}, '*')"); ev.click();
			queueMicrotask(() => parent.postMessage(m("microtask"), "*"));
			const gen = (function* () { parent.postMessage(m("generator"), "*"); yield 1; })(); gen.next();
			(async () => { await null; parent.postMessage(m("async"), "*"); })();
			JSON.parse("[1]", function (k, v) { if (k === "0") parent.postMessage(m("jsonReviver"), "*"); return v; });
			"a".replace(/a/, () => { parent.postMessage(m("replaceCb"), "*"); return ""; });
			const px = new Proxy({}, { get() { parent.postMessage(m("proxyTrap"), "*"); return 1; } }); px.x;
			const o = { get g() { parent.postMessage(m("getter"), "*"); return 1; } }; o.g;
			class C { constructor() { parent.postMessage(m("ctor"), "*"); } } new C();
			try { document.getElementById("j").click(); } catch {}
			setTimeout(() => parent.postMessage(m("END"), "*"), 1500);
		`,
			],
		}),
		{
			scramjetOnly: false,
		}
	),
] as Test[];
