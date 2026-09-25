import { hdrTest } from "./nonce.ts";

const js = `
runTest(async () => {
	const out = {};
	const f = document.createElement("iframe"); f.srcdoc = '<script nonce="sd">window.__n = document.currentScript.nonce<\\/script><style nonce="st"></style>'; document.body.append(f);
	await new Promise(r => { f.onload = r; setTimeout(r, 2000); });
	const d = f.contentDocument;
	out.inner = f.contentWindow.__n;
	out.fromParent = [d.scripts[0].nonce, d.scripts[0].getAttribute("nonce"), d.querySelector("style").nonce, d.querySelectorAll("[nonce]").length];
	const s = d.createElement("script"); s.setAttribute("nonce", "p"); out.created = [s.nonce, s.getAttribute("nonce")];
	const s2 = d.createElement("script"); s2.nonce = "q"; out.createdIDL = [s2.nonce, s2.getAttribute("nonce")];
	const moved = document.adoptNode(d.scripts[0]); out.adopted = [moved.nonce, moved.getAttribute("nonce")];
	const g = document.createElement("iframe"); document.body.append(g);
	await new Promise(r => setTimeout(r, 300));
	const w = frames[frames.length - 1];
	const s3 = w.document.createElement("script"); s3.setAttribute("nonce", "u"); out.viaFrames = [s3.nonce, s3.getAttribute("nonce")];
	const tpl = document.createElement("template"); tpl.innerHTML = '<script nonce="tp"><\\/script>'; out.template = [tpl.content.firstChild.nonce, document.importNode(tpl.content, true).firstChild.nonce];
	const dp = new DOMParser().parseFromString('<script nonce="dp"><\\/script>', "text/html"); out.domparser = [dp.scripts[0].nonce, document.importNode(dp.scripts[0], true).nonce];
	assertConsistent("nonceframes", out);
	fail("R " + JSON.stringify(out));
}, false);
`;
export default [
	hdrTest({
		name: "rv25-nonce-frames",
		routes: {
			"/": {
				body: `<!DOCTYPE html><body><script>${js}</script></body>`,
			},
		},
	}),
];
