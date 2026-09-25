import { nav, page, find, expect, chk } from "../a4/navlib.ts";
/* eslint-disable quotes */

// Each scenario runs on /p2, reached from / by an ordinary navigation (so the
// document's real URL is one the proxy made, as on any real second page).
// `first` performs a same-document URL change, `second` a fragment navigation
// that must stay in the same document.
const scen: [string, string, string][] = [
	["hash-then-href", `location.hash = "a"`, `location.href = "#b"`],
	["hash-then-assign", `location.hash = "a"`, `location.assign("#b")`],
	[
		"hash-then-replace-abs",
		`location.hash = "a"`,
		`location.replace(location.href.replace(/#.*$/, "") + "#b")`,
	],
	[
		"hash-then-click",
		`location.hash = "a"`,
		`const l = document.createElement("a"); l.href = "#b"; document.body.appendChild(l); l.click()`,
	],
	[
		"replacestate-query-then-click",
		`history.replaceState(null, "", location.pathname + "?utm=1")`,
		`const l = document.createElement("a"); l.href = "#b"; document.body.appendChild(l); l.click()`,
	],
	[
		"pushstate-then-href",
		`history.pushState(null, "", "/p2/deep")`,
		`location.href = "#b"`,
	],
	["control-no-first", `0`, `location.href = "#b"`],
	["control-two-hash-setters", `location.hash = "a"`, `location.hash = "b"`],
];

const carried = nav({
	name: "rv22-hash-carried-stale-top",
	routes: {
		"/": page(
			`<script>setTimeout(() => { location.href = "/start"; }, 50);</script>`
		),
		// an SPA page: route change, then an ordinary (script-created) link to the next page
		"/start": page(
			`<script>setTimeout(() => { history.pushState(null, "", "/start/route"); const l = document.createElement("a"); l.href = "/p2"; document.body.appendChild(l); l.click(); }, 50);</script>`
		),
		"/p2": page(`<script>
			const k = "rv22loads";
			const loads = +(sessionStorage.getItem(k) || 0) + 1;
			sessionStorage.setItem(k, loads);
			if (loads > 1) rep({ reloaded: true, loads, at: location.href });
			else setTimeout(() => { location.href = "#b"; setTimeout(() => rep({ done: true, at: location.href }), 800); }, 300);
		</script>`),
	},
	check: chk(
		(r) => !!find(r, (x) => x.done || x.reloaded),
		(r) => {
			const re = find(r, (x) => x.reloaded);
			expect(
				!re,
				"fragment navigation on the next page reloaded it: " +
					JSON.stringify(re)
			);
		}
	),
});

export default [
	carried,
	...scen.map(([n, first, second]) =>
		nav({
			name: "rv22-hash-" + n,
			routes: {
				"/": page(
					`<script>setTimeout(() => { location.href = "/p2"; }, 50);</script>`
				),
				"/p2": page(`<script>
				const k = "rv22loads";
				const loads = +(sessionStorage.getItem(k) || 0) + 1;
				sessionStorage.setItem(k, loads);
				if (loads > 1) { rep({ reloaded: true, loads, at: location.href }); }
				else {
					let hc = 0; addEventListener("hashchange", () => hc++);
					(async () => {
						${first};
						await new Promise(r => setTimeout(r, 300));
						${second};
						await new Promise(r => setTimeout(r, 800));
						rep({ done: true, hc, at: location.href });
					})();
				}
			</script>`),
				"/p2/deep": page(
					`<script>rep({ reloaded: true, at: location.href, deep: true });</script>`
				),
			},
			check: chk(
				(r) => !!find(r, (x) => x.done || x.reloaded),
				(r) => {
					const re = find(r, (x) => x.reloaded);
					expect(
						!re,
						"fragment navigation reloaded the document: " + JSON.stringify(re)
					);
					const d = find(r, (x) => x.done);
					expect(/#b$/.test(d.at), "ended at " + d.at);
				}
			),
		})
	),
];
