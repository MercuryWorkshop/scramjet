import { nav, page, find, req, expect, chk } from "./navlib.ts";

/* eslint-disable quotes */

const wrapB = (routes: any) => {
	const root = routes["/"];
	routes["/"] = (l: any) =>
		l.server === "B" ? page(`<script>rep({ landed: true });</script>`) : root;
	return routes;
};
const step = (
	name: string,
	steps: string[],
	finalPath: string,
	expectHref: (ctx: any) => string
) =>
	nav({
		name,
		routes: wrapB(
			Object.fromEntries(
				[["/", 0], ...steps.map((_, i) => [`/s${i + 1}/x/y`, i + 1])]
					.map(([p, i]) => [
						p as string,
						page(
							`<script>${(i as number) < steps.length ? `setTimeout(() => { try { ${steps[i as number]} } catch (e) { rep({ error: String(e) }); } }, 50);` : `rep({ landed: true });`}</script>`
						),
					])
					.concat([
						[finalPath, page(`<script>rep({ landed: true });</script>`)],
					])
			)
		),
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				const p = find(r, (x) => x.landed);
				expect(
					p.href === expectHref(ctx),
					"href " + p.href + " expected " + expectHref(ctx)
				);
			}
		),
	});

export default [
	step(
		"rv4-loc-window-location-obj",
		[`window.location = { toString() { return "/s1/x/y"; } };`],
		"/s1/x/y",
		(c) => c.A + "/s1/x/y"
	),
	step(
		"rv4-loc-document-location-assign",
		[`document.location = "/s1/x/y";`],
		"/s1/x/y",
		(c) => c.A + "/s1/x/y"
	),
	step(
		"rv4-loc-dotdot",
		[`location.href = "/s1/x/y";`, `location.href = "../../s2/x/y";`],
		"/s2/x/y",
		(c) => c.A + "/s2/x/y"
	),
	step(
		"rv4-loc-document-location-href",
		[`document.location.href = "/s1/x/y?q#h";`],
		"/s1/x/y",
		(c) => c.A + "/s1/x/y?q#h"
	),
	step(
		"rv4-loc-port-setter",
		[`location.port = new URL(${"`${B}`"}).port;`],
		"/unused",
		(c) => c.B + "/"
	),
	step(
		"rv4-loc-host-setter",
		[`location.host = "127.0.0.1:" + new URL(${"`${B}`"}).port;`],
		"/unused",
		(c) => c.C + "/"
	),
	nav({
		name: "rv4-loc-top-location-from-iframe",
		routes: {
			"/": page(`<iframe src="/in"></iframe>`),
			"/in": page(
				`<script>setTimeout(() => { try { top.location.href = "/toploc"; } catch (e) { rep({ error: String(e) }); } }, 50);</script>`
			),
			"/toploc": page(
				`<script>rep({ landed: true, isTop: window === top });</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.landed),
			(r, ctx) => {
				expect(
					find(r, (x) => x.landed).href === ctx.A + "/toploc",
					"top.location from iframe"
				);
			}
		),
	}),
	nav({
		name: "rv4-loc-parent-location-read-and-open-self",
		routes: {
			"/": page(
				`<iframe src="/in"></iframe><script>window.addEventListener("message", (e) => rep(Object.assign({ fromFrame: true }, e.data)));</script>`
			),
			"/in": page(
				`<script>parent.postMessage({ phref: parent.location.href, thref: top.location.href, anc: Array.from(location.ancestorOrigins || []) }, "*"); setTimeout(() => window.open("/selfopen", "_self"), 50);</script>`
			),
			"/selfopen": page(
				`<script>parent.postMessage({ landed: true, href: location.href, framed: window !== parent }, "*");</script>`
			),
		},
		check: chk(
			(r) => !!find(r, (x) => x.fromFrame && x.landed),
			(r, ctx) => {
				const a = find(r, (x) => x.phref);
				expect(
					a.phref.startsWith(ctx.A + "/"),
					"parent.location.href " + a.phref
				);
				expect(a.thref.startsWith(ctx.A + "/"), "top.location.href " + a.thref);
				expect(
					a.anc.length === 1 && a.anc[0] === ctx.A,
					"ancestorOrigins " + JSON.stringify(a.anc)
				);
				const l = find(r, (x) => x.landed);
				expect(
					l.framed && l.href === ctx.A + "/selfopen",
					"window.open _self in frame"
				);
			}
		),
	}),
];
