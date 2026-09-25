import { serverTest, type Test } from "../../../testcommon.ts";

const PRE = `
window.__errs = [];
addEventListener("error", e => __errs.push(String(e.message)));
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
const probe = (cls) => { const d = document.createElement("div"); d.className = cls; document.body.appendChild(d); const c = getComputedStyle(d); return c; };
const colorOf = (cls) => probe(cls).color;
const RED = "rgb(255, 0, 0)";
const imgLoaded = async (cls) => { const c = probe(cls); return c.backgroundImage; };
`;

const cases: Record<string, string> = {
	"style-textContent-after": `const s = document.createElement("style"); document.head.appendChild(s); s.textContent = ".a{color:red}"; assertEqual(colorOf("a"), RED);`,
	"style-textContent-before": `const s = document.createElement("style"); s.textContent = ".a{color:red}"; document.head.appendChild(s); assertEqual(colorOf("a"), RED);`,
	"style-appendChild-textnode": `const s = document.createElement("style"); document.head.appendChild(s); s.appendChild(document.createTextNode(".a{color:red}")); assertEqual(colorOf("a"), RED);`,
	"style-multiple-textnodes": `const s = document.createElement("style"); document.head.appendChild(s); s.appendChild(document.createTextNode(".a{color:red}")); s.appendChild(document.createTextNode(".b{color:red}")); assertEqual(colorOf("a"), RED); assertEqual(colorOf("b"), RED); assertEqual(s.textContent, ".a{color:red}.b{color:red}");`,
	"style-textnode-data-update": `const s = document.createElement("style"); const t = document.createTextNode(".a{color:blue}"); s.appendChild(t); document.head.appendChild(s); t.data = ".a{color:red}"; assertEqual(colorOf("a"), RED); t.appendData(".b{color:red}"); assertEqual(colorOf("b"), RED);`,
	"emotion-insertRule": `const s = document.createElement("style"); s.setAttribute("data-emotion", "css"); document.head.appendChild(s); s.sheet.insertRule(".a{color:red}", 0); assertEqual(colorOf("a"), RED);`,
	"styled-components-textnode-per-rule": `const s = document.createElement("style"); s.setAttribute("data-styled", "active"); document.head.appendChild(s);
		for (let i = 0; i < 50; i++) s.appendChild(document.createTextNode(".sc" + i + "{color:red}"));
		assertEqual(colorOf("sc0"), RED); assertEqual(colorOf("sc49"), RED); assertEqual(s.childNodes.length, 50);
		assertEqual(s.childNodes[3].textContent, ".sc3{color:red}");`,
	"styled-components-insertBefore-textnode": `const s = document.createElement("style"); document.head.appendChild(s); const a = document.createTextNode(".x{color:blue}"); s.appendChild(a); s.insertBefore(document.createTextNode(".a{color:red}"), a); assertEqual(colorOf("a"), RED);`,
	"style-url-relative": `const s = document.createElement("style"); s.textContent = ".i{background-image:url(img.png)}"; document.head.appendChild(s); const bg = probe("i").backgroundImage; assert(bg.includes("img.png"), bg); assertEqual(s.textContent, ".i{background-image:url(img.png)}");`,
	"style-import": `const s = document.createElement("style"); s.textContent = "@import url(/imp.css);"; document.head.appendChild(s); await tick(500); assertEqual(colorOf("imp"), RED);`,
	"style-import-string": `const s = document.createElement("style"); s.textContent = '@import "/imp.css";'; document.head.appendChild(s); await tick(500); assertEqual(colorOf("imp"), RED);`,
	"style-font-face": `const s = document.createElement("style"); s.textContent = "@font-face{font-family:rv8f;src:url(/font.woff2) format('woff2')} .f{font-family:rv8f}"; document.head.appendChild(s); probe("f").fontFamily; await tick(300); const ok = await document.fonts.load("12px rv8f").then(() => true, () => false); assert(ok, "font load resolved"); assertEqual(s.textContent.includes("url(/font.woff2)"), true);`,
	"link-stylesheet": `await new Promise((res, rej) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/imp.css"; l.onload = res; l.onerror = () => rej(new Error("link error")); document.head.appendChild(l); }); assertEqual(colorOf("imp"), RED);`,
	"link-stylesheet-href-after": `await new Promise((res, rej) => { const l = document.createElement("link"); l.rel = "stylesheet"; document.head.appendChild(l); l.onload = res; l.onerror = () => rej(new Error("link error")); l.href = "/imp.css"; }); assertEqual(colorOf("imp"), RED);`,
	"link-relative-url-in-css": `await new Promise((res, rej) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/sub/rel.css"; l.onload = res; l.onerror = () => rej(new Error("link error")); document.head.appendChild(l); }); await tick(300); assertEqual(colorOf("relimp"), RED, "@import relative to sheet");`,
	"style-media-change": `const s = document.createElement("style"); s.media = "print"; s.textContent = ".a{color:red}"; document.head.appendChild(s); assert(colorOf("a") !== RED); s.media = "all"; assertEqual(colorOf("a"), RED);`,
	"style-disabled": `const s = document.createElement("style"); s.textContent = ".a{color:red}"; document.head.appendChild(s); s.disabled = true; assert(colorOf("a") !== RED, "disabled"); s.disabled = false; assertEqual(colorOf("a"), RED);`,
	"shadow-style": `const h = document.createElement("div"); document.body.appendChild(h); const sr = h.attachShadow({mode:"open"}); sr.innerHTML = "<style>.a{color:red}</style><div class=a></div>"; assertEqual(getComputedStyle(sr.querySelector(".a")).color, RED); const s2 = document.createElement("style"); s2.textContent = ".b{color:red}"; sr.appendChild(s2); const d = document.createElement("div"); d.className = "b"; sr.appendChild(d); assertEqual(getComputedStyle(d).color, RED);`,
	"shadow-adoptedStyleSheets": `const h = document.createElement("div"); document.body.appendChild(h); const sr = h.attachShadow({mode:"open"}); const sh = new CSSStyleSheet(); sh.replaceSync(".a{color:red}"); sr.adoptedStyleSheets = [sh]; sr.innerHTML = "<div class=a></div>"; assertEqual(getComputedStyle(sr.querySelector(".a")).color, RED);`,
	"innerHTML-style": `const d = document.createElement("div"); d.innerHTML = "<style>.a{color:red}</style>"; document.body.appendChild(d); assertEqual(colorOf("a"), RED); assertEqual(d.innerHTML, "<style>.a{color:red}</style>");`,
	"parsed-style-readback": `const s = document.getElementById("ps"); assertEqual(s.textContent, ".ps{background:url(img.png)}"); assertEqual(s.innerHTML, ".ps{background:url(img.png)}");`,
	"style-clone": `const s = document.createElement("style"); s.textContent = ".a{color:red}"; const c = s.cloneNode(true); document.head.appendChild(c); assertEqual(colorOf("a"), RED); assertEqual(c.textContent, ".a{color:red}");`,
	"style-innerHTML-set": `const s = document.createElement("style"); document.head.appendChild(s); s.innerHTML = ".a{color:red}"; assertEqual(colorOf("a"), RED);`,
	"style-attribute-url": `const d = document.createElement("div"); d.style.backgroundImage = "url(img.png)"; document.body.appendChild(d); assertEqual(d.style.backgroundImage, 'url("img.png")'); d.setAttribute("style", "color:red;background:url(img.png)"); assertEqual(getComputedStyle(d).color, RED); assertEqual(d.getAttribute("style"), "color:red;background:url(img.png)");`,
	"style-large-appendData-perf": `const s = document.createElement("style"); document.head.appendChild(s); const t = document.createTextNode(""); s.appendChild(t); const t0 = performance.now(); for (let i = 0; i < 2000; i++) t.appendData(".p" + i + "{color:red}"); const ms = performance.now() - t0; assertEqual(colorOf("p1999"), RED); assert(ms < 3000, "2000 appendData took " + Math.round(ms) + "ms");`,
	"styled-perf-textnodes": `const s = document.createElement("style"); document.head.appendChild(s); const t0 = performance.now(); for (let i = 0; i < 2000; i++) s.appendChild(document.createTextNode(".q" + i + "{color:red}")); const ms = performance.now() - t0; assertEqual(colorOf("q1999"), RED); console.log("RV8PERF styled " + ms); assert(ms < 3000, "2000 appendChild took " + Math.round(ms) + "ms");`,
};

const tests: Test[] = [];
for (const [name, js] of Object.entries(cases)) {
	tests.push(
		serverTest({
			name: `rv8p2-style-${name}`,
			async start(server) {
				server.on("request", (req, res) => {
					const u = new URL(req.url || "/", "http://x");
					if (u.pathname === "/") {
						res.writeHead(200, {
							"Content-Type": "text/html",
						});
						res.end(`<!DOCTYPE html><html><head><style id="ps">.ps{background:url(img.png)}</style></head><body>
<script>${PRE}</script>
<script>
runTest(async () => {
  ${js}
  assertDeepEqual(__errs, [], "errors: " + __errs.join(" | "));
  pass();
}, false);
</script></body></html>`);
					} else if (u.pathname === "/imp.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(`.imp{color:red}`);
					} else if (u.pathname === "/sub/rel.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(`@import "rel2.css";`);
					} else if (u.pathname === "/sub/rel2.css") {
						res.writeHead(200, {
							"Content-Type": "text/css",
						});
						res.end(`.relimp{color:red}`);
					} else if (u.pathname === "/font.woff2") {
						res.writeHead(404);
						res.end();
					} else if (u.pathname === "/img.png") {
						res.writeHead(200, {
							"Content-Type": "image/png",
						});
						res.end(
							Buffer.from(
								"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
								"base64"
							)
						);
					} else {
						res.writeHead(404);
						res.end();
					}
				});
			},
		})
	);
}
export default tests;
