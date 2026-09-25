import { nav, page, find, expect, chk } from "./navlib.ts";
/* eslint-disable quotes */
const script = (name: string, body: string) => `
	const n = +(sessionStorage.getItem("${name}") || 0) + 1; sessionStorage.setItem("${name}", n);
	const W = () => new Promise(r => setTimeout(r, 300));
	if (n === 1) (async () => { try { ${body} rep({ done: true, hash: location.hash }); } catch (e) { rep({ error: String(e) }); } })();
	else rep({ reloaded: true, n, hash: location.hash });`;
const check = chk(
	(r) => !!find(r, (x) => x.done || x.reloaded),
	(r) => {
		const re = find(r, (x) => x.reloaded);
		expect(!re, "page reloaded, hash=" + (re && re.hash));
	}
);
const body = `location.href = "#h3"; await W();`;
export default [
	nav({
		name: "rv4-hash6-cacheable",
		routes: {
			"/": {
				headers: {
					"Cache-Control": "max-age=0",
				},
				body: page(`<script>${script("rv4-hash6-cacheable", body)}</script>`),
			},
		},
		check,
	}),
	nav({
		name: "rv4-hash6-extscript",
		routes: {
			"/": `<!doctype html><html><head>${"<script>window.rep = (d) => fetch('/report', { method: 'POST', keepalive: true, body: JSON.stringify(d) });</script>"}</head><body><script src="/s.js"></script></body></html>`,
			"/s.js": {
				headers: {
					"Content-Type": "application/javascript",
				},
				body: script("rv4-hash6-extscript", body),
			},
		},
		check,
	}),
	nav({
		name: "rv4-hash6-afterload",
		routes: {
			"/": page(
				`<script>addEventListener("load", () => setTimeout(() => { ${script("rv4-hash6-afterload", body)} }, 500));</script>`
			),
		},
		check,
	}),
];
