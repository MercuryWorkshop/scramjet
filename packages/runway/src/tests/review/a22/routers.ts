import { SHELL, scenarioTest, type Scenario, type H } from "./lib.ts";
/* eslint-disable quotes */

const doc = (head: string, body: string) =>
	`<!doctype html><html><head><meta charset="utf-8">${SHELL}${head}</head><body>${body}</body></html>`;

/**
 * Every app renders the current route into #view, exposes window.appNav(path)
 * for programmatic navigation, and has links #l1 (to /app/about) and #l2 (to
 * /app/users/9?tab=b#sec) that the router handles itself.
 */
const stdSteps =
	(
		opts: {
			hash?: boolean;
			wait?: number;
		} = {}
	) =>
	async (h: H) => {
		const w = opts.wait ?? 700;
		await h.wait(2500);
		await h.mark("deep");
		await h.click("#l1");
		await h.wait(w);
		await h.mark("click-l1");
		await h.click("#l2");
		await h.wait(w);
		await h.mark("click-l2");
		await h.run(
			`appNav(${JSON.stringify(opts.hash ? "/users/7?x=1" : "/app/users/7?x=1")})`
		);
		await h.wait(w);
		await h.mark("appNav");
		await h.run(`history.back()`);
		await h.wait(w);
		await h.mark("back1");
		await h.run(`history.back()`);
		await h.wait(w);
		await h.mark("back2");
		await h.goForward();
		await h.mark("pw-forward");
		await h.run(`setTimeout(() => location.reload(), 10)`);
		await h.wait(3000);
		await h.mark("reloaded");
		await h.goBack();
		await h.wait(w);
		await h.mark("pw-back");
		await h.click("#l1");
		await h.wait(w);
		await h.mark("click-l1-again");
	};

const REACT = `https://esm.sh/react@18.3.1`;
const RDOM = `https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1`;

const reactRouterApp = (ver: string, hash: boolean) =>
	doc(
		"",
		`<div id="root"></div><script type="module">
	import React from "${REACT}";
	import { createRoot } from "${RDOM}";
	import * as RR from "https://esm.sh/react-router-dom@${ver}?deps=react@18.3.1,react-dom@18.3.1";
	const h = React.createElement;
	const { ${hash ? "createHashRouter" : "createBrowserRouter"}: mk, RouterProvider, Link, useLocation, Outlet } = RR;
	function Layout() {
		const loc = useLocation();
		return h("div", null,
			h(Link, { id: "l1", to: "${hash ? "" : "/app"}/about" }, "about"),
			h(Link, { id: "l2", to: "${hash ? "" : "/app"}/users/9?tab=b#sec" }, "u9"),
			h("div", { id: "view" }, loc.pathname + loc.search + loc.hash),
			h(Outlet));
	}
	const router = mk([{ path: "*", element: h(Layout) }]);
	window.appNav = (p) => router.navigate(p);
	createRoot(document.getElementById("root")).render(h(RouterProvider, { router }));
	</script>`
	);

const vueRouterApp = (hash: boolean) =>
	doc(
		`<script src="https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js"></script>
	 <script src="https://unpkg.com/vue-router@4.4.3/dist/vue-router.global.prod.js"></script>`,
		`<div id="app"><router-link id="l1" to="/about">about</router-link> <router-link id="l2" to="/users/9?tab=b#sec">u9</router-link>
	<div id="view">{{ $route.fullPath }}</div><router-view></router-view></div>
	<script>
	const C = { template: "<i>c</i>" };
	const router = VueRouter.createRouter({ history: ${hash ? "VueRouter.createWebHashHistory()" : "VueRouter.createWebHistory('/app/')"}, routes: [{ path: "/:p(.*)*", component: C }] });
	window.appNav = (p) => router.push(p.replace(/^\\/app/, ""));
	Vue.createApp({}).use(router).mount("#app");
	</script>`
	);

const pagejsApp = doc(
	`<script src="https://unpkg.com/page@1.11.6/page.js"></script>`,
	`<a id="l1" href="/app/about">about</a> <a id="l2" href="/app/users/9?tab=b#sec">u9</a><div id="view"></div>
	<script>
	page("*", (ctx) => { document.getElementById("view").textContent = ctx.canonicalPath; });
	page();
	window.appNav = (p) => page(p);
	</script>`
);

const backboneApp = (pushState: boolean) =>
	doc(
		`<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
	 <script src="https://cdn.jsdelivr.net/npm/underscore@1.13.7/underscore-umd-min.js"></script>
	 <script src="https://cdn.jsdelivr.net/npm/backbone@1.6.0/backbone-min.js"></script>`,
		`<a id="l1" href="${pushState ? "/app/about" : "#about"}">about</a> <a id="l2" href="${pushState ? "/app/users/9?tab=b" : "#users/9?tab=b"}">u9</a><div id="view"></div>
	<script>
	const R = Backbone.Router.extend({ routes: { "*path": "any" }, any(p, q) { document.getElementById("view").textContent = Backbone.history.getFragment(); } });
	new R();
	Backbone.history.start({ pushState: ${pushState}, root: "${pushState ? "/app/" : "/"}" });
	${pushState ? `$(document).on("click", "a", function (e) { e.preventDefault(); Backbone.history.navigate($(this).attr("href").replace(/^\\/app\\//, ""), { trigger: true }); });` : ""}
	window.appNav = (p) => Backbone.history.navigate(p.replace(/^\\/app\\//, "").replace(/^\\//, ""), { trigger: true });
	window.appReplace = (p) => Backbone.history.navigate(p, { trigger: true, replace: true });
	</script>`
	);

const navigoApp = doc(
	`<script src="https://cdn.jsdelivr.net/npm/navigo@8.11.1/lib/navigo.min.js"></script>`,
	`<a id="l1" href="/app/about" data-navigo>about</a> <a id="l2" href="/app/users/9?tab=b" data-navigo>u9</a><div id="view"></div>
	<script>
	const router = new Navigo("/app");
	router.on("*", (m) => { document.getElementById("view").textContent = m.url + "?" + (m.queryString || ""); }).resolve();
	window.appNav = (p) => router.navigate(p.replace(/^\\/app/, ""));
	</script>`
);

const historyjsApp = doc(
	`<script src="https://cdn.jsdelivr.net/npm/historyjs@1.8.0-b2/scripts/bundled/html5/native.history.js"></script>`,
	`<a id="l1" href="/app/about">about</a> <a id="l2" href="/app/users/9?tab=b">u9</a><div id="view"></div>
	<script>
	const render = () => { const s = History.getState(); document.getElementById("view").textContent = s.hash + " " + JSON.stringify(s.data); };
	History.Adapter.bind(window, "statechange", render);
	document.addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); History.pushState({ from: a.id }, a.id, a.getAttribute("href")); });
	window.appNav = (p) => History.pushState({ prog: 1 }, "prog", p);
	render();
	</script>`
);

// server-rendered multi page sites driven by a pjax-style library: every
// path renders its own content, the library swaps it in
const mpa = (lib: "turbo" | "swup" | "barba" | "pjax") => (url: URL) => {
	const p = url.pathname;
	const head =
		lib === "turbo"
			? `<script type="module" src="https://cdn.jsdelivr.net/npm/@hotwired/turbo@8.0.12/dist/turbo.es2017-esm.js"></script>`
			: lib === "swup"
				? `<script src="https://unpkg.com/swup@4.8.1/dist/Swup.umd.js"></script>`
				: lib === "barba"
					? `<script src="https://unpkg.com/@barba/core@2.10.3/dist/barba.umd.js"></script>`
					: `<script src="https://cdn.jsdelivr.net/npm/pjax@0.2.8/pjax.min.js"></script>`;
	const inner = `<a id="l1" href="/app/about">about</a> <a id="l2" href="/app/users/9?tab=b#sec">u9</a> <a id="l3" href="rel/child">rel</a><div id="view">${p}${url.search}</div><h2 id="sec">sec</h2>`;
	const wrapped =
		lib === "swup"
			? `<main id="swup" class="transition-fade">${inner}</main>`
			: lib === "barba"
				? `<div data-barba="wrapper"><div data-barba="container" data-barba-namespace="n">${inner}</div></div>`
				: lib === "pjax"
					? `<div id="pj">${inner}</div>`
					: inner;
	const init =
		lib === "turbo"
			? `<script type="module">document.addEventListener("turbo:load", () => __log("turbo:load")); window.appNav = (p) => Turbo.visit(p);</script>`
			: lib === "swup"
				? `<script>if (!window.__sw) { window.__sw = new Swup({ animationSelector: false }); __sw.hooks.on("page:view", () => __log("swup:view")); } window.appNav = (p) => __sw.navigate(p);</script>`
				: lib === "barba"
					? `<script>if (!window.__bi) { window.__bi = 1; barba.init({ transitions: [{ leave() {}, enter() {} }] }); barba.hooks.after(() => __log("barba:after")); } window.appNav = (p) => barba.go(p);</script>`
					: `<script>if (!window.__pj) { window.__pj = new Pjax({ selectors: ["title", "#pj"], elements: "a" }); document.addEventListener("pjax:success", () => __log("pjax:success")); } window.appNav = (p) => __pj.loadUrl(p);</script>`;
	return doc(head, wrapped + init);
};

const tanstackApp = doc(
	"",
	`<div id="root"></div><script type="module">
	import React from "${REACT}";
	import { createRoot } from "${RDOM}";
	import * as T from "https://esm.sh/@tanstack/react-router@1.87.0?deps=react@18.3.1,react-dom@18.3.1";
	const h = React.createElement;
	const Root = () => { const loc = T.useLocation(); return h("div", null,
		h(T.Link, { id: "l1", to: "/app/about" }, "about"),
		h(T.Link, { id: "l2", to: "/app/users/9", search: { tab: "b" }, hash: "sec" }, "u9"),
		h("div", { id: "view" }, loc.pathname + loc.searchStr + (loc.hash ? "#" + loc.hash : "")), h(T.Outlet)); };
	const rootRoute = T.createRootRoute({ component: Root });
	const any = T.createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => h("i", null, "c") });
	const router = T.createRouter({ routeTree: rootRoute.addChildren([any]), scrollRestoration: true });
	window.appNav = (p) => router.navigate({ to: p });
	createRoot(document.getElementById("root")).render(h(T.RouterProvider, { router }));
	</script>`
);

const vueScrollApp = doc(
	`<script src="https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js"></script>
	 <script src="https://unpkg.com/vue-router@4.4.3/dist/vue-router.global.prod.js"></script>`,
	`<div id="app" style="height:5000px"><router-link id="l1" to="/about">about</router-link> <router-link id="l2" to="/users/9?tab=b#sec">u9</router-link>
	<div id="view">{{ $route.fullPath }} {{ sy }}</div><router-view></router-view><h2 id="sec" style="margin-top:2000px">sec</h2></div>
	<script>
	const C = { template: "<i>c</i>" };
	const router = VueRouter.createRouter({ history: VueRouter.createWebHistory('/app/'), routes: [{ path: "/:p(.*)*", component: C }],
		scrollBehavior(to, from, saved) { return saved || (to.hash ? { el: to.hash } : { top: 0 }); } });
	window.appNav = (p) => router.push(p.replace(/^\/app/, ""));
	const app = Vue.createApp({ data: () => ({ sy: 0 }), mounted() { setInterval(() => { this.sy = Math.round(scrollY); }, 100); } });
	app.use(router).mount("#app");
	</script>`
);

export const scenarios: Scenario[] = [
	{
		name: "rt-tanstack",
		routes: {
			"/app": tanstackApp,
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-vue-scroll",
		routes: {
			"/app": vueScrollApp,
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: async (h) => {
			await h.run("scrollTo(0, 1234)");
			await h.wait(300);
			await stdSteps()(h);
		},
	},
	{
		name: "rt-rr6-browser",
		routes: {
			"/app": reactRouterApp("6.26.2", false),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-rr6-hash",
		routes: {
			"/app": reactRouterApp("6.26.2", true),
		},
		fallback: "/app",
		start: "/app/index#/users/42?tab=a",
		steps: stdSteps({
			hash: true,
		}),
	},
	{
		name: "rt-rr7-browser",
		routes: {
			"/app": reactRouterApp("7.1.1", false),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-vue-history",
		routes: {
			"/app": vueRouterApp(false),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-vue-hash",
		routes: {
			"/app": vueRouterApp(true),
		},
		fallback: "/app",
		start: "/app/#/users/42?tab=a",
		steps: stdSteps({
			hash: true,
		}),
	},
	{
		name: "rt-pagejs",
		routes: {
			"/app": pagejsApp,
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-backbone-push",
		routes: {
			"/app": backboneApp(true),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-backbone-hash",
		routes: {
			"/app": backboneApp(false),
		},
		fallback: "/app",
		start: "/app/#users/42?tab=a",
		steps: async (h) => {
			await stdSteps({
				hash: true,
			})(h);
			await h.run(`appReplace("replaced/1")`);
			await h.wait(700);
			await h.mark("bb-replace");
			await h.run(`appReplace("replaced/2")`);
			await h.wait(700);
			await h.mark("bb-replace2");
		},
	},
	{
		name: "rt-navigo",
		routes: {
			"/app": navigoApp,
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-historyjs",
		routes: {
			"/app": historyjsApp,
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps(),
	},
	{
		name: "rt-turbo",
		routes: {
			"/app": mpa("turbo"),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps({
			wait: 1500,
		}),
	},
	{
		name: "rt-swup",
		routes: {
			"/app": mpa("swup"),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps({
			wait: 1500,
		}),
	},
	{
		name: "rt-barba",
		routes: {
			"/app": mpa("barba"),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps({
			wait: 1500,
		}),
	},
	{
		name: "rt-pjax",
		routes: {
			"/app": mpa("pjax"),
		},
		fallback: "/app",
		start: "/app/users/42?tab=a",
		steps: stdSteps({
			wait: 1500,
		}),
	},
].map((s) => ({
	...s,
	timeoutMs: 120000,
}));

export default scenarios.map(scenarioTest);
