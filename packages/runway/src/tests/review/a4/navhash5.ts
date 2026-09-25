import { nav, page, find, expect, chk } from "./navlib.ts";
/* eslint-disable quotes */
const mk = (name: string, body: string) =>
	nav({
		name,
		routes: {
			"/": page(`<script>
			const n = +(sessionStorage.getItem("${name}") || 0) + 1; sessionStorage.setItem("${name}", n);
			const W = () => new Promise(r => setTimeout(r, 300));
			let hc = 0; addEventListener("hashchange", () => hc++);
			if (n === 1) (async () => { try { ${body} rep({ done: true, hc, hash: location.hash }); } catch (e) { rep({ error: String(e) }); } })();
			else rep({ reloaded: true, n, hash: location.hash });
			</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.done || x.reloaded),
			(r, ctx) => {
				const re = find(r, (x) => x.reloaded);
				expect(
					!re,
					"page reloaded, hash=" +
						(re && re.hash) +
						" steps=" +
						JSON.stringify(
							r.filter((x) => x.step).map((x) => x.step + ":" + x.hash)
						)
				);
			}
		),
	});
export default [
	mk(
		"rv4-hash5-a",
		`location.hash = "h1"; await W(); rep({ step: 1, hash: location.hash }); location.href = "#h3"; await W();`
	),
	mk(
		"rv4-hash5-b",
		`location.hash = "h1"; await W(); const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click(); await W(); rep({ step: 2, hash: location.hash }); location.href = "#h3"; await W();`
	),
	mk(
		"rv4-hash5-c",
		`const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click(); await W();`
	),
	mk("rv4-hash5-d", `location.href = "#h3"; await W();`),
];
