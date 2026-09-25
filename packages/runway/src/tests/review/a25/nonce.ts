import http from "http";
import type { AddressInfo } from "node:net";
import type { Test } from "../../../testcommon.ts";

// generic server test with custom headers and routes
export function hdrTest(props: {
	name: string;
	routes: Record<
		string,
		{
			headers?: Record<string, string>;
			body: string;
			type?: string;
		}
	>;
	scramjetOnly?: boolean;
	log?: (req: http.IncomingMessage) => void;
}): Test {
	let server: http.Server;
	const test: Test = {
		name: props.name,
		port: 0,
		scramjetOnly: props.scramjetOnly,
		async start() {
			server = http.createServer((req, res) => {
				props.log?.(req);
				const u = new URL(req.url!, "http://x");
				const r = props.routes[u.pathname];
				if (!r) {
					if (u.pathname === "/__log") {
						res.writeHead(200, {
							"content-type": "application/json",
							"access-control-allow-origin": "*",
						});
						res.end(
							JSON.stringify((globalThis as any)["__log_" + props.name] || [])
						);
						return;
					}
					res.writeHead(404);
					res.end("nf");
					return;
				}
				res.writeHead(200, {
					"content-type": r.type || "text/html",
					...(r.headers || {}),
				});
				res.end(r.body.replaceAll("$PORT", String(test.port)));
			});
			await new Promise<void>((resolve) =>
				server.listen(0, () => {
					test.port = (server.address() as AddressInfo).port;
					resolve();
				})
			);
		},
		async stop() {
			server.closeAllConnections?.();
			await new Promise<void>((r) => server.close(() => r()));
		},
	};
	return test;
}

const page = (head: string, body: string) =>
	`<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

const nonceJs = `
runTest(async () => {
	const out = {};
	const cs = document.currentScript;
	out.cs_nonce = cs && cs.nonce;
	out.cs_attr = cs && cs.getAttribute("nonce");
	out.cs_has = cs && cs.hasAttribute("nonce");
	out.qs = document.querySelector("script[nonce]") && document.querySelector("script[nonce]").nonce;
	out.qsAll = document.querySelectorAll("[nonce]").length;
	out.meta_content = document.querySelector("meta[name=csp-nonce]") && document.querySelector("meta[name=csp-nonce]").getAttribute("content");
	out.meta_nonce = document.querySelector("meta[property=csp-nonce]") && document.querySelector("meta[property=csp-nonce]").nonce;
	out.style_nonce = document.querySelector("style") && document.querySelector("style").nonce;
	out.link_nonce = document.querySelector("link[rel=stylesheet]") && document.querySelector("link[rel=stylesheet]").nonce;
	out.ext = window.__ext;
	out.ext_attr = window.__extAttr;
	// clone keeps [[CryptographicNonce]]
	out.clone = cs.cloneNode(true).nonce;
	out.importNode = document.importNode(cs, true).nonce;
	const ifr = document.createElement("iframe"); document.body.append(ifr);
	out.adopt = ifr.contentDocument.adoptNode(cs.cloneNode(true)).nonce;
	// webpack-style: propagate nonce to a dynamic script
	out.dyn = await new Promise((res) => {
		const s = document.createElement("script");
		s.nonce = cs.nonce;
		s.textContent = "window.__dyn = document.currentScript.nonce";
		document.head.appendChild(s);
		res([window.__dyn, s.nonce, s.getAttribute("nonce"), s.outerHTML]);
	});
	out.dynAttr = (() => {
		const s = document.createElement("script");
		s.setAttribute("nonce", "zz");
		s.textContent = "window.__dyn2 = document.currentScript.nonce + '|' + document.currentScript.getAttribute('nonce')";
		document.head.appendChild(s);
		return [window.__dyn2, s.nonce, s.getAttribute("nonce"), s.outerHTML];
	})();
	// emotion / styled-components pattern
	out.styleDyn = (() => {
		const st = document.createElement("style");
		st.setAttribute("nonce", out.meta_content || "x");
		st.setAttribute("data-emotion", "css");
		st.appendChild(document.createTextNode(".a{color:red}"));
		document.head.appendChild(st);
		return [st.nonce, st.getAttribute("nonce"), st.outerHTML, !!st.sheet];
	})();
	out.innerHTMLNonce = (() => {
		const d = document.createElement("div");
		d.innerHTML = '<script nonce="ih">1<\\/script><style nonce="st"></style>';
		return [d.firstChild.nonce, d.firstChild.getAttribute("nonce"), d.lastChild.nonce, d.innerHTML];
	})();
	out.setNonceIDL = (() => {
		const s = document.createElement("script");
		s.nonce = "idl";
		return [s.nonce, s.getAttribute("nonce"), s.hasAttribute("nonce"), s.outerHTML];
	})();
	out.nonceProto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "nonce") ? "own" : "none";
	out.svg = (() => { const s = document.createElementNS("http://www.w3.org/2000/svg", "script"); s.setAttribute("nonce", "sv"); return [s.nonce, s.getAttribute("nonce")]; })();
	// dataset / attributes enumeration
	out.attrs = Array.from(cs.attributes).map(a => a.name + "=" + a.value);
	out.json = JSON.stringify(Object.keys(out));
	assertConsistent("nonce", out);
	fail("R " + JSON.stringify(out));
}, false);
`;

const NONCE_PAGE = page(
	`<meta name="csp-nonce" content="abc"><meta property="csp-nonce" nonce="abc"><style nonce="abc">.x{}</style><link rel="stylesheet" nonce="abc" href="data:text/css,.y{}">`,
	`<script nonce="abc" src="/ext.js"></script><script nonce="abc" data-x="1">${nonceJs}</script>`
);
const EXT = `window.__ext = document.currentScript.nonce; window.__extAttr = document.currentScript.getAttribute("nonce");`;

export default [
	hdrTest({
		name: "rv25-nonce-nocsp",
		routes: {
			"/": {
				body: NONCE_PAGE,
			},
			"/ext.js": {
				body: EXT,
				type: "text/javascript",
			},
		},
	}),
	hdrTest({
		name: "rv25-nonce-csphdr",
		routes: {
			"/": {
				headers: {
					"content-security-policy":
						"script-src 'nonce-abc' 'strict-dynamic' 'unsafe-eval'; style-src 'nonce-abc' 'self' data:",
				},
				body: NONCE_PAGE,
			},
			"/ext.js": {
				body: EXT,
				type: "text/javascript",
			},
		},
	}),
];
