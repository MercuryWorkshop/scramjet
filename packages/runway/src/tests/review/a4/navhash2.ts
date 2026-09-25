import { nav, page, find, expect, chk } from "./navlib.ts";
/* eslint-disable quotes */
const mk = (name: string, steps: string) =>
	nav({
		name,
		routes: {
			"/": page(`<a id="a2" href="#h2">a</a><script>
				const n = +(sessionStorage.getItem("${name}") || 0) + 1; sessionStorage.setItem("${name}", n);
				window.hc = 0; addEventListener("hashchange", () => window.hc++);
				if (n === 1) (async () => { ${steps} })();
				setTimeout(() => rep({ landed: true, n, hc: window.hc, hash: location.hash }), 1500);
				</script>`),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const loads = ctx.log.length;
				const p = find(r, (x) => x.landed);
				expect(
					loads === 1,
					`page reloaded (${loads} GETs) hash=${p.hash} n=${p.n}`
				);
				expect(p.hc >= 1, "hashchange " + p.hc);
			}
		),
	});
const w = "await new Promise(r => setTimeout(r, 300));";
export default [
	mk("rv4-hash2-click-first", `document.getElementById("a2").click();`),
	mk(
		"rv4-hash2-set-then-click",
		`location.hash = "h1"; ${w} document.getElementById("a2").click();`
	),
	mk(
		"rv4-hash2-set-then-href",
		`location.hash = "h1"; ${w} location.href = "#h3";`
	),
	mk(
		"rv4-hash2-click-created",
		`const a = document.createElement("a"); a.href = "#h9"; document.body.append(a); a.click();`
	),
];
