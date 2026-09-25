import { nav, page, find, expect, chk } from "../a4/navlib.ts";
/* eslint-disable quotes */

// Reload an SPA at a route reached by pushState, then import() the entry
// module that the page's HTML already loaded: it must be the same instance.
const js = {
	headers: {
		"Content-Type": "text/javascript",
	},
	body: `window.__count = (window.__count || 0) + 1; export const x = 1;`,
};
const mk = (pushes: string[], reloadHow: string) => ({
	"/": page(
		`<script>setTimeout(() => { location.href = "/app"; }, 50);</script>`
	),
	"/app": (req: any) =>
		page(`<script type="module" src="/entry.js"></script><script>
		const k = "rv22rl";
		if (!sessionStorage.getItem(k)) {
			sessionStorage.setItem(k, "1");
			setTimeout(() => { ${pushes.map((p) => `history.pushState(null, "", ${JSON.stringify(p)});`).join(" ")} ${reloadHow}; }, 300);
		} else {
			setTimeout(async () => { sessionStorage.removeItem(k); await import("/entry.js"); rep({ done: true, count: window.__count, at: location.href }); }, 600);
		}
	</script>`),
	"/entry.js": js,
});

// Vite/Rollup shape: the HTML loads the entry, the entry lazily imports a route
// chunk, and the chunk statically imports shared code back from the entry
const vite = (pushes: string[]) => ({
	"/": page(
		`<script>setTimeout(() => { location.href = "/app"; }, 50);</script>`
	),
	"/app": page(`<script type="module" src="/assets/index.js"></script><script>
		const k = "rv22rlv";
		if (!sessionStorage.getItem(k)) {
			sessionStorage.setItem(k, "1");
			setTimeout(() => { ${pushes.map((p) => (p.startsWith("!") ? p.slice(1) + ";" : `history.pushState(null, "", ${JSON.stringify(p)});`)).join(" ")} location.reload(); }, 500);
		} else {
			setTimeout(() => { sessionStorage.removeItem(k); rep({ done: true, count: window.__entry, mounts: window.__mounts, at: location.href }); }, 1200);
		}
	</script>`),
	"/assets/index.js": {
		headers: {
			"Content-Type": "text/javascript",
		},
		body: `window.__entry = (window.__entry || 0) + 1; export const store = { id: Math.random() }; import("./About.js").then((m) => m.mount());`,
	},
	"/assets/About.js": {
		headers: {
			"Content-Type": "text/javascript",
		},
		body: `import { store } from "./index.js"; export function mount() { window.__mounts = (window.__mounts || 0) + 1; }`,
	},
});

// back to the SPA from the next page (iframes have no bfcache, so this is a fresh load of the entry URL)
const back = {
	"/": page(
		`<script>setTimeout(() => { location.href = "/app"; }, 50);</script>`
	),
	"/app": page(`<script type="module" src="/assets/index.js"></script><script>
		const k = "rv22bk";
		if (!sessionStorage.getItem(k)) {
			sessionStorage.setItem(k, "1");
			setTimeout(() => { history.pushState(null, "", "/app?route=a"); history.pushState(null, "", "/app?route=b"); location.href = "/other"; }, 500);
		} else {
			setTimeout(() => { sessionStorage.removeItem(k); rep({ done: true, count: window.__entry, mounts: window.__mounts, at: location.href }); }, 1200);
		}
	</script>`),
	"/other": page(`<script>setTimeout(() => history.back(), 300);</script>`),
	"/assets/index.js": vite([])["/assets/index.js"],
	"/assets/About.js": vite([])["/assets/About.js"],
};

export default [
	nav({
		name: "rv22-reloadtop-back-from-next-page",
		routes: back,
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry evaluated " +
						d.count +
						" times, mounted " +
						d.mounts +
						" times after back to " +
						d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-vite-shape",
		routes: vite(["/app?route=about", "/app?route=about&tab=2"]),
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry evaluated " +
						d.count +
						" times, mounted " +
						d.mounts +
						" times after reload at " +
						d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-vite-shape-one-push-plus-scroll-replace",
		routes: vite([
			"/app?route=about",
			"!history.replaceState({ scroll: 120 }, '', location.href)",
		]),
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry evaluated " +
						d.count +
						" times, mounted " +
						d.mounts +
						" times after reload at " +
						d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-vite-shape-control-one-push",
		routes: vite(["/app?route=about"]),
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry evaluated " +
						d.count +
						" times, mounted " +
						d.mounts +
						" times after reload at " +
						d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-two-pushes",
		routes: {
			...mk(["/app?r=1", "/app?r=2"], "location.reload()"),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry module evaluated " + d.count + " times after reload at " + d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-one-push",
		routes: {
			...mk(["/app?r=1"], "location.reload()"),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry module evaluated " + d.count + " times after reload at " + d.at
				);
			}
		),
	}),
	nav({
		name: "rv22-reloadtop-two-pushes-href",
		routes: {
			...mk(["/app?r=1", "/app?r=2"], "location.href = location.href"),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.count === 1,
					"entry module evaluated " + d.count + " times after reload at " + d.at
				);
			}
		),
	}),
];
