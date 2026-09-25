import { htmlTest } from "../../../testcommon.ts";

export default [
	htmlTest({
		name: "rv0-datascripts-parsed",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"url":"/x?a=1&b=2","html":"<b>hi</b>","loc":"location"}},"page":"/","buildId":"abc"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","url":"https://example.com","logo":"https://example.com/logo.png"}</script>
<script type="text/x-template" id="tpl-vue"><div class="t"><a :href="url">{{ location }}</a></div></script>
<script type="text/x-handlebars-template" id="tpl-hb"><a href="{{url}}">{{title}}</a> <img src="/i.png"></script>
<script type="text/template" id="tpl-plain"><% if (top) { %><a href="/p"><%= parent %></a><% } %></script>
<script type="text/babel" id="babel">const App = () => <a href="/b">{location.href}</a>;</script>
<script type="importmap">{"imports":{"lib":"/lib.js"}}</script>
<script type="module" id="mod">window.__modText = document.getElementById("mod").textContent.length;</script>
<script id="classic">var __classic = location.href.length;</script>
</head><body>
<script>
runTest(async () => {
	await new Promise((r) => setTimeout(r, 100));
	const t = (id) => document.getElementById(id).textContent;
	const out = {
		next: JSON.parse(t("__NEXT_DATA__")),
		nextInner: document.getElementById("__NEXT_DATA__").innerHTML,
		ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent),
		vue: t("tpl-vue"),
		vueInner: document.getElementById("tpl-vue").innerHTML,
		hb: document.getElementById("tpl-hb").innerHTML,
		plain: t("tpl-plain"),
		babel: t("babel"),
		importmap: document.querySelector('script[type="importmap"]').textContent,
		modLen: window.__modText,
		classic: t("classic"),
		classicText: document.getElementById("classic").text,
		classicInnerHTML: document.getElementById("classic").innerHTML,
		classicOuterHTML: document.getElementById("classic").outerHTML,
		headHTMLHasScramjet: document.head.innerHTML.includes("scramjet"),
	};
	assertConsistent("datascripts", out);
}, true);
</script></body></html>`,
	}),
];
