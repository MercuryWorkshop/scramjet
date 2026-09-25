import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

const land = page(`<script>rep({ landed: true });</script>`);
const L = (r: any[]) => !!find(r, (x) => x.landed || x.done);

export default [
	nav({
		name: "rv4-el-innerhtml-link",
		routes: {
			"/": page(`<div id="d"></div><script>
				document.getElementById("d").innerHTML = '<a id="l" href="/ih?x=1">x</a>';
				setTimeout(() => document.getElementById("l").click(), 50);</script>`),
			"/ih": land,
		},
		check: chk(L, (r, ctx) =>
			expect(
				find(r, (x) => x.landed).href === ctx.A + "/ih?x=1",
				"innerHTML link"
			)
		),
	}),
	nav({
		name: "rv4-el-setattribute-link-and-insertadjacent",
		routes: {
			"/": page(`<div id="d"></div><script>
				const d = document.getElementById("d");
				d.insertAdjacentHTML("beforeend", '<a id="l1" href="/nope">x</a>');
				const a = document.getElementById("l1");
				a.setAttribute("href", "sa?y=2");
				rep({ attr: a.getAttribute("href"), prop: a.href });
				setTimeout(() => a.click(), 50);</script>`),
			"/sa": land,
		},
		check: chk(L, (r, ctx) => {
			const a = find(r, (x) => x.attr !== undefined);
			expect(a.attr === "sa?y=2", "getAttribute " + a.attr);
			expect(a.prop === ctx.A + "/sa?y=2", "href prop " + a.prop);
			expect(find(r, (x) => x.landed).href === ctx.A + "/sa?y=2", "landed");
		}),
	}),
	nav({
		name: "rv4-el-template-clone-link",
		routes: {
			"/": page(`<template id="t"><a class="l" href="/tpl">x</a></template><script>
				const c = document.getElementById("t").content.cloneNode(true);
				document.body.appendChild(c);
				setTimeout(() => document.querySelector(".l").click(), 50);</script>`),
			"/tpl": land,
		},
		check: chk(L, (r, ctx) =>
			expect(find(r, (x) => x.landed).href === ctx.A + "/tpl", "template link")
		),
	}),
	nav({
		name: "rv4-el-form-clobbered-action-submit",
		routes: {
			"/": page(`<form id="f" action="/clob" method="post"><input name="action" value="av"><input name="submit" value="sv"><input name="method" value="mv"></form><script>
				const f = document.getElementById("f");
				const t = { actionIsInput: f.action instanceof HTMLInputElement, submitIsInput: f.submit instanceof HTMLInputElement, attr: f.getAttribute("action") };
				rep(t);
				setTimeout(() => HTMLFormElement.prototype.submit.call(f), 50);</script>`),
			"/clob": land,
		},
		check: chk(L, (r, ctx) => {
			const t = find(r, (x) => x.attr !== undefined);
			expect(t.actionIsInput, "form.action clobbered by input");
			expect(t.submitIsInput, "form.submit clobbered");
			expect(t.attr === "/clob", "getAttribute action " + t.attr);
			const l = req(ctx, (l) => l.url === "/clob")!;
			expect(
				l && l.method === "POST" && l.body === "action=av&submit=sv&method=mv",
				"posted " + (l && l.body)
			);
		}),
	}),
	nav({
		name: "rv4-el-button-formaction-getter-and-form-props",
		routes: {
			"/": page(`<form id="f" action="rel" target="tg" method="POST"><button id="b" formaction="fa?z=1">x</button><input id="i" type="image" formaction="/img"></form><script>
				const f = document.getElementById("f"), b = document.getElementById("b");
				rep({ done: true, action: f.action, method: f.method, target: f.target, fa: b.formAction, ifa: document.getElementById("i").formAction, enctype: f.enctype });</script>`),
		},
		check: chk(L, (r, ctx) => {
			const d = find(r, (x) => x.done);
			expect(d.action === ctx.A + "/rel", "action " + d.action);
			expect(d.method === "post", "method " + d.method);
			expect(d.target === "tg", "target " + d.target);
			expect(d.fa === ctx.A + "/fa?z=1", "formAction " + d.fa);
			expect(d.ifa === ctx.A + "/img", "input formAction " + d.ifa);
			expect(
				d.enctype === "application/x-www-form-urlencoded",
				"enctype " + d.enctype
			);
		}),
	}),
	nav({
		name: "rv4-el-dispatched-click-modifiers",
		routes: {
			"/": page(`<a id="l" href="/mod">x</a><script>
				window.addEventListener("message", () => {});
				addEventListener("pagehide", () => rep({ selfNavigated: true }));
				setTimeout(() => {
					document.getElementById("l").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
					setTimeout(() => rep({ done: true }), 1200);
				}, 50);</script>`),
			"/mod": page(
				`<script>rep({ modLanded: true, isPopup: !!window.opener || history.length === 1 });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done || x.selfNavigated),
			(r, ctx) => {
				expect(
					!find(r, (x) => x.selfNavigated),
					"ctrl-click navigated the current page instead of a new tab"
				);
			}
		),
	}),
	nav({
		name: "rv4-el-window-open-into-iframe-name",
		routes: {
			"/": page(`<iframe name="fr1" src="about:blank"></iframe><script>
				window.addEventListener("message", (e) => rep(Object.assign({ fromFrame: true }, e.data)));
				setTimeout(() => { const w = window.open("/inf", "fr1"); rep({ sameAsFrame: w === frames[0] }); }, 100);</script>`),
			"/inf": page(
				`<script>parent.postMessage({ landed: true, name: window.name, framed: window !== parent }, "*");</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.fromFrame),
			(r) => {
				const f = find(r, (x) => x.fromFrame);
				expect(
					f.framed && f.name === "fr1",
					"opened in iframe " + JSON.stringify(f)
				);
				expect(
					find(r, (x) => x.sameAsFrame !== undefined).sameAsFrame,
					"returned frame proxy"
				);
			}
		),
	}),
	nav({
		name: "rv4-el-iframe-location-replace-and-srcdoc-link",
		routes: {
			"/": page(`<iframe id="f" srcdoc='<a id=l href="/fromsrcdoc">x</a>'></iframe><script>
				const f = document.getElementById("f");
				f.onload = () => { f.onload = null; setTimeout(() => f.contentDocument.getElementById("l").click(), 50); };
				window.addEventListener("message", (e) => rep(Object.assign({ fromFrame: true }, e.data)));</script>`),
			"/fromsrcdoc": page(
				`<script>parent.postMessage({ landed: true, href: location.href, ref: document.referrer }, "*");</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.fromFrame),
			(r, ctx) => {
				const f = find(r, (x) => x.fromFrame);
				expect(
					f.href === ctx.A + "/fromsrcdoc",
					"srcdoc link resolves against parent " + f.href
				);
			}
		),
	}),
];
