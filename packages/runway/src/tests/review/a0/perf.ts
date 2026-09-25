import { basicTest } from "../../../testcommon.ts";

// Not pass/fail tests: each one reports its timings through fail() so the
// numbers land in the runway log. Compare main vs dev by eye.
const bench = (name: string, setup: string, body: string, n = 5) =>
	basicTest({
		name: `rv0-perf-${name}`,
		scramjetOnly: true,
		js: `
			${setup}
			const runs = [];
			for (let r = 0; r < ${n}; r++) {
				const t0 = performance.now();
				${body}
				runs.push(performance.now() - t0);
			}
			runs.sort((a, b) => a - b);
			fail("PERF ${name} median=" + runs[runs.length >> 1].toFixed(1) + "ms min=" + runs[0].toFixed(1) + "ms");
		`,
	});

export default [
	bench(
		"inline-onclick-dispatch",
		`const b = document.createElement("button"); b.setAttribute("onclick", "window.__c = (window.__c || 0) + 1"); document.body.append(b);`,
		`for (let i = 0; i < 5000; i++) b.click();`
	),
	bench(
		"inline-onclick-in-html-dispatch",
		`const host = document.createElement("div"); host.innerHTML = '<button onclick="window.__d = (window.__d || 0) + 1">x</button>'; document.body.append(host); const b = host.firstChild;`,
		`for (let i = 0; i < 5000; i++) b.click();`
	),
	bench(
		"new-function-call",
		`const f = new Function("a", "b", "return a + b");`,
		`let s = 0; for (let i = 0; i < 200000; i++) s += f(i, 1);`
	),
	bench(
		"new-function-create",
		``,
		`for (let i = 0; i < 2000; i++) new Function("a", "return a + " + i);`
	),
	bench(
		"eval-indirect",
		``,
		`for (let i = 0; i < 2000; i++) (0, eval)("1 + " + i);`
	),
	bench(
		"script-inject-inline",
		``,
		`for (let i = 0; i < 300; i++) { const s = document.createElement("script"); s.textContent = "window.__e = " + i; document.head.appendChild(s); s.remove(); }`
	),
	bench(
		"append-elements",
		`const host = document.createElement("div"); document.body.append(host);`,
		`host.textContent = ""; for (let i = 0; i < 6000; i++) { const li = document.createElement("li"); li.className = "x"; host.appendChild(li); }`
	),
	bench(
		"append-text",
		`const host = document.createElement("div"); document.body.append(host);`,
		`host.textContent = ""; for (let i = 0; i < 6000; i++) host.append("t" + i);`
	),
	bench(
		"insertBefore",
		`const host = document.createElement("div"); document.body.append(host);`,
		`host.textContent = ""; for (let i = 0; i < 3000; i++) host.insertBefore(document.createElement("span"), host.firstChild);`
	),
	bench(
		"setAttribute-plain",
		`const el = document.createElement("div");`,
		`for (let i = 0; i < 20000; i++) el.setAttribute("data-x", "v" + i);`
	),
	bench(
		"getAttribute-plain",
		`const el = document.createElement("div"); el.setAttribute("data-x", "v");`,
		`let s = 0; for (let i = 0; i < 20000; i++) s += el.getAttribute("data-x").length;`
	),
	bench(
		"className-style",
		`const el = document.createElement("div"); document.body.append(el);`,
		`for (let i = 0; i < 20000; i++) { el.className = "c" + (i & 7); el.style.width = (i & 63) + "px"; }`
	),
	bench(
		"a-href-rw",
		`const a = document.createElement("a");`,
		`let s = 0; for (let i = 0; i < 5000; i++) { a.href = "/p/" + i; s += a.href.length; }`
	),
	bench(
		"innerHTML-small",
		`const host = document.createElement("div");`,
		`for (let i = 0; i < 2000; i++) host.innerHTML = "<span class=a>hi " + i + "</span><b>x</b>";`
	),
	bench(
		"innerHTML-big",
		`const host = document.createElement("div"); let html = ""; for (let i = 0; i < 3000; i++) html += "<div class='row'><a href='/x/" + i + "'>link</a><img src='/i/" + i + ".png'><span>text " + i + "</span></div>";`,
		`host.innerHTML = html;`
	),
	bench(
		"querySelectorAll",
		`const host = document.createElement("div"); for (let i = 0; i < 500; i++) { const d = document.createElement("div"); d.className = "q"; host.append(d); } document.body.append(host);`,
		`let s = 0; for (let i = 0; i < 2000; i++) s += host.querySelectorAll(".q").length;`
	),
	bench(
		"textContent-rw",
		`const el = document.createElement("div");`,
		`let s = 0; for (let i = 0; i < 20000; i++) { el.textContent = "x" + i; s += el.textContent.length; }`
	),
	bench(
		"addEventListener",
		`const el = document.createElement("div");`,
		`const fns = []; for (let i = 0; i < 5000; i++) { const f = () => {}; fns.push(f); el.addEventListener("click", f); } for (const f of fns) el.removeEventListener("click", f);`
	),
	bench(
		"dispatchEvent",
		`const el = document.createElement("div"); let c = 0; el.addEventListener("x", () => c++);`,
		`for (let i = 0; i < 20000; i++) el.dispatchEvent(new Event("x"));`
	),
	bench(
		"bind",
		`function f() { return this; }`,
		`let g; for (let i = 0; i < 100000; i++) g = f.bind(i);`
	),
	bench(
		"localStorage",
		`localStorage.clear();`,
		`for (let i = 0; i < 3000; i++) { localStorage.setItem("k" + (i & 31), "v" + i); localStorage.getItem("k" + (i & 15)); }`
	),
	bench(
		"cookie",
		``,
		`for (let i = 0; i < 1000; i++) { document.cookie = "c" + (i & 7) + "=" + i; document.cookie.length; }`
	),
	bench(
		"location-reads",
		``,
		`let s = 0; for (let i = 0; i < 20000; i++) s += location.href.length + location.pathname.length;`
	),
	bench(
		"setTimeout-clear",
		``,
		`for (let i = 0; i < 20000; i++) clearTimeout(setTimeout(() => {}, 1000));`
	),
	bench(
		"createElement-script-text",
		`const host = document.createElement("div");`,
		`for (let i = 0; i < 1000; i++) { const s = document.createElement("script"); s.type = "text/x-none"; s.textContent = "var a" + i + " = " + i + ";"; host.appendChild(s); }`
	),
	bench(
		"style-insertRule",
		`const st = document.createElement("style"); document.head.append(st); const sheet = st.sheet;`,
		`for (let i = 0; i < 3000; i++) sheet.insertRule(".c" + i + " { color: red; background: url(/i" + i + ".png) }", sheet.cssRules.length);`
	),
	bench(
		"fetch-construct-request",
		``,
		`for (let i = 0; i < 3000; i++) new Request("/api/" + i, { headers: { a: "b" } }).url;`
	),
	bench(
		"postMessage-self",
		``,
		`for (let i = 0; i < 3000; i++) window.postMessage({ i }, "*");`
	),
	bench(
		"getComputedStyle",
		`const el = document.createElement("div"); document.body.append(el);`,
		`let s = 0; for (let i = 0; i < 5000; i++) s += getComputedStyle(el).display.length;`
	),
	bench(
		"error-stack",
		``,
		`let s = 0; for (let i = 0; i < 5000; i++) s += new Error("x").stack.length;`
	),
];
