import { htmlTest } from "../../../testcommon.ts";

// Real framework smoke tests: load the framework from jsdelivr through the
// proxy, render something attribute/markup heavy, compare against bare Chrome.

const fw = (name: string, scripts: string[], body: string, js: string) =>
	htmlTest({
		name: `rv2-fw-${name}`,
		html: `<!DOCTYPE html><html><head>${scripts.map((s) => `<script src="${s}"></script>`).join("")}</head><body>${body}<script>
		runTest(async () => {
			const R = {};
			const rec = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		}, true);
		</script></body></html>`,
	});

export default [
	fw(
		"react",
		[
			"https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js",
			"https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js",
		],
		`<div id=root></div>`,
		`
		const e = React.createElement;
		let clicks = 0;
		function App({ n }) {
			return e("div", { className: "app", "data-n": n, style: { backgroundImage: "url(/bg.png)", color: "red" } },
				e("a", { href: "/item/" + n, target: "_blank", rel: "noopener" }, "link " + n),
				e("img", { src: "/img/" + n + ".png", srcSet: "/a.png 1x, /b.png 2x", alt: "i" }),
				e("div", { dangerouslySetInnerHTML: { __html: "<b>bold</b><a href='/inner'>in</a><img src='/in.png'>" } }),
				e("button", { onClick: () => clicks++, id: "btn" }, "b"),
				e("form", { action: "/submit" }, e("input", { name: "q", defaultValue: "v" })),
				e("iframe", { src: "about:blank", title: "f" }),
				e("script", { type: "application/json", dangerouslySetInnerHTML: { __html: '{"a":1}' } }),
				e("svg", { viewBox: "0 0 10 10" }, e("use", { href: "#i", xlinkHref: "#j" }), e("image", { href: "/s.png" })),
			);
		}
		const root = ReactDOM.createRoot(document.getElementById("root"));
		ReactDOM.flushSync(() => root.render(e(App, { n: 1 })));
		await rec("html1", () => document.getElementById("root").innerHTML);
		ReactDOM.flushSync(() => root.render(e(App, { n: 2 })));
		await rec("html2", () => document.getElementById("root").innerHTML);
		document.getElementById("btn").click();
		await rec("clicks", () => clicks);
		await rec("a", () => [document.querySelector("#root a").href, document.querySelector("#root a").getAttribute("href")]);
		await rec("img", () => [document.querySelector("#root img").src, document.querySelector("#root img").srcset]);
		// hydration
		const host = document.createElement("div");
		host.innerHTML = '<div class="app" data-n="3" style="background-image:url(/bg.png);color:red"><a href="/item/3" target="_blank" rel="noopener">link <!-- -->3</a></div>';
		document.body.appendChild(host);
		const errs = [];
		const oe = console.error; console.error = (...a) => errs.push(String(a[0]).slice(0, 80));
		function H() { return e("div", { className: "app", "data-n": 3, style: { backgroundImage: "url(/bg.png)", color: "red" } }, e("a", { href: "/item/3", target: "_blank", rel: "noopener" }, "link ", 3)); }
		ReactDOM.flushSync(() => ReactDOM.hydrateRoot(host, e(H)));
		await new Promise(r => setTimeout(r, 100));
		console.error = oe;
		await rec("hydrate errs", () => errs);
		await rec("hydrate html", () => host.innerHTML);
		`
	),
	fw(
		"vue",
		["https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.js"],
		`<div id=app><a :href="'/v/' + n">link {{ n }}</a><img :src="src" :srcset="srcset"><div v-html="raw"></div><button @click="n++" id=vb>b</button><p :style="{ backgroundImage: 'url(/vbg.png)' }" :class="{ on: n > 1 }">{{ msg }}</p><svg viewBox="0 0 1 1"><use :href="'#i' + n"></use></svg><component :is="'script'" type="text/x-tpl">x</component></div>`,
		`
		const app = Vue.createApp({ data: () => ({ n: 1, src: "/vi.png", srcset: "/a.png 1x", raw: "<i>raw</i><a href='/r'>r</a>", msg: "hi" }) });
		const vm = app.mount("#app");
		await rec("html1", () => document.getElementById("app").innerHTML);
		document.getElementById("vb").click();
		await Vue.nextTick();
		await rec("html2", () => document.getElementById("app").innerHTML);
		await rec("a", () => document.querySelector("#app a").href);
		// runtime template compile from string
		const c = Vue.createApp({ template: "<div><a href='/t'>t</a><img :src=\\"'/x' + 1 + '.png'\\"></div>" });
		const host = document.createElement("div"); document.body.appendChild(host);
		c.mount(host);
		await rec("compiled", () => host.innerHTML);
		`
	),
	fw(
		"jquery",
		["https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.js"],
		`<div id=jq><a href="/orig" class="l">o</a><img src="/o.png" data-src="/lazy.png"></div>`,
		`
		const $ = jQuery;
		await rec("attr", () => [$("#jq a").attr("href"), $("#jq a").prop("href"), $("#jq img").attr("src"), $("#jq img").data("src")]);
		$("#jq a").attr("href", "/changed");
		$("#jq img").attr({ src: "/n.png", srcset: "/n2.png 2x" });
		await rec("attr2", () => [$("#jq a").attr("href"), $("#jq a")[0].href, $("#jq").html()]);
		$("#jq").append("<script>window.__jq = location.host<\\/script><p class=added><a href='/app'>x</a></p>");
		await rec("append", () => [window.__jq, $("#jq p.added a").attr("href"), $("#jq").children().length]);
		const parsed = $.parseHTML("<div><img src='/p.png'><a href='/pa'>p</a></div>");
		await rec("parseHTML", () => [$(parsed).find("a").attr("href"), $(parsed).find("a")[0].href, parsed[0].outerHTML]);
		await rec("sel", () => [$("a[href='/changed']").length, $("a[href^='/ch']").length, $("[src$='n.png']").length, $("#jq a:not([href])").length]);
		$("#jq a").removeAttr("href");
		await rec("removeAttr", () => [$("#jq a").attr("href"), $("#jq a")[0].outerHTML]);
		await rec("clone", () => $("#jq").clone().html());
		await rec("text", () => $("<script>var a = location;<\\/script>").text());
		await rec("each attributes", () => { const o = []; $.each($("#jq img")[0].attributes, (i, a) => o.push(a.name + "=" + a.value)); return o; });
		$("#jq").html("<form action='/f'><input type=image src='/btn.png'></form>");
		await rec("form", () => [$("#jq form").attr("action"), $("#jq form")[0].action, $("#jq input").prop("src")]);
		await rec("css", () => { $("#jq form").css("background-image", "url(/c.png)"); return [$("#jq form").attr("style"), $("#jq form").css("background-image")]; });
		const d = $.Deferred();
		await rec("globalEval", () => { $.globalEval("window.__ge = location.host"); return window.__ge; });
		`
	),
	fw(
		"lit",
		[],
		`<div id=lit></div>`,
		`
		const { html, render, svg } = await import("https://cdn.jsdelivr.net/npm/lit-html@3.2.1/lit-html.js");
		const t = (n) => html\`<div class="x \${n}" style="color: red"><a href=\${"/l/" + n} target="_blank">l\${n}</a><img src="/li/\${n}.png" alt=\${n}><button @click=\${() => window.__lc = (window.__lc||0)+1} id=lb>b</button><svg viewBox="0 0 1 1"><use href=\${"#u" + n}></use></svg>\${html\`<b>nested</b>\`}</div>\`;
		render(t(1), document.getElementById("lit"));
		await rec("html1", () => document.getElementById("lit").innerHTML.replace(/<!--\\?lit\\$[0-9]+\\$-->|<!---->/g, ""));
		render(t(2), document.getElementById("lit"));
		await rec("html2", () => document.getElementById("lit").innerHTML.replace(/<!--\\?lit\\$[0-9]+\\$-->|<!---->/g, ""));
		document.getElementById("lb").click();
		await rec("click", () => window.__lc);
		await rec("a", () => document.querySelector("#lit a").href);
		`
	),
	fw(
		"alpine",
		[],
		`<div id=al x-data="{ n: 1, url: '/al/1' }"><a :href="url" id=ala>a</a><span x-text="n" id=als></span><button @click="n++; url = '/al/' + n" id=alb>b</button><img x-bind:src="'/ai' + n + '.png'"></div>`,
		`
		await new Promise((res) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"; s.onload = res; document.head.appendChild(s); });
		await new Promise(r => setTimeout(r, 300));
		await rec("init", () => document.getElementById("al").innerHTML);
		document.getElementById("alb").click();
		await new Promise(r => setTimeout(r, 100));
		await rec("after", () => [document.getElementById("al").innerHTML, document.getElementById("ala").href]);
		`
	),
];
