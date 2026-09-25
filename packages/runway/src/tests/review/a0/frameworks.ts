import { htmlTest } from "../../../testcommon.ts";

// Real library builds from jsdelivr, loaded through the proxy, each driving a
// small app. A failure here on dev but not main is a framework-level
// regression.
const CDN = "https://cdn.jsdelivr.net/npm";
const page = (name: string, head: string, body: string, js: string) =>
	htmlTest({
		name: `rv0-fw-${name}`,
		html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">${head}</head>
<body>${body}
<script>
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 8000) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) { try { if (fn()) return; } catch {} await wait(25); }
	throw new Error("timed out waiting for " + what);
};
window.addEventListener("error", (e) => fail("page error: " + e.message + " @ " + e.filename + ":" + e.lineno));
window.addEventListener("unhandledrejection", (e) => fail("unhandled rejection: " + (e.reason && e.reason.stack || e.reason)));
runTest(async () => {
${js}
}, true);
</script>
</body></html>`,
	});

export default [
	page(
		"alpine-diag",
		`<script defer src="${CDN}/alpinejs@3.14.1/dist/cdn.min.js"></script>`,
		`<div x-data="{ open: false, n: 1 }"><span id="s" x-show="open" x-text="'n=' + n">raw</span></div>`,
		`
		const errs = [];
		window.addEventListener("error", (e) => errs.push(e.message));
		const origWarn = console.warn; console.warn = (...a) => { errs.push("warn:" + a.join(" ")); origWarn(...a); };
		await wait(3000);
		const s = document.getElementById("s");
		fail("ALPINE Alpine=" + typeof window.Alpine + " version=" + (window.Alpine && window.Alpine.version) + " display=" + JSON.stringify(s.style.display) + " text=" + s.textContent + " readyState=" + document.readyState + " errs=" + JSON.stringify(errs).slice(0, 600));
		`
	),
	page(
		"react18",
		`<script src="${CDN}/react@18.3.1/umd/react.production.min.js"></script>
		 <script src="${CDN}/react-dom@18.3.1/umd/react-dom.production.min.js"></script>`,
		`<div id="root"></div>`,
		`
		const e = React.createElement;
		function App() {
			const [n, setN] = React.useState(0);
			const ref = React.useRef(null);
			React.useEffect(() => { ref.current.dataset.mounted = "1"; }, []);
			return e("div", null,
				e("button", { id: "b", onClick: () => setN((x) => x + 1) }, "count " + n),
				e("a", { id: "l", href: "/path?x=" + n }, "link"),
				e("img", { id: "i", src: "/img.png", alt: "" }),
				e("div", { id: "html", dangerouslySetInnerHTML: { __html: "<b>bold</b><a href='/in'>in</a>" } }),
				e("svg", { id: "s", viewBox: "0 0 10 10" }, e("use", { href: "#x" })),
				e("input", { id: "inp", defaultValue: "v", ref }),
				e("style", null, ".x{background:url(/bg.png)}")
			);
		}
		ReactDOM.createRoot(document.getElementById("root")).render(e(App));
		await until(() => document.getElementById("b"), "render");
		document.getElementById("b").click();
		await until(() => document.getElementById("b").textContent === "count 1", "state update after click");
		assertEqual(document.getElementById("l").getAttribute("href"), "/path?x=1", "href attribute");
		assertEqual(new URL(document.getElementById("l").href).pathname, "/path", "href property");
		assertEqual(document.querySelector("#html b").textContent, "bold", "dangerouslySetInnerHTML");
		assertEqual(document.querySelector("#html a").getAttribute("href"), "/in", "inner href");
		assertEqual(document.getElementById("inp").dataset.mounted, "1", "ref/effect");
		assertEqual(document.getElementById("s").getAttribute("viewBox"), "0 0 10 10", "svg attr case");
		`
	),
	page(
		"jquery3",
		`<script src="${CDN}/jquery@3.7.1/dist/jquery.min.js"></script>`,
		`<div id="app"></div>`,
		`
		const $app = $("#app");
		$app.html("<ul><li class='a'><a href='/one'>1</a></li><li class='a'>2</li></ul><img src='/x.png'>");
		assertEqual($app.find("li.a").length, 2, "html + find");
		assertEqual($app.find("a").attr("href"), "/one", "attr read");
		$app.find("a").attr("href", "/two");
		assertEqual($app.find("a").attr("href"), "/two", "attr write");
		assertEqual($("a[href='/two']").length, 1, "attribute selector");
		assertEqual($("img[src$='x.png']").length, 1, "attr suffix selector");
		let clicks = 0;
		$app.on("click", "li", function () { clicks++; });
		$app.find("li").first().trigger("click");
		$app.find("li")[1].click();
		assertEqual(clicks, 2, "delegated events");
		$app.append($("<p>").text("t").css("background-image", "url(/p.png)"));
		assertEqual($app.find("p").css("display"), "block", "css read");
		const data = await $.ajax({ url: "/", dataType: "text" });
		assert(data.includes("<!DOCTYPE html>"), "ajax same-origin");
		$app.find("p").addClass("q").removeClass("q").toggleClass("r");
		assert($app.find("p").hasClass("r"), "class ops");
		$app.empty();
		assertEqual($app.children().length, 0, "empty");
		`
	),
	page(
		"vue3-runtime-compiler",
		`<script src="${CDN}/vue@3.4.38/dist/vue.global.prod.js"></script>`,
		`<div id="app"><button id="b" @click="n++">{{ n }}</button><a :href="'/p/' + n" id="l">l</a><p v-if="n > 0" id="p">shown</p><ul><li v-for="i in list" :key="i">{{ i }}</li></ul><img :src="img" id="img"></div>`,
		`
		Vue.createApp({ data: () => ({ n: 0, list: [1, 2, 3], img: "/a.png" }) }).mount("#app");
		await until(() => document.getElementById("b") && document.getElementById("b").textContent === "0", "mount");
		document.getElementById("b").click();
		await until(() => document.getElementById("p"), "reactivity");
		assertEqual(document.getElementById("l").getAttribute("href"), "/p/1", "bound href");
		assertEqual(document.querySelectorAll("li").length, 3, "v-for");
		assertEqual(document.getElementById("img").getAttribute("src"), "/a.png", "bound src");
		`
	),
	page(
		"alpine",
		`<script defer src="${CDN}/alpinejs@3.14.1/dist/cdn.min.js"></script>`,
		`<div x-data="{ open: false, n: 1 }"><button id="b" @click="open = !open; n++">t</button><span id="s" x-show="open" x-text="'n=' + n"></span><a id="l" :href="'/q?n=' + n">l</a></div>`,
		`
		await until(() => window.Alpine && document.getElementById("s").style.display === "none", "alpine init (Alpine=" + typeof window.Alpine + ", display=" + document.getElementById("s").style.display + ", text=" + document.getElementById("s").textContent + ")");
		document.getElementById("b").click();
		await until(() => document.getElementById("s").style.display !== "none", "x-show");
		assertEqual(document.getElementById("s").textContent, "n=2", "x-text");
		assertEqual(document.getElementById("l").getAttribute("href"), "/q?n=2", ":href");
		`
	),
	page(
		"lit",
		`<script type="module">
			import { LitElement, html, css } from "${CDN}/lit@3.2.0/+esm";
			class MyEl extends LitElement {
				static properties = { n: { type: Number } };
				static styles = css\`:host { display: block; } a { color: red; }\`;
				constructor() { super(); this.n = 0; }
				render() { return html\`<button id="b" @click=\${() => this.n++}>\${this.n}</button><a id="l" href="/lit/\${this.n}">l</a>\`; }
			}
			customElements.define("my-el", MyEl);
			window.litReady = true;
		</script>`,
		`<my-el id="el"></my-el>`,
		`
		await until(() => window.litReady && document.getElementById("el").shadowRoot?.getElementById("b"), "lit render");
		const root = document.getElementById("el").shadowRoot;
		root.getElementById("b").click();
		await until(() => root.getElementById("b").textContent === "1", "lit update");
		assertEqual(root.getElementById("l").getAttribute("href"), "/lit/1", "lit attr");
		assertEqual(getComputedStyle(root.getElementById("l")).color, "rgb(255, 0, 0)", "adopted styles apply");
		`
	),
	page(
		"preact-htm",
		`<script type="module">
			import { h, render } from "${CDN}/preact@10.23.2/+esm";
			import { useState } from "${CDN}/preact@10.23.2/hooks/+esm";
			import htm from "${CDN}/htm@3.1.1/+esm";
			const html = htm.bind(h);
			function App() { const [n, s] = useState(0); return html\`<button id="b" onClick=\${() => s(n + 1)}>\${n}</button>\`; }
			render(html\`<\${App} />\`, document.getElementById("root"));
			window.preactReady = true;
		</script>`,
		`<div id="root"></div>`,
		`
		await until(() => window.preactReady && document.getElementById("b"), "preact render");
		document.getElementById("b").click();
		await until(() => document.getElementById("b").textContent === "1", "preact update");
		`
	),
	page(
		"d3-svg",
		`<script src="${CDN}/d3@7.9.0/dist/d3.min.js"></script>`,
		`<div id="chart"></div>`,
		`
		const svg = d3.select("#chart").append("svg").attr("width", 100).attr("height", 100).attr("viewBox", "0 0 100 100");
		svg.append("defs").append("linearGradient").attr("id", "g").append("stop").attr("offset", "0").attr("stop-color", "red");
		svg.selectAll("rect").data([1, 2, 3]).join("rect").attr("x", (d) => d * 10).attr("width", 5).attr("height", 5).attr("fill", "url(#g)");
		svg.append("image").attr("href", "/img.png").attr("width", 10).attr("height", 10);
		assertEqual(document.querySelectorAll("#chart rect").length, 3, "data join");
		assertEqual(document.querySelector("#chart rect").getAttribute("fill"), "url(#g)", "fill attr");
		assertEqual(document.querySelector("#chart image").getAttribute("href"), "/img.png", "svg image href");
		assertEqual(d3.select("#chart svg").attr("viewBox"), "0 0 100 100", "viewBox");
		const ser = new XMLSerializer().serializeToString(document.querySelector("#chart svg"));
		assert(ser.includes('href="/img.png"'), "XMLSerializer keeps href: " + ser.slice(0, 300));
		assert(!ser.includes("scramjet"), "XMLSerializer does not leak internals: " + ser.slice(Math.max(0, ser.indexOf("scramjet") - 150), ser.indexOf("scramjet") + 150));
		`
	),
	page(
		"axios-lodash-moment",
		`<script src="${CDN}/axios@1.7.7/dist/axios.min.js"></script>
		 <script src="${CDN}/lodash@4.17.21/lodash.min.js"></script>
		 <script src="${CDN}/moment@2.30.1/moment.min.js"></script>`,
		``,
		`
		const r = await axios.get("/", { responseType: "text" });
		assertEqual(r.status, 200, "axios status");
		assert(String(r.data).includes("<!DOCTYPE"), "axios body");
		assertEqual(_.template("hi <%= name %>")({ name: "x" }), "hi x", "lodash template (new Function)");
		assertEqual(moment("2020-01-02").format("YYYY/MM/DD"), "2020/01/02", "moment");
		`
	),
	page(
		"handlebars-mustache",
		`<script src="${CDN}/handlebars@4.7.8/dist/handlebars.min.js"></script>`,
		`<div id="out"></div>`,
		`
		const tpl = Handlebars.compile("<a href='{{u}}'>{{t}}</a>");
		document.getElementById("out").innerHTML = tpl({ u: "/h?a=1&b=2", t: "x" });
		assertEqual(document.querySelector("#out a").getAttribute("href"), "/h?a=1&b=2", "handlebars output href");
		`
	),
	page(
		"htmx",
		`<script src="${CDN}/htmx.org@2.0.2/dist/htmx.min.js"></script>`,
		`<button id="b" hx-get="/" hx-target="#t" hx-select="#t0" hx-swap="innerHTML">go</button><div id="t"></div><div id="t0">zero</div>`,
		`
		await until(() => window.htmx, "htmx");
		document.getElementById("b").click();
		await until(() => document.getElementById("t").textContent.includes("zero"), "htmx swap");
		`
	),
	page(
		"bootstrap5",
		`<link rel="stylesheet" href="${CDN}/bootstrap@5.3.3/dist/css/bootstrap.min.css">
		 <script src="${CDN}/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>`,
		`<div class="dropdown"><button id="dd" class="btn dropdown-toggle" data-bs-toggle="dropdown">x</button><ul class="dropdown-menu" id="menu"><li><a class="dropdown-item" href="#">a</a></li></ul></div>
		 <div class="modal" id="m"><div class="modal-dialog"><div class="modal-content">m</div></div></div>`,
		`
		await until(() => window.bootstrap, "bootstrap");
		document.getElementById("dd").click();
		await until(() => document.getElementById("menu").classList.contains("show"), "dropdown opens");
		new bootstrap.Modal("#m").show();
		await until(() => document.getElementById("m").classList.contains("show"), "modal shows");
		assertEqual(getComputedStyle(document.getElementById("dd")).display, "inline-block", "css from CDN applies");
		`
	),
	page(
		"chartjs-canvas",
		`<script src="${CDN}/chart.js@4.4.4/dist/chart.umd.min.js"></script>`,
		`<canvas id="c" width="200" height="100"></canvas>`,
		`
		const ch = new Chart(document.getElementById("c"), { type: "bar", data: { labels: ["a", "b"], datasets: [{ data: [1, 2] }] }, options: { animation: false } });
		assertEqual(ch.data.labels.length, 2, "chart created");
		const px = document.getElementById("c").getContext("2d").getImageData(0, 0, 200, 100).data;
		let painted = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) painted++;
		assert(painted > 100, "chart painted pixels: " + painted);
		`
	),
	page(
		"marked-highlight",
		`<script src="${CDN}/marked@14.1.2/marked.min.js"></script>
		 <script src="${CDN}/@highlightjs/cdn-assets@11.10.0/highlight.min.js"></script>`,
		`<div id="md"></div>`,
		`
		document.getElementById("md").innerHTML = marked.parse("# T\\n\\n[l](/md) ![i](/i.png)\\n\\n\`\`\`js\\nconst a = location;\\n\`\`\`");
		assertEqual(document.querySelector("#md a").getAttribute("href"), "/md", "marked link");
		assertEqual(document.querySelector("#md img").getAttribute("src"), "/i.png", "marked img");
		hljs.highlightElement(document.querySelector("#md code"));
		assert(document.querySelector("#md code .hljs-keyword"), "highlight.js ran");
		`
	),
	page(
		"angularjs",
		`<script src="${CDN}/angular@1.8.3/angular.min.js"></script>`,
		`<div ng-app="" ng-init="n=1"><button id="b" ng-click="n=n+1">{{n}}</button><a id="l" ng-href="/ng/{{n}}">l</a></div>`,
		`
		await until(() => document.getElementById("b").textContent === "1", "angularjs bootstrap");
		document.getElementById("b").click();
		await until(() => document.getElementById("b").textContent === "2", "digest");
		assertEqual(document.getElementById("l").getAttribute("href"), "/ng/2", "ng-href");
		`
	),
	page(
		"knockout",
		`<script src="${CDN}/knockout@3.5.1/build/output/knockout-latest.js"></script>`,
		`<button id="b" data-bind="click: inc, text: n"></button><a id="l" data-bind="attr: { href: '/ko/' + n() }">l</a>`,
		`
		const vm = { n: ko.observable(1), inc() { vm.n(vm.n() + 1); } };
		ko.applyBindings(vm);
		document.getElementById("b").click();
		assertEqual(document.getElementById("b").textContent, "2", "knockout binding");
		assertEqual(document.getElementById("l").getAttribute("href"), "/ko/2", "knockout attr");
		`
	),
	page(
		"svelte-compiled",
		`<script type="module">
			import { mount } from "${CDN}/svelte@5.1.0/src/index-client.js/+esm";
			window.svelteLoaded = typeof mount === "function";
		</script>`,
		``,
		`
		await until(() => window.svelteLoaded, "svelte module graph loads");
		`
	),
	page(
		"three-webgl",
		`<script src="${CDN}/three@0.160.0/build/three.min.js"></script>`,
		`<div id="w"></div>`,
		`
		const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
		r.setSize(50, 50);
		document.getElementById("w").appendChild(r.domElement);
		const scene = new THREE.Scene(); scene.background = new THREE.Color(0xff0000);
		r.render(scene, new THREE.PerspectiveCamera());
		assert(r.domElement.toDataURL().length > 100, "rendered");
		`
	),
	page(
		"gsap-animation",
		`<script src="${CDN}/gsap@3.12.5/dist/gsap.min.js"></script>`,
		`<div id="box" style="width:10px;height:10px"></div>`,
		`
		gsap.to("#box", { x: 100, duration: 0.1 });
		await wait(400);
		assert(document.getElementById("box").style.transform.includes("100"), "gsap transform: " + document.getElementById("box").style.transform);
		`
	),
	page(
		"styled-components",
		`<script src="${CDN}/react@18.3.1/umd/react.production.min.js"></script>
		 <script src="${CDN}/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
		 <script src="${CDN}/react-is@18.3.1/umd/react-is.production.min.js"></script>
		 <script src="${CDN}/styled-components@5.3.11/dist/styled-components.min.js"></script>`,
		`<div id="root"></div>`,
		`
		const S = styled.div\`color: rgb(0, 128, 0); background-image: url(/sc.png);\`;
		ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(S, { id: "sc" }, "x"));
		await until(() => document.getElementById("sc"), "render");
		assertEqual(getComputedStyle(document.getElementById("sc")).color, "rgb(0, 128, 0)", "styled-components CSS applied");
		`
	),
	page(
		"emotion",
		`<script src="${CDN}/@emotion/css@11.13.0/dist/emotion-css.umd.min.js"></script>`,
		`<div id="e">x</div>`,
		`
		const cls = emotion.css({ color: "rgb(0, 0, 255)", backgroundImage: "url(/em.png)" });
		document.getElementById("e").className = cls;
		assertEqual(getComputedStyle(document.getElementById("e")).color, "rgb(0, 0, 255)", "emotion CSS applied");
		`
	),
];
