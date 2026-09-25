import { SHELL, scenarioTest, type Scenario } from "./lib.ts";
/* eslint-disable quotes */

const shellPage = (body = "") =>
	`<!doctype html><html><head><meta charset="utf-8">${SHELL}</head><body>${body}</body></html>`;

export const scenarios: Scenario[] = [
	{
		name: "plat-base-href",
		routes: {
			"/app": `<!doctype html><html><head><meta charset="utf-8"><base href="/">${SHELL}</head><body><a id=a1 href="about">about</a><img id=i1 src="img/x.png"><script>
				window.probe = (tag) => {
					const b = document.querySelector("base");
					const a = document.getElementById("a1");
					const d = document.createElement("a"); d.href = "dyn/y";
					fetch("api/" + tag).catch(() => {});
					__log("probe", { tag, baseURI: document.baseURI, baseHref: b.href, baseAttr: b.getAttribute("href"), a: a.href, d: d.href, img: document.getElementById("i1").src, u: new URL("rel", document.baseURI).href, pathname: location.pathname });
				};
				probe("load");
			</script></body></html>`,
		},
		fallback: "/app",
		start: "/app/deep/link",
		steps: async (h) => {
			await h.run(`history.pushState(null, '', '/about')`);
			await h.run(`probe('push-abs')`);
			await h.run(`history.pushState(null, '', '/app/x/y/z?q=1')`);
			await h.run(`probe('push-deep')`);
			await h.run(
				`document.querySelector('base').setAttribute('href', '/app/')`
			);
			await h.run(`probe('base-changed')`);
			await h.run(
				`const b = document.createElement('base'); b.href = '/zz/'; document.head.prepend(b); probe('base-prepended')`
			);
			await h.wait(500);
		},
	},
	{
		name: "plat-push-reload-back",
		routes: {
			"/app": shellPage("<a id=l href='rel'>rel</a>"),
		},
		fallback: "/app",
		start: "/app/deep/link?q=1#h",
		steps: async (h) => {
			await h.run(`history.pushState({a:1},'','/app/second?x=2')`);
			await h.run(`history.pushState({a:2},'','third#frag')`);
			await h.run(
				`history.replaceState(Object.assign({}, history.state, {scroll: 100}), '')`
			);
			await h.mark("pre-reload");
			await h.run(`setTimeout(() => location.reload(), 10)`);
			await h.wait(1500);
			await h.mark("post-reload");
			await h.run(`history.back()`);
			await h.wait(700);
			await h.run(`history.back()`);
			await h.wait(700);
			await h.mark("pw-forward");
			await h.goForward();
			await h.mark("pw-back");
			await h.goBack();
			await h.wait(300);
		},
	},
	{
		name: "plat-referrer-name",
		routes: {
			"/a": shellPage(),
			"/a/next": shellPage(),
		},
		fallback: "/a",
		start: "/a",
		steps: async (h) => {
			await h.run(`window.name = 'persist'`);
			await h.run(`history.pushState({p:1},'','/a/pushed?z=1')`);
			await h.run(`setTimeout(() => { location.href = 'next'; }, 10)`);
			await h.wait(1500);
			await h.mark("on-next");
			await h.run(`history.back()`);
			await h.wait(1500);
			await h.mark("back-on-pushed");
			await h.run(`history.back()`);
			await h.wait(800);
		},
	},
	{
		name: "plat-location-setters",
		routes: {
			"/l": shellPage(),
		},
		fallback: "/l",
		start: "/l/one/two?a=1",
		steps: async (h) => {
			await h.run(`setTimeout(() => { location.search = '?p=2'; }, 10)`);
			await h.wait(1500);
			await h.run(`setTimeout(() => { location.pathname = '/l/x/y'; }, 10)`);
			await h.wait(1500);
			await h.run(`setTimeout(() => { location.assign('../z?k=1'); }, 10)`);
			await h.wait(1500);
			await h.run(`setTimeout(() => { location.replace('w#hh'); }, 10)`);
			await h.wait(1500);
			await h.run(`setTimeout(() => { location.href = '?only=query'; }, 10)`);
			await h.wait(1500);
			await h.run(`history.back()`);
			await h.wait(1500);
		},
	},
	{
		name: "plat-hash-routing",
		routes: {
			"/h": shellPage(),
		},
		start: "/h",
		steps: async (h) => {
			await h.run(`location.hash = '/r1'`);
			await h.wait(200);
			await h.run(`location.hash = '#/r2?x=1'`);
			await h.wait(200);
			await h.run(`history.back()`);
			await h.wait(500);
			await h.goForward();
			await h.run(`history.pushState(null, '', '#/r3')`);
			await h.run(`history.replaceState({k:1}, '', '#/r4')`);
			await h.run(`history.go(-1)`);
			await h.wait(500);
			await h.run(`location.hash = ''`);
			await h.wait(300);
		},
	},
	{
		name: "plat-state-edge",
		routes: {
			"/s": shellPage(),
		},
		fallback: "/s",
		start: "/s/p",
		steps: async (h) => {
			const r = await h.run(`(() => { const out = {};
				const tryit = (k, f) => { try { f(); out[k] = location.href + ' | ' + JSON.stringify(history.state); } catch (e) { out[k] = 'THROW ' + e.name + ': ' + e.message; } };
				tryit('undef-url', () => history.pushState({u:1}, '', undefined));
				tryit('null-url', () => history.pushState({u:2}, '', null));
				tryit('empty-url', () => history.pushState({u:3}, '', ''));
				tryit('zero', () => history.pushState({u:4}, '', 0));
				tryit('urlobj', () => history.pushState({u:5}, '', new URL('/s/obj?y', location.href)));
				tryit('one-arg', () => history.pushState({u:6}));
				tryit('title-null', () => history.pushState({u:7}, null, '/s/tn'));
				tryit('abs-same', () => history.pushState({u:8}, '', location.origin + '/s/abs'));
				tryit('cross', () => history.pushState({u:9}, '', 'https://example.com/x'));
				tryit('schemerel', () => history.pushState({u:10}, '', '//example.com/x'));
				tryit('dotdot', () => history.replaceState({u:11}, '', '../../..'));
				tryit('qonly', () => history.replaceState({u:12}, '', '?q'));
				tryit('bigstate', () => history.replaceState({u:13, big: 'x'.repeat(100000)}, ''));
				tryit('fn-state', () => history.replaceState({f: () => 1}, ''));
				tryit('spaces', () => history.replaceState(null, '', '/s/a b/ü?x=ä y#frag ment'));
				tryit('pct', () => history.replaceState(null, '', '/s/%2e%2e/%41?%zz'));
				out.url = document.URL; out.doc = document.documentURI; out.base = document.baseURI; out.len = history.length;
				return out; })()`);
			await h.run(`__log("edge-result", ${JSON.stringify({ r })})`);
		},
	},
];

export default scenarios.map(scenarioTest);
