import { htmlTest } from "../../../testcommon.ts";

// Edge values through the attribute mirror: odd URLs, whitespace, unparseable
// values, very long values. setAttribute and parsed markup, read back through
// getAttribute, the reflected getter, selectors and outerHTML.

const URLS = [
	"",
	" ",
	"  /x/y  ",
	"\n/x\t",
	"http://[bad",
	"http://a b/",
	"https://exa mple.com/",
	"//",
	"http://",
	"javascript:void(0)",
	"javascript:1+1",
	"data:image/png;base64,AAAA",
	"blob:http://localhost/abc",
	"about:blank",
	"about:srcdoc",
	"#",
	"#frag",
	"?q=1",
	".",
	"..",
	"mailto:x@y.z",
	"tel:123",
	"chrome://x",
	"ws://x.test/",
	"file:///etc/passwd",
	"/ü/ñ?q=é",
	"%zz",
	"http://user:pw@host.test/",
	"HTTP://EXAMPLE.COM/A",
	"\\\\evil.test\\x",
	"/\\evil.test",
	"https://example.com:0/",
	"https://example.com:99999/",
	"http://x.test/%2e%2e/a",
	"blob:",
	"data:",
	"view-source:http://x.test/",
];

const ELS: [string, string, string][] = [
	["a", "href", "href"],
	["img", "src", "src"],
	["link", "href", "href"],
	["form", "action", "action"],
	["video", "src", "src"],
	["script", "src", "src"],
	["object", "data", "data"],
];

const SRCSETS = [
	"",
	",",
	"a.png 1x,,b.png 2x",
	"data:image/png;base64,AA== 1x",
	"/a,b.png 1x",
	" /a.png  2x , /b.png 3x ",
	"a.png 100w, b.png",
];
const STYLES = [
	"",
	"url(",
	"background:url(/x.png",
	"--x: url(/x)",
	"background: url('a\"b')",
	"color: red !important;",
	"}{",
	"background:url(data:image/png;base64,AA)",
	"background-image: image-set('/a.png' 1x)",
];
const TARGETS = [
	"_top",
	"_TOP",
	"_Top",
	"_parent",
	"_PARENT",
	"_blank",
	"_self",
	"",
	"_unfencedTop",
	"x",
];

const JS = String.raw`
const SECTION = window.SECTION;
const URLS = ${JSON.stringify(URLS)}, ELS = ${JSON.stringify(ELS)}, SRCSETS = ${JSON.stringify(SRCSETS)}, STYLES = ${JSON.stringify(STYLES)}, TARGETS = ${JSON.stringify(TARGETS)};
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name; } };
const cssq = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ").replace(/\t/g, "\\9 ") + '"';
function sig(el, n, prop, v) {
	return [
		"get=" + T(() => el.getAttribute(n)),
		"prop=" + T(() => prop ? String(el[prop]) : "-"),
		"m=" + T(() => el.matches("[" + n + "=" + cssq(v) + "]")),
		"node=" + T(() => el.getAttributeNode(n).value),
		"outer=" + T(() => el.outerHTML.length > 400 ? el.outerHTML.length : el.outerHTML),
	].join(" ;; ");
}
runTest(async () => {
	const host = document.getElementById("host");
	for (const [tag, n, prop] of ELS) { if (SECTION !== "el-" + tag) continue;
		for (let i = 0; i < URLS.length; i++) {
			const v = URLS[i];
			const el = document.createElement(tag);
			if (tag === "script") el.type = "text/x-none";
			let r;
			try { el.setAttribute(n, v); host.append(el); r = sig(el, n, prop, v); } catch (e) { r = "WRITE-THROW:" + e.name + ":" + e.message; }
			assertConsistent("sa|" + tag + "|" + i, r);
			const el2 = document.createElement(tag);
			if (tag === "script") el2.type = "text/x-none";
			try { el2[prop] = v; host.append(el2); r = sig(el2, n, prop, v); } catch (e) { r = "WRITE-THROW:" + e.name + ":" + e.message; }
			assertConsistent("prop|" + tag + "|" + i, r);
			const d = document.createElement("div");
			try { d.innerHTML = "<" + tag + (tag === "script" ? " type=text/x-none " : " ") + n + "=\"" + v.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "\">"; host.append(d); r = sig(d.firstChild, n, prop, v); } catch (e) { r = "WRITE-THROW:" + e.name + ":" + e.message; }
			assertConsistent("inner|" + tag + "|" + i, r);
		}
		host.replaceChildren();
	}
	if (SECTION.startsWith("parsed")) { const P = document.getElementById("parsed");
	for (const el of P.querySelectorAll("[data-i]")) {
		const [tag, n, prop] = ELS[+el.dataset.e];
		assertConsistent("parsed|" + tag + "|" + el.dataset.i, sig(el, n, prop, URLS[+el.dataset.i]));
	} }
	if (SECTION === "misc") { for (let i = 0; i < SRCSETS.length; i++) {
		const el = document.createElement("img");
		let r;
		try { el.setAttribute("srcset", SRCSETS[i]); r = sig(el, "srcset", "srcset", SRCSETS[i]); } catch (e) { r = "WRITE-THROW:" + e.name; }
		assertConsistent("srcset|" + i, r);
	}
	for (let i = 0; i < STYLES.length; i++) {
		const el = document.createElement("div");
		let r;
		try { el.setAttribute("style", STYLES[i]); r = sig(el, "style", null, STYLES[i]) + " ;; css=" + el.style.cssText; } catch (e) { r = "WRITE-THROW:" + e.name; }
		assertConsistent("style|" + i, r);
	}
	for (let i = 0; i < TARGETS.length; i++) {
		for (const tag of ["a", "area", "form", "base"]) {
			const el = document.createElement(tag);
			let r;
			try { el.setAttribute("target", TARGETS[i]); r = sig(el, "target", "target", TARGETS[i]); } catch (e) { r = "WRITE-THROW:" + e.name; }
			assertConsistent("target|" + tag + "|" + i, r);
		}
	}
	// long value
	const long = "/x?" + "a".repeat(200000);
	const la = document.createElement("a");
	la.setAttribute("href", long);
	} if (SECTION === "long") { assertConsistent("long", [la.getAttribute("href") === long, la.href.length, la.matches('[href$="aaa"]'), la.matches('[href^="/x?"]')].join(",")); }
}, true);
`;

function page(section: string) {
	let parsed = "";
	ELS.forEach(([tag, n], e) =>
		URLS.forEach((v, i) => {
			if (section !== "parsed" && section !== "parsed-" + tag) return;
			const val = v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
			parsed += `<${tag} data-e="${e}" data-i="${i}" ${tag === "script" ? 'type="text/x-none"' : ""} ${n}="${val}">${["img", "link"].includes(tag) ? "" : `</${tag}>`}\n`;
		})
	);
	return `<!DOCTYPE html><html><head><meta charset=utf-8></head><body><div id=host></div>${section.startsWith("parsed") ? `<div id=parsed hidden>${parsed}</div>` : ""}<script>window.SECTION=${JSON.stringify(section)}</script><script>${JS}</script></body></html>`;
}

export default [
	...ELS.map(([t]) => "el-" + t),
	"parsed",
	...ELS.map(([t]) => "parsed-" + t),
	"misc",
	"long",
].map((sec) =>
	htmlTest({
		name: "rv13-edge-" + sec,
		html: page(sec),
	})
);
