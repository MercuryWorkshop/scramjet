import { basicTest } from "../../../testcommon.ts";

// Micro benchmarks for element-layer hot paths. They always "fail" with the
// timings in the message so the numbers are printed; compare main vs dev.

const bench = (name: string, setup: string, body: string, n: number) =>
	basicTest({
		name: `rv2-perf-${name}`,
		scramjetOnly: true,
		js: `
			${setup}
			// warm up
			for (let i = 0; i < ${Math.max(1, Math.floor(n / 10))}; i++) { ${body} }
			const t0 = performance.now();
			for (let i = 0; i < ${n}; i++) { ${body} }
			const dt = performance.now() - t0;
			fail("TIMING ${name} n=${n} total=" + dt.toFixed(1) + "ms per=" + (dt * 1000 / ${n}).toFixed(2) + "us");
		`,
	});

export default [
	bench(
		"setAttribute-class",
		`const el = document.createElement("div"); document.body.appendChild(el);`,
		`el.setAttribute("class", "c" + (i & 7));`,
		20000
	),
	bench(
		"setAttribute-data",
		`const el = document.createElement("div");`,
		`el.setAttribute("data-x", "v" + i);`,
		20000
	),
	bench(
		"setAttribute-href",
		`const el = document.createElement("a");`,
		`el.setAttribute("href", "/p/" + i);`,
		5000
	),
	bench(
		"getAttribute-class",
		`const el = document.createElement("div"); el.setAttribute("class","x");`,
		`el.getAttribute("class");`,
		50000
	),
	bench(
		"getAttribute-href",
		`const el = document.createElement("a"); el.setAttribute("href","/x");`,
		`el.getAttribute("href");`,
		50000
	),
	bench(
		"a-href-get",
		`const el = document.createElement("a"); el.setAttribute("href","/x"); document.body.appendChild(el);`,
		`el.href;`,
		20000
	),
	bench(
		"img-src-set",
		`const el = document.createElement("img");`,
		`el.src = "/i" + i + ".png";`,
		5000
	),
	bench(
		"innerHTML-set-small",
		`const el = document.createElement("div");`,
		`el.innerHTML = "<span class=a>hi " + i + "</span><b>x</b>";`,
		5000
	),
	bench(
		"innerHTML-set-text",
		`const el = document.createElement("div");`,
		`el.innerHTML = "hello " + i;`,
		10000
	),
	bench(
		"innerHTML-get",
		`const el = document.createElement("div"); el.innerHTML = "<ul>" + "<li><a href='/x'>x</a></li>".repeat(50) + "</ul>";`,
		`el.innerHTML;`,
		500
	),
	bench(
		"appendChild-remove",
		`const p = document.createElement("div"); document.body.appendChild(p); const c = document.createElement("span");`,
		`p.appendChild(c); p.removeChild(c);`,
		20000
	),
	bench(
		"createTextNode-append",
		`const p = document.createElement("div");`,
		`p.appendChild(document.createTextNode("t"));`,
		20000
	),
	bench(
		"insertBefore",
		`const p = document.createElement("div"); const r = document.createElement("i"); p.appendChild(r); const c = document.createElement("span");`,
		`p.insertBefore(c, r);`,
		20000
	),
	bench(
		"textContent-set",
		`const el = document.createElement("div");`,
		`el.textContent = "abc" + i;`,
		20000
	),
	bench(
		"textContent-get-nested",
		`const el = document.createElement("div"); el.innerHTML = "<p>a<b>b</b></p>".repeat(20);`,
		`el.textContent;`,
		20000
	),
	bench(
		"nodeValue-set",
		`const t = document.createTextNode("x"); const p = document.createElement("div"); p.appendChild(t);`,
		`t.nodeValue = "v" + i;`,
		20000
	),
	bench(
		"text-data-get",
		`const t = document.createTextNode("x"); const p = document.createElement("div"); p.appendChild(t);`,
		`t.data;`,
		50000
	),
	bench(
		"qsa-class",
		`document.body.insertAdjacentHTML("beforeend", "<div class=q></div>".repeat(100));`,
		`document.querySelectorAll(".q");`,
		5000
	),
	bench(
		"qsa-attr-href",
		`document.body.insertAdjacentHTML("beforeend", "<a href='/x'></a>".repeat(100));`,
		`document.querySelectorAll("a[href]");`,
		5000
	),
	bench(
		"el-qs-class",
		`const root = document.createElement("div"); root.innerHTML = "<div class=q></div>".repeat(100);`,
		`root.querySelector(".q");`,
		20000
	),
	bench(
		"attributes-iterate",
		`const el = document.createElement("div"); for (let k = 0; k < 10; k++) el.setAttribute("data-a" + k, "v");`,
		`for (let k = 0; k < el.attributes.length; k++) el.attributes[k].name;`,
		5000
	),
	bench(
		"cloneNode-deep",
		`const el = document.createElement("div"); el.innerHTML = "<p>a<b>b</b></p>".repeat(20);`,
		`el.cloneNode(true);`,
		5000
	),
	bench(
		"importNode-template",
		`const t = document.createElement("template"); t.innerHTML = "<div><p>a</p><span>b</span></div>";`,
		`document.importNode(t.content, true);`,
		10000
	),
	bench(
		"append-strings",
		`const p = document.createElement("div");`,
		`p.append("a", "b"); p.textContent = "";`,
		10000
	),
	bench(
		"classList-add",
		`const el = document.createElement("div");`,
		`el.classList.add("x" + (i & 3));`,
		20000
	),
	bench(
		"hasAttribute",
		`const el = document.createElement("div"); el.setAttribute("id","x");`,
		`el.hasAttribute("id");`,
		50000
	),
	bench(
		"react-like-create",
		`const root = document.createElement("div"); document.body.appendChild(root);`,
		`const d = document.createElement("div"); d.setAttribute("class","row"); d.setAttribute("id","r"+i); const s = document.createElement("span"); s.appendChild(document.createTextNode("label " + i)); d.appendChild(s); const a = document.createElement("a"); a.setAttribute("href","/item/"+i); d.appendChild(a); root.appendChild(d); if ((i & 255) === 255) root.textContent = "";`,
		3000
	),
	bench(
		"nodeName",
		`const el = document.createElement("div");`,
		`el.nodeName;`,
		100000
	),
	bench(
		"textContent-get-leaf",
		`const el = document.createElement("div"); el.textContent = "abc";`,
		`el.textContent;`,
		50000
	),
	bench(
		"cloneNode-shallow",
		`const el = document.createElement("div"); el.setAttribute("class", "x");`,
		`el.cloneNode(false);`,
		50000
	),
	bench(
		"getAttributeNames",
		`const el = document.createElement("a"); el.setAttribute("href","/x"); el.setAttribute("class","c");`,
		`el.getAttributeNames();`,
		50000
	),
	bench(
		"attr-value-get",
		`const el = document.createElement("div"); el.setAttribute("class","c"); const at = el.getAttributeNode("class");`,
		`at.value;`,
		50000
	),
	bench(
		"matches-class",
		`const el = document.createElement("div"); el.className = "x";`,
		`el.matches(".x");`,
		50000
	),
	bench(
		"closest-attr",
		`const root = document.createElement("div"); root.setAttribute("data-r", "1"); let el = root; for (let k = 0; k < 10; k++) { const c = document.createElement("div"); el.appendChild(c); el = c; }`,
		`el.closest("[data-r]");`,
		50000
	),
	bench(
		"removeChild-append-frag",
		`const p = document.createElement("div"); const f = document.createDocumentFragment();`,
		`for (let k = 0; k < 5; k++) f.appendChild(document.createElement("span")); p.appendChild(f); p.textContent = "";`,
		5000
	),
	bench(
		"setAttribute-href-hash-connected",
		`const el = document.createElement("a"); document.body.appendChild(el);`,
		`el.setAttribute("href", "#" + i);`,
		2000
	),
	bench(
		"setAttribute-href-hash-detached",
		`const el = document.createElement("a");`,
		`el.setAttribute("href", "#" + i);`,
		2000
	),
	bench(
		"textnode-nodeValue-connected-td",
		`const t = document.createElement("table"); const r = t.insertRow(); const c = r.insertCell(); c.appendChild(document.createTextNode("x")); document.body.appendChild(t); const tn = c.firstChild;`,
		`tn.nodeValue = "v" + i;`,
		20000
	),
	bench(
		"setAttribute-href-2000-anchors",
		`const box = document.createElement("div"); box.innerHTML = "<a href='#x'>x</a>".repeat(2000); document.body.appendChild(box); const el = box.firstChild;`,
		`el.setAttribute("href", "#" + i);`,
		1000
	),
	bench(
		"setAttribute-src-2000-anchors",
		`const box = document.createElement("div"); box.innerHTML = "<a href='#x'>x</a>".repeat(2000); document.body.appendChild(box); const el = document.createElement("img");`,
		`el.setAttribute("src", "/i" + i + ".png");`,
		1000
	),
	bench(
		"setAttribute-href-2000-divs",
		`const box = document.createElement("div"); box.innerHTML = "<div>x</div>".repeat(2000); document.body.appendChild(box); const el = document.createElement("a"); document.body.appendChild(el);`,
		`el.setAttribute("href", "#" + i);`,
		1000
	),
];
