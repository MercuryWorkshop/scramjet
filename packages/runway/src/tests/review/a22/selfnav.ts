import { nav, page, find, expect, chk } from "../a4/navlib.ts";
/* eslint-disable quotes */

// A navigation to the document's own URL is converted to a replace natively,
// so history.length stays the same (and forward entries survive).
const scen: [string, string][] = [
	["after-pushstate", `history.pushState(null, "", "/p2/view")`],
	["control-none", `0`],
];

export default scen.map(([n, first]) =>
	nav({
		name: "rv22-selfnav-" + n,
		routes: {
			"/": page(
				`<script>setTimeout(() => { location.href = "/p2"; }, 50);</script>`
			),
			"/p2": page(`<script>
				const k = "rv22self";
				const s = JSON.parse(sessionStorage.getItem(k) || "null");
				if (s) { sessionStorage.removeItem(k); rep({ done: true, before: s.len, after: history.length, at: location.href }); }
				else {
					${first};
					setTimeout(() => { sessionStorage.setItem(k, JSON.stringify({ len: history.length })); location.href = location.href.replace(/#.*$/, ""); }, 300);
				}
			</script>`),
			"/p2/view": (req, ctx) =>
				(0, page)(`<script>
				const s = JSON.parse(sessionStorage.getItem("rv22self") || "null");
				sessionStorage.removeItem("rv22self");
				rep({ done: true, before: s && s.len, after: history.length, at: location.href });
			</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done),
			(r) => {
				const d = find(r, (x) => x.done);
				expect(
					d.before === d.after,
					"history.length " + d.before + " -> " + d.after + " at " + d.at
				);
			}
		),
	})
);
