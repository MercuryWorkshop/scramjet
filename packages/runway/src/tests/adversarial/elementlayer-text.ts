import { basicTest } from "../../testcommon.ts";

/**
 * `JSON.stringify` with every non-ASCII character escaped. The test page is
 * served without a charset, so a native run decodes raw non-ASCII in the
 * script as windows-1252 while scramjet decodes it as UTF-8 - a difference
 * in document encoding, not in anything under test here.
 */
const asciiJSON = (value: unknown) =>
	JSON.stringify(value).replace(
		/[\u0080-\uffff]/g,
		(c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
	);

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// The text layer (#112, client/text.ts): a script's or a style's Text
// children hold the *rewritten* program - the whole of it in the first child,
// every later one emptied - while what the page wrote is kept per node and, for
// a script, in an attribute that survives cloning. Every read has to give back
// the page's text, every write has to be rewritten before the element can
// run it, and a connected script that has not started has to run exactly when
// (and as often as) the native would.
//
// Three kinds of test:
//
//   - differential: run in bare Chromium and through scramjet, and the JSON
//     snapshot of what the page can observe has to match
//   - escapes: PAYLOAD lands in a script through some write path. rewritten,
//     `checkglobal(top)` sees the wrapped top and `pass()` runs; unrewritten,
//     it fails with "top was leaked"
//   - execution counts: differential on how many times a script ran

const PAYLOAD = "checkglobal(top);pass()";

// what most of the read tests write: a program the rewriter changes (and
// makes longer), with non-ASCII and astral text in a comment
const SRC =
	"var __eltext = location.href.length + 1; /* \u00e9 \u2603 \ud83d\ude00 */";
// what the execution tests write
const CNT = "window.__n = (window.__n || 0) + 1;";

// helpers available to every snippet
const HELPERS = `
	const SRC = ${asciiJSON(SRC)};
	const CNT = ${JSON.stringify(CNT)};
	const cleanup = [];
	const conn = (n, parent) => { (parent || document.body).append(n); cleanup.push(n); return n; };
	const mk = (tag, attrs) => {
		const e = document.createElement(tag || "script");
		if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	};
	const svgEl = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);
	const probe = (f) => { try { return f(); } catch (e) { return "!" + (e && e.name); } };
	const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));
	const charData = (n) => ({
		type: n.nodeType,
		data: probe(() => n.data),
		nodeValue: probe(() => n.nodeValue),
		textContent: probe(() => n.textContent),
		length: probe(() => n.length),
		wholeText: probe(() => n.wholeText),
	});
	const kids = (e) => [...e.childNodes].map((n) =>
		n.nodeType === 3 || n.nodeType === 4
			? charData(n)
			: { type: n.nodeType, name: n.nodeName, textContent: probe(() => n.textContent) }
	);
	const reads = (e) => ({
		text: probe(() => e.text),
		textContent: probe(() => e.textContent),
		innerText: probe(() => e.innerText),
		outerText: probe(() => e.outerText),
		innerHTML: probe(() => e.innerHTML),
		getHTML: probe(() => e.getHTML()),
		outerHTML: probe(() => e.outerHTML),
		kids: kids(e),
	});
	const rangeOver = (n) => { const r = document.createRange(); r.selectNodeContents(n); return r; };
	const records = (list) => list.map((r) => ({
		type: r.type,
		target: r.target.nodeName,
		added: [...r.addedNodes].map((n) => n.nodeName + (n.nodeType === 3 ? ":" + n.data : "")),
		removed: [...r.removedNodes].map((n) => n.nodeName),
		oldValue: r.oldValue,
	}));
	const observe = (target, fn) => {
		const mo = new MutationObserver(() => {});
		mo.observe(target, { childList: true, characterData: true, characterDataOldValue: true, subtree: true });
		fn();
		const out = records(mo.takeRecords());
		mo.disconnect();
		return out;
	};
`;

/** Bare Chromium and scramjet have to observe the same thing. `body` returns it. */
const differential = (name: string, body: string) =>
	basicTest({
		name: `eltext-${name}`,
		js: `
			${HELPERS}
			const snapshot = async () => {
				try {
					return { value: await (async () => { ${body} })() };
				} catch (error) {
					return { error: error && error.name };
				} finally {
					for (const n of cleanup) { try { n.remove(); } catch {} }
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

/** PAYLOAD has to arrive rewritten, or not at all. It must call pass(). */
const escapeTest = (name: string, body: string) =>
	basicTest({
		name: `eltext-escape-${name}`,
		js: `
			${HELPERS}
			${body}
		`,
		autoPass: false,
		scramjetOnly: true,
	});

/** A connected script that has been prepared but not started: it is empty. */
const EMPTY_CONNECTED = `const script = mk(); document.body.append(script);`;
/** The same, with an empty Text child a CharacterData write can land in. */
const EMPTY_CONNECTED_TEXT = `const script = mk(); script.append(document.createTextNode("")); document.body.append(script); const t = script.firstChild;`;
/** An insertion, which prepares a connected script that has not started. */
const TRIGGER = `script.appendChild(document.createTextNode(""));`;

export default [
	// --- write paths into a script, read back every way --------------------

	differential(
		"script-text-set",
		`const s = mk(); s.text = SRC; return reads(s);`
	),
	differential(
		"script-textcontent-set",
		`const s = mk(); s.textContent = SRC; return reads(s);`
	),
	differential(
		"script-innertext-set",
		`const s = mk(); s.innerText = SRC; return reads(s);`
	),
	// the native innerText setter turns line breaks into <br> - on a script too?
	differential(
		"script-innertext-set-newlines",
		`const s = mk(); s.innerText = "a = 1;\\nb = location;\\r\\nc = 2;"; return reads(s);`
	),
	differential(
		"script-innerhtml-set",
		`const s = mk(); s.innerHTML = "var x = '<b>&amp;</b>'; location;"; return reads(s);`
	),
	differential(
		"script-sethtmlunsafe",
		`const s = mk(); s.setHTMLUnsafe("var x = '<i>&lt;</i>'; location;"); return reads(s);`
	),
	differential(
		"script-null-writes",
		`
			const out = {};
			const s = mk();
			s.text = SRC; s.textContent = null; out.textContentNull = reads(s);
			s.text = SRC; s.innerHTML = null; out.innerHTMLNull = reads(s);
			s.text = SRC; s.text = null; out.textNull = reads(s);
			s.text = SRC; s.firstChild.data = null; out.dataNull = reads(s);
			s.text = SRC; s.firstChild.nodeValue = null; out.nodeValueNull = reads(s);
			return out;
		`
	),
	differential(
		"script-insertadjacenttext-inside",
		`
			const s = mk(); s.text = "a = 1;";
			s.insertAdjacentText("afterbegin", "location;");
			s.insertAdjacentText("beforeend", "b = 2;");
			return reads(s);
		`
	),
	differential(
		"script-insertadjacenttext-around-child",
		`
			const s = mk(); const span = mk("span");
			s.append("a;", span, "b;");
			span.insertAdjacentText("beforebegin", "location;");
			span.insertAdjacentText("afterend", "c;");
			return reads(s);
		`
	),
	differential(
		"script-insertadjacenthtml-inside",
		`
			const s = mk(); s.text = "a = 1;";
			s.insertAdjacentHTML("afterbegin", "/*<i>*/location;");
			s.insertAdjacentHTML("beforeend", "/*&amp;*/b = 2;");
			return reads(s);
		`
	),
	differential(
		"script-insertadjacenthtml-around-child",
		`
			const s = mk(); const span = mk("span");
			s.append("a;", span, "b;");
			span.insertAdjacentHTML("beforebegin", "/*<b>*/location;");
			span.insertAdjacentHTML("afterend", "c;");
			return reads(s);
		`
	),
	differential(
		"script-append-strings",
		`const s = mk(); s.append("a = location;", "b = 1;"); s.append("c = 2;"); return reads(s);`
	),
	differential(
		"script-prepend-strings",
		`const s = mk(); s.text = "c = 2;"; s.prepend("a = location;", "b = 1;"); return reads(s);`
	),
	differential(
		"script-replacechildren",
		`
			const out = {};
			const s = mk(); s.text = SRC;
			s.replaceChildren("a = location;", "b;"); out.strings = reads(s);
			s.replaceChildren(document.createTextNode("c = top;")); out.node = reads(s);
			s.replaceChildren(); out.empty = reads(s);
			return out;
		`
	),
	differential(
		"script-append-fragment",
		`
			const s = mk(); s.text = "x = 0;";
			const f = document.createDocumentFragment();
			f.append("a = location;", mk("span"), "b = parent;");
			s.append(f);
			return { script: reads(s), fragmentChildren: f.childNodes.length };
		`
	),
	differential(
		"script-appendchild-insertbefore",
		`
			const s = mk();
			const a = s.appendChild(document.createTextNode("a = location;"));
			s.insertBefore(document.createTextNode("b = 1;"), a);
			s.insertBefore(document.createTextNode("c = 2;"), null);
			return reads(s);
		`
	),
	differential(
		"script-replacechild",
		`
			const s = mk(); s.append("a = location;", "b = 1;");
			const old = s.replaceChild(document.createTextNode("c = top;"), s.firstChild);
			return { script: reads(s), old: charData(old) };
		`
	),
	differential(
		"script-removechild",
		`
			const s = mk(); s.append("a = location;", "b = 1;", "c = 2;");
			const gone = s.removeChild(s.childNodes[1]);
			return { script: reads(s), gone: charData(gone) };
		`
	),
	differential(
		"script-text-remove",
		`
			const s = mk(); s.append("a = location;", "b = 1;");
			const t = s.firstChild; t.remove();
			return { script: reads(s), gone: charData(t) };
		`
	),
	differential(
		"script-chardata-before-after-replacewith",
		`
			const s = mk(); s.append("a = location;");
			const t = s.firstChild;
			t.before("b = 1;", document.createTextNode("c = top;"));
			t.after("d = 2;");
			const n = document.createTextNode("e = parent;");
			s.append(n);
			n.replaceWith("f = 3;", "g = location.href;");
			return { script: reads(s), replaced: charData(n) };
		`
	),
	differential(
		"script-element-before-after-replacewith",
		`
			const s = mk(); const a = mk("span"), b = mk("i");
			s.append(a, b);
			a.before("x = location;");
			a.after("y = 1;");
			b.replaceWith("z = top;");
			return reads(s);
		`
	),
	differential(
		"script-child-outerhtml-set",
		`
			const s = mk(); const span = mk("span");
			s.append("a = 1;", span);
			span.outerHTML = "/*<b>*/ location;";
			return reads(s);
		`
	),
	differential(
		"script-child-outertext-set",
		`
			const s = mk(); const span = mk("span");
			s.append("a = 1;", span);
			span.outerText = "location;";
			return reads(s);
		`
	),
	differential(
		"script-chardata-setters",
		`
			const out = {};
			const s = mk(); s.text = "a = 1;";
			const t = s.firstChild;
			t.data = "b = location;"; out.data = reads(s);
			t.nodeValue = "c = top;"; out.nodeValue = reads(s);
			t.textContent = "d = parent;"; out.textContent = reads(s);
			return out;
		`
	),
	differential(
		"script-chardata-mutators",
		`
			const out = {};
			const s = mk(); s.text = "a = 1;";
			const t = s.firstChild;
			t.appendData(" b = location;"); out.appendData = reads(s);
			t.insertData(0, "top; "); out.insertData = reads(s);
			t.deleteData(0, 5); out.deleteData = reads(s);
			t.replaceData(0, 1, "zz"); out.replaceData = reads(s);
			out.substringData = t.substringData(3, 6);
			return out;
		`
	),
	differential(
		"script-multiple-text-nodes",
		`
			const s = mk();
			for (const part of ["a = location;", " ", "b = top;", "", "c = 1;"]) s.appendChild(document.createTextNode(part));
			s.childNodes[2].appendData(" /*x*/");
			return reads(s);
		`
	),
	differential(
		"script-element-child-text",
		`
			const s = mk(); const span = mk("span");
			span.textContent = "inner location";
			s.append("a = 1;", span, "b = 2;");
			return reads(s);
		`
	),
	differential(
		"script-splittext",
		`
			const s = mk(); s.text = "a = location; b = 1;";
			const tail = s.firstChild.splitText(4);
			return { script: reads(s), tail: charData(tail), same: tail === s.childNodes[1] };
		`
	),
	differential(
		"script-normalize-self",
		`
			const s = mk(); s.append("a = location;", "b = top;", "", "c = 1;");
			const second = s.childNodes[1];
			s.normalize();
			return { script: reads(s), second: charData(second), secondConnected: second.parentNode === s };
		`
	),
	differential(
		"script-normalize-ancestor-element-between",
		`
			const d = mk("div"); const s = mk(); d.append(s);
			s.append("a = location;", mk("span"), "b = top;", "c = 1;");
			d.normalize();
			return reads(s);
		`
	),
	differential(
		"script-normalize-document",
		`
			const s = conn(mk("script", { type: "text/x-inert" }));
			s.append("a = location;", "b = top;");
			document.normalize();
			return reads(s);
		`
	),
	differential(
		"script-movebefore",
		`
			if (!("moveBefore" in Element.prototype)) return "no moveBefore";
			const d = conn(mk("div")); d.textContent = "a = location;";
			const s = conn(mk("script", { type: "text/x-inert" }));
			s.text = "b = 1;";
			s.moveBefore(d.firstChild, s.firstChild);
			const r1 = { script: reads(s), div: d.textContent };
			d.moveBefore(s.lastChild, null);
			return { r1, script: reads(s), div: d.textContent, divHTML: d.innerHTML };
		`
	),
	differential(
		"script-text-moved-out",
		`
			const s = mk(); s.append("a = location;", "b = top;");
			const d = mk("div");
			d.appendChild(s.lastChild);
			d.append(s.firstChild);
			return { script: reads(s), divText: d.textContent, divHTML: d.innerHTML, kids: kids(d) };
		`
	),
	// the old children a replace-all drops still carry their own data
	differential(
		"script-old-child-after-textcontent",
		`
			const s = mk(); s.text = SRC;
			const t = s.firstChild;
			s.textContent = "x = 1;";
			const d = mk("div"); d.append(t);
			return { before: charData(t), sub: t.substringData(0, 9), div: d.textContent };
		`
	),
	differential(
		"script-old-child-after-replacechildren",
		`
			const s = mk(); s.append("a = location;", "b = top;");
			const [a, b] = s.childNodes;
			s.replaceChildren();
			return { a: charData(a), b: charData(b), aSub: probe(() => a.substringData(0, 20)) };
		`
	),
	differential(
		"script-old-child-after-innerhtml",
		`
			const s = mk(); s.text = SRC;
			const t = s.firstChild;
			s.innerHTML = "y = 2;";
			const tail = probe(() => t.splitText(3).data);
			return { t: charData(t), tail };
		`
	),
	differential(
		"script-connected-reads",
		`const s = mk(); s.text = SRC; conn(s); return { reads: reads(s), ran: typeof window.__eltext };`
	),
	// a script shown with CSS has a rendered innerText
	differential(
		"script-rendered-innertext",
		`
			const s = mk("script", { type: "text/x-inert" });
			s.style.display = "block";
			s.textContent = "a    b\\n\\n  c   location";
			conn(s);
			return { innerText: s.innerText, outerText: s.outerText, textContent: s.textContent };
		`
	),

	// --- offsets are into the page's text, not the rewritten text ----------

	differential(
		"offsets-substringdata",
		`
			const s = mk(); s.text = "location";
			const t = s.firstChild;
			return [
				[0, 100], [8, 0], [8, 5], [9, 1], [3, 2], [-1, 1], [0, 4294967295], [20, 0],
			].map(([o, c]) => probe(() => t.substringData(o, c))).concat([t.length, s.text]);
		`
	),
	differential(
		"offsets-replacedata",
		`
			const out = [];
			for (const [o, c, d] of [[9, 0, "x"], [8, 0, "x"], [0, 100, "y"], [20, 1, "z"], [2, 3, "top"]]) {
				const s = mk(); s.text = "location";
				out.push([probe(() => s.firstChild.replaceData(o, c, d)), s.text, s.firstChild.length]);
			}
			return out;
		`
	),
	differential(
		"offsets-insertdata",
		`
			const out = [];
			for (const o of [0, 4, 8, 9, 30, -1]) {
				const s = mk(); s.text = "location";
				out.push([probe(() => s.firstChild.insertData(o, "X")), s.text]);
			}
			return out;
		`
	),
	differential(
		"offsets-deletedata",
		`
			const out = [];
			for (const [o, c] of [[3, 100], [8, 1], [9, 1], [0, 0], [25, 0], [1, 4294967295]]) {
				const s = mk(); s.text = "location";
				out.push([probe(() => s.firstChild.deleteData(o, c)), s.text]);
			}
			return out;
		`
	),
	differential(
		"offsets-splittext",
		`
			const out = [];
			for (const o of [0, 3, 8, 9, 20]) {
				const s = mk(); s.text = "location";
				const r = probe(() => s.firstChild.splitText(o));
				out.push([typeof r === "string" ? r : r.data, s.childNodes.length, s.text, s.firstChild.data]);
			}
			return out;
		`
	),
	differential(
		"offsets-second-child",
		`
			const s = mk(); s.append("a;", "location");
			const t = s.childNodes[1];
			return [t.length, probe(() => t.substringData(5, 10)), probe(() => t.substringData(9, 1)), probe(() => t.splitText(9)), s.text];
		`
	),

	// --- scripts whose text is not javascript -------------------------------

	differential(
		"nonjs-json-byte-exact",
		`
			const json = '{ "a" : "location",\\n\\t"b": [1, 2 ,3], "c": "</script>", "d": "\\u00e9\\ud83d\\ude00", "e": "\\\\u0041" }';
			const s = mk("script", { type: "application/json" });
			s.textContent = json;
			const r = reads(s);
			s.append(" ");
			return { r, exact: s.text === json + " ", parsed: JSON.parse(s.text) };
		`
	),
	differential(
		"nonjs-text-plain",
		`
			const s = mk("script", { type: "text/plain" });
			s.text = SRC; s.firstChild.appendData(" top;");
			return reads(s);
		`
	),
	differential(
		"nonjs-template-markup",
		`
			const s = mk("script", { type: "text/x-template" });
			s.innerHTML = '<div class="a" onclick="location = 1">{{ top }}</div>';
			return reads(s);
		`
	),
	differential(
		"nonjs-importmap",
		`
			const map = '{\\n  "imports": { "x": "https://example.test/x.js", "./y": "/y.js" }\\n}';
			const s = mk("script", { type: "importmap" });
			s.textContent = map;
			return { reads: reads(s), exact: s.text === map };
		`
	),
	differential(
		"nonjs-module",
		`
			const s = mk("script", { type: "module" });
			s.text = "import.meta; export const a = location.href;";
			return reads(s);
		`
	),
	differential(
		"nonjs-type-variants",
		`
			const out = {};
			for (const attrs of [
				{ type: "text/javascript" }, { type: " TEXT/JavaScript " }, { language: "javascript" },
				{ language: "vbscript" }, { type: "" }, { nomodule: "" }, { type: "text/babel" },
			]) {
				const s = mk("script", attrs); s.text = SRC; s.append("top;");
				out[JSON.stringify(attrs)] = { text: s.text, textContent: s.textContent, kids: kids(s) };
			}
			return out;
		`
	),
	differential(
		"nonjs-type-changed-after-text",
		`
			const a = mk(); a.text = SRC; a.type = "application/json"; a.append(" 1");
			const b = mk("script", { type: "application/json" }); b.text = SRC; b.removeAttribute("type"); b.append(" top;");
			const c = mk("script", { type: "text/plain" }); c.text = SRC; c.setAttribute("type", "module"); c.firstChild.appendData("//");
			return { a: reads(a), b: reads(b), c: reads(c) };
		`
	),

	// --- styles --------------------------------------------------------------

	differential(
		"style-css-round-trip",
		`
			const css = '@import url("https://example.test/a.css");\\n/* comment \\u00e9 \\u2603 */\\n.a { background: url(https://example.test/b.png) }\\r\\n.b::after { content: "\\ud83d\\ude00 url(x)"; }';
			const s = mk("style");
			s.textContent = css;
			const r = reads(s);
			conn(s);
			return { r, exact: s.textContent === css, connected: reads(s), rules: s.sheet && s.sheet.cssRules.length };
		`
	),
	differential(
		"style-write-paths",
		`
			const css = ".x { background-image: url(/c.png); }";
			const out = {};
			const s = mk("style");
			s.innerText = css; out.innerText = reads(s);
			s.innerHTML = css + " /*<b>*/"; out.innerHTML = reads(s);
			s.append(".y { background: url('d.png') }"); out.append = reads(s);
			s.lastChild.data = ".z { color: red }"; out.data = reads(s);
			s.firstChild.replaceData(0, 2, ".w"); out.replaceData = reads(s);
			s.setHTMLUnsafe(css); out.setHTMLUnsafe = reads(s);
			s.insertAdjacentText("afterbegin", "@import 'e.css';"); out.insertAdjacentText = reads(s);
			return out;
		`
	),
	differential(
		"style-multiple-children-and-offsets",
		`
			const s = mk("style");
			s.append("a { background: url(https://example.test/long/path.png) }", "b {}");
			const t = s.firstChild;
			return { reads: reads(s), len: t.length, sub: probe(() => t.substringData(50, 100)), oob: probe(() => t.substringData(t.data.length + 1, 1)) };
		`
	),
	differential(
		"style-sethtml",
		`
			if (!("setHTML" in Element.prototype)) return "no setHTML";
			const s = mk("style");
			s.setHTML(".a { background: url(/f.png) }");
			const sc = mk();
			sc.setHTML("location");
			return { style: reads(s), script: reads(sc) };
		`
	),

	// --- SVG script and style, CDATA -----------------------------------------

	differential(
		"svg-script-text",
		`
			const s = svgEl("script");
			s.textContent = "var a = location; if (1 < 2 && 3 > 2) {}";
			s.append(" top;");
			return reads(s);
		`
	),
	differential(
		"svg-style-text",
		`
			const s = svgEl("style");
			s.textContent = ".a { fill: url(#g) } .b { background: url(/x.png) } /* < & */";
			return reads(s);
		`
	),
	differential(
		"svg-script-cdata-xml",
		`
			const xdoc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', "image/svg+xml");
			const s = xdoc.querySelector("script");
			const c = s.appendChild(xdoc.createCDATASection("var a = location; a < 1;"));
			const r = { text: s.textContent, data: c.data, length: c.length, xml: new XMLSerializer().serializeToString(s) };
			const imported = document.importNode(s, true);
			return { r, imported: { textContent: imported.textContent, first: charData(imported.firstChild) } };
		`
	),
	differential(
		"cdata-in-html-document",
		`return probe(() => document.createCDATASection("x"));`
	),

	// --- unicode, recorded through base64 ------------------------------------

	differential(
		"unicode-astral-round-trip",
		`
			const src = "var s = '\\u00fc \\u20ac \\ud835\\udcb3 \\ud83d\\ude00 \\u200b'; location;";
			const s = mk(); s.text = src;
			const c = s.cloneNode(true);
			return { text: s.text === src, clone: c.text === src, cloneLen: c.firstChild.length, outer: c.outerHTML.includes("\\ud83d\\ude00") };
		`
	),
	differential(
		"unicode-lone-surrogate",
		`
			const src = "var s = '\\ud800' + '\\udfff'; location;";
			const s = mk(); s.text = src;
			const c = s.cloneNode(true);
			return {
				text: s.text === src,
				clone: c.text === src,
				cloneCodes: [...c.text].map((ch) => ch.codePointAt(0)).filter((n) => n > 127),
				cloneLength: c.firstChild.length,
			};
		`
	),
	differential(
		"unicode-nul-crlf",
		`
			const src = "a = 1;\\u0000\\r\\nb = location;\\rc = 2;\\n";
			const s = mk(); s.text = src;
			const c = s.cloneNode(true);
			return { text: JSON.stringify(s.text), clone: JSON.stringify(c.text), len: s.firstChild.length, cloneLen: c.firstChild.length };
		`
	),

	// --- clones and imports ----------------------------------------------------

	differential(
		"clone-single-child",
		`const s = mk(); s.text = SRC; return reads(s.cloneNode(true));`
	),
	differential(
		"clone-multiple-children",
		`const s = mk(); s.append("a = location;", "b = top;"); return reads(s.cloneNode(true));`
	),
	differential(
		"clone-after-chardata-edit",
		`
			const s = mk(); s.text = "a = location;";
			s.firstChild.insertData(0, "top; ");
			return reads(s.cloneNode(true));
		`
	),
	differential(
		"clone-shallow",
		`const s = mk(); s.text = SRC; const c = s.cloneNode(false); const out = reads(c); c.text = "b = 1;"; return [out, reads(c)];`
	),
	differential(
		"clone-container",
		`
			const d = mk("div"); const s = mk(); const st = mk("style");
			s.append("a = location;", "b = top;"); st.textContent = ".a { background: url(/x.png) }";
			d.append("x", s, st, "y");
			const c = d.cloneNode(true);
			return { textContent: c.textContent, innerHTML: c.innerHTML, script: reads(c.children[0]), style: reads(c.children[1]) };
		`
	),
	differential(
		"clone-style",
		`const s = mk("style"); s.append(".a { background: url(/x.png) }", ".b {}"); return reads(s.cloneNode(true));`
	),
	differential(
		"import-node",
		`
			const doc = document.implementation.createHTMLDocument("");
			const s = mk(); s.append("a = location;", "b = 1;");
			const i = doc.importNode(s, true);
			const a = doc.adoptNode(s.cloneNode(true));
			return { imported: reads(i), adopted: reads(a) };
		`
	),
	differential(
		"clone-text-child-alone",
		`const s = mk(); s.text = SRC; return charData(s.firstChild.cloneNode());`
	),

	// --- ancestors, fragments, traversal, serialization ---------------------

	differential(
		"ancestor-textcontent-innerhtml",
		`
			const d = mk("div"); const s = mk(); const st = mk("style"); const p = mk("p");
			s.text = SRC; st.textContent = ".a { background: url(/x.png) }"; p.append("para", mk("script"));
			p.lastChild.append("q = top;");
			d.append("x", s, p, st, "y");
			return { textContent: d.textContent, innerHTML: d.innerHTML, getHTML: d.getHTML(), outerHTML: d.outerHTML };
		`
	),
	differential(
		"ancestor-innertext-connected",
		`
			const d = conn(mk("div")); const s = mk("script", { type: "text/x-inert" });
			s.text = SRC; d.append("before ", s, " after");
			return { innerText: d.innerText, outerText: d.outerText, textContent: d.textContent };
		`
	),
	differential(
		"fragment-textcontent",
		`
			const f = document.createDocumentFragment(); const s = mk();
			s.append("a = location;", "b = 1;");
			f.append("x", s, "y");
			return { textContent: f.textContent, script: reads(f.childNodes[1]) };
		`
	),
	differential(
		"body-textcontent-includes-source",
		`
			const s = conn(mk("script", { type: "text/x-inert" }));
			s.append("/*MARK*/a = location;", "b = top;/*END*/");
			const all = document.body.textContent;
			const doc = document.documentElement.textContent;
			return [all.slice(all.indexOf("/*MARK*/"), all.indexOf("/*END*/") + 7), doc.includes("/*MARK*/a = location;b = top;/*END*/")];
		`
	),
	differential(
		"body-textcontent-ran-script",
		`
			const s = mk(); s.text = "/*MARK*/var __q = location.href;/*END*/"; conn(s);
			const all = document.body.textContent;
			return all.slice(all.indexOf("/*MARK*/"), all.indexOf("/*END*/") + 7);
		`
	),
	differential(
		"treewalker-text",
		`
			const d = mk("div"); const s = mk(); s.append("a = location;", "b = top;");
			d.append("x", s, "y");
			const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
			const out = [];
			while (w.nextNode()) out.push([w.currentNode.data, w.currentNode.nodeValue, w.currentNode.textContent]);
			return out;
		`
	),
	differential(
		"nodeiterator-text",
		`
			const d = mk("div"); const s = mk(); const st = mk("style");
			s.text = SRC; st.textContent = "a { background: url(/z.png) }";
			d.append(s, st);
			const it = document.createNodeIterator(d, NodeFilter.SHOW_TEXT);
			const out = [];
			for (let n; (n = it.nextNode()); ) out.push([n.data, n.length, n.wholeText]);
			return out;
		`
	),
	differential(
		"xmlserializer",
		`
			const s = mk(); s.append("a = location < 1;", "b = top;");
			const d = mk("div"); d.append(s);
			const x = new XMLSerializer();
			return { script: x.serializeToString(s), div: x.serializeToString(d), text: x.serializeToString(s.firstChild) };
		`
	),
	differential(
		"parsed-script-innerhtml",
		`
			const d = mk("div");
			d.innerHTML = "<script>var a = location; /* \\u00e9 */<\\/script><style>.a{background:url(/q.png)}</style>";
			const [s, st] = d.children;
			const before = { script: reads(s), style: reads(st) };
			s.append("b = top;"); s.firstChild.appendData("//x");
			return { before, after: reads(s), divText: d.textContent };
		`
	),
	differential(
		"parsed-script-template",
		`
			const t = mk("template");
			t.innerHTML = "<script>var a = location;<\\/script><div><script>b = top;<\\/script></div>";
			const s = t.content.firstChild;
			return { script: reads(s), content: t.content.textContent, html: t.innerHTML, clone: reads(s.cloneNode(true)) };
		`
	),
	differential(
		"parsed-script-domparser",
		`
			const doc = new DOMParser().parseFromString("<script>var a = location;<\\/script><p>x</p>", "text/html");
			const s = doc.querySelector("script");
			return { script: reads(s), body: doc.body.textContent, head: doc.head.textContent };
		`
	),

	// --- ranges ----------------------------------------------------------------

	differential(
		"range-tostring",
		`
			const d = mk("div"); const s = mk(); s.append("a = location;", "b = top;");
			d.append("x", s, "y");
			const r = document.createRange(); r.setStart(s.firstChild, 2); r.setEnd(s.lastChild, 3);
			return { script: rangeOver(s).toString(), div: rangeOver(d).toString(), partial: r.toString() };
		`
	),
	differential(
		"range-insertnode-split",
		`
			const s = mk(); s.text = "a = location; b = 1;";
			const r = document.createRange(); r.setStart(s.firstChild, 4); r.collapse(true);
			r.insertNode(document.createTextNode("top, "));
			return { script: reads(s), range: [r.startOffset, r.endOffset, r.collapsed, r.startContainer === s.firstChild, r.endContainer === s] };
		`
	),
	differential(
		"range-insertnode-element-start",
		`
			const s = mk(); s.append("a = 1;", "b = location;");
			const r = document.createRange(); r.setStart(s, 1); r.collapse(true);
			const f = document.createDocumentFragment(); f.append("c = top;", "d;");
			r.insertNode(f);
			return { script: reads(s), range: [r.startOffset, r.endOffset] };
		`
	),
	differential(
		"range-insertnode-errors",
		`
			const s = mk(); s.text = "location";
			const r = document.createRange(); r.setStart(s.firstChild, 2);
			return [probe(() => r.insertNode(s.firstChild)), probe(() => r.insertNode(s)), probe(() => r.insertNode(document)), s.text, s.childNodes.length];
		`
	),
	differential(
		"range-surroundcontents-detached",
		`
			const d = mk("div"); d.textContent = "xx a = location; yy";
			const r = document.createRange(); r.setStart(d.firstChild, 3); r.setEnd(d.firstChild, 16);
			const s = mk(); s.text = "old;";
			r.surroundContents(s);
			return { script: reads(s), div: d.innerHTML, divText: d.textContent, range: r.toString() };
		`
	),
	differential(
		"range-surroundcontents-into-script-text",
		`
			const s = mk(); s.text = "a = location; b = 1;";
			const r = document.createRange(); r.setStart(s.firstChild, 4); r.setEnd(s.firstChild, 12);
			const res = probe(() => r.surroundContents(mk("span")));
			return { res, script: reads(s) };
		`
	),
	differential(
		"range-deletecontents",
		`
			const s = mk(); s.text = "a = location; b = top;";
			const r = document.createRange(); r.setStart(s.firstChild, 4); r.setEnd(s.firstChild, 14);
			r.deleteContents();
			return reads(s);
		`
	),
	differential(
		"range-extractcontents",
		`
			const s = mk(); s.append("a = location;", " b = top;");
			const r = document.createRange(); r.setStart(s.firstChild, 4); r.setEnd(s.lastChild, 4);
			const f = r.extractContents();
			return { fragment: f.textContent, fragmentKids: [...f.childNodes].map(charData), script: reads(s) };
		`
	),
	differential(
		"range-clonecontents",
		`
			const s = mk(); s.append("a = location;", " b = top;");
			const r = document.createRange(); r.setStart(s.firstChild, 4); r.setEnd(s.lastChild, 4);
			const f = r.cloneContents();
			const whole = rangeOver(s).cloneContents();
			return { fragment: f.textContent, whole: whole.textContent, script: reads(s) };
		`
	),

	// --- execution: when a script runs, and how often ------------------------

	differential(
		"exec-inserted-with-text",
		`const s = mk(); s.text = CNT; conn(s); const a = window.__n; conn(s); return [a, window.__n];`
	),
	differential(
		"exec-connected-empty-then-append",
		`const s = conn(mk()); const a = window.__n; s.append(CNT); const b = window.__n; s.append(CNT); return [a, b, window.__n, s.text];`
	),
	differential(
		"exec-connected-empty-then-text",
		`const s = conn(mk()); s.text = CNT; const a = window.__n; s.text = CNT + CNT; return [a, window.__n];`
	),
	differential(
		"exec-connected-empty-write-paths",
		`
			const out = {};
			const paths = {
				textContent: (s) => { s.textContent = CNT; },
				innerText: (s) => { s.innerText = CNT; },
				innerHTML: (s) => { s.innerHTML = CNT; },
				setHTMLUnsafe: (s) => { s.setHTMLUnsafe(CNT); },
				prepend: (s) => { s.prepend(CNT); },
				replaceChildren: (s) => { s.replaceChildren(CNT); },
				appendChild: (s) => { s.appendChild(document.createTextNode(CNT)); },
				insertBefore: (s) => { s.insertBefore(document.createTextNode(CNT), null); },
				insertAdjacentText: (s) => { s.insertAdjacentText("beforeend", CNT); },
				insertAdjacentHTML: (s) => { s.insertAdjacentHTML("afterbegin", CNT); },
				fragment: (s) => { const f = document.createDocumentFragment(); f.append(CNT, CNT); s.append(f); },
				twoStrings: (s) => { s.append(CNT, CNT); },
				spanBefore: (s) => { const sp = mk("span"); s.append(sp); sp.before(CNT); },
				spanReplaceWith: (s) => { const sp = mk("span"); s.append(sp); sp.replaceWith(CNT); },
				spanOuterHTML: (s) => { const sp = mk("span"); s.append(sp); sp.outerHTML = CNT; },
				rangeInsert: (s) => { rangeOver(s).insertNode(document.createTextNode(CNT)); },
			};
			for (const k in paths) {
				window.__n = 0;
				const s = conn(mk());
				paths[k](s);
				const a = window.__n;
				s.append(CNT);
				out[k] = [a, window.__n, s.text];
			}
			return out;
		`
	),
	differential(
		"exec-chardata-writes-do-not-prepare",
		`
			const out = {};
			const writes = {
				data: (t) => { t.data = CNT; },
				nodeValue: (t) => { t.nodeValue = CNT; },
				textContent: (t) => { t.textContent = CNT; },
				appendData: (t) => { t.appendData(CNT); },
				insertData: (t) => { t.insertData(0, CNT); },
				replaceData: (t) => { t.replaceData(0, 0, CNT); },
			};
			for (const k in writes) {
				window.__n = 0;
				const s = mk(); s.append(""); conn(s);
				writes[k](s.firstChild);
				const a = window.__n;
				s.appendChild(document.createTextNode(""));
				const b = window.__n;
				s.append(CNT);
				out[k] = [a, b, window.__n];
			}
			return out;
		`
	),
	differential(
		"exec-started-script-no-rerun",
		`
			const s = mk(); s.text = CNT; conn(s);
			const steps = [window.__n];
			s.text = CNT; steps.push(window.__n);
			s.textContent = CNT; steps.push(window.__n);
			s.firstChild.appendData(CNT); steps.push(window.__n);
			s.firstChild.splitText(3); steps.push(window.__n);
			s.normalize(); steps.push(window.__n);
			s.remove(); document.body.append(s); steps.push(window.__n);
			return steps;
		`
	),
	differential(
		"exec-whitespace-script-starts",
		`const s = mk(); s.text = "  \\n "; conn(s); s.append(CNT); return [window.__n || 0, s.text];`
	),
	differential(
		"exec-element-child-only",
		`const s = mk(); s.append(mk("span")); conn(s); const a = window.__n || 0; s.append(CNT); return [a, window.__n || 0];`
	),
	differential(
		"exec-removal-does-not-prepare",
		`
			const s = mk(); const sp = mk("span"); s.append(sp, ""); conn(s);
			s.firstChild.remove(); const a = window.__n || 0;
			s.removeChild(s.firstChild); const b = window.__n || 0;
			s.append(CNT);
			return [a, b, window.__n || 0];
		`
	),
	differential(
		"exec-clone-of-started",
		`
			const s = mk(); s.text = CNT; conn(s);
			const c = s.cloneNode(true); conn(c);
			const d = mk(); d.text = CNT; const e = d.cloneNode(true); conn(e);
			return [window.__n, c.text, e.text];
		`
	),
	differential(
		"exec-innerhtml-scripts-do-not-run",
		`
			const d = conn(mk("div"));
			d.innerHTML = "<script>" + CNT + "<\\/script>";
			const a = window.__n || 0;
			const s = d.firstChild; s.remove(); document.body.append(s); cleanup.push(s);
			const b = window.__n || 0;
			const c = s.cloneNode(true); conn(c);
			return [a, b, window.__n || 0, s.text];
		`
	),
	differential(
		"exec-contextual-fragment-runs",
		`
			const f = document.createRange().createContextualFragment("<script>" + CNT + "<\\/script>");
			const s = f.firstChild; const t = s.text;
			conn(f.firstChild);
			return [window.__n || 0, t, s.text];
		`
	),
	differential(
		"exec-template-script",
		`
			const t = conn(mk("template"));
			t.innerHTML = "<script>" + CNT + "<\\/script>";
			const a = window.__n || 0;
			const s = document.importNode(t.content, true).firstChild; conn(s);
			return [a, window.__n || 0, s.text];
		`
	),
	differential(
		"exec-other-document",
		`
			const doc = document.implementation.createHTMLDocument("");
			const s = doc.createElement("script"); s.text = CNT;
			doc.body.append(s);
			const a = window.__n || 0;
			conn(s);
			const s2 = doc.createElement("script"); s2.text = CNT;
			conn(s2);
			return [a, window.__n || 0, s.text, s2.text];
		`
	),
	differential(
		"exec-currentscript",
		`
			const s = mk();
			window.__s = s;
			s.text = "window.__cs = { same: document.currentScript === window.__s, text: document.currentScript.text, textContent: document.currentScript.textContent, innerHTML: document.currentScript.innerHTML, len: document.currentScript.firstChild.length, kids: document.currentScript.childNodes.length }; /* location */";
			conn(s);
			return window.__cs;
		`
	),
	differential(
		"exec-currentscript-two-parts",
		`
			const s = conn(mk()); window.__s = s;
			const f = document.createDocumentFragment();
			f.append("window.__cs = [document.currentScript === window.__s, document.currentScript.text, document.currentScript.childNodes.length];", " /* location */");
			s.append(f);
			return window.__cs;
		`
	),
	differential(
		"exec-errors",
		`
			const got = [];
			window.onerror = (m, src, l, c, e) => { got.push([typeof m, typeof l, typeof c, e && e.name]); return true; };
			const a = mk(); a.text = "throw new TypeError('x'); location;"; conn(a);
			const b = mk(); b.text = "var = ;"; conn(b);
			const c = mk(); c.text = "undefinedFunctionName_eltext();"; conn(c);
			window.onerror = null;
			return got;
		`
	),
	differential(
		"exec-async-defer-inline",
		`
			const out = [];
			for (const attrs of [{ async: "" }, { defer: "" }, { nomodule: "" }, { language: "vbscript" }, { type: "text/plain" }, { type: "module" }]) {
				window.__n = 0;
				const s = mk("script", attrs); s.text = CNT; conn(s);
				const a = window.__n;
				await tick(20);
				out.push([JSON.stringify(attrs), a, window.__n]);
			}
			return out;
		`
	),
	differential(
		"exec-order",
		`
			window.__order = [];
			const a = mk(); a.text = "window.__order.push('a:' + document.currentScript.text.length);";
			const b = mk(); b.text = "window.__order.push('b');";
			const f = document.createDocumentFragment(); f.append(a, b); conn(a.parentNode === f ? f : a);
			cleanup.push(a, b);
			const c = conn(mk()); c.append("window.__order.push('c');");
			return window.__order;
		`
	),
	// a script whose type is not javascript is not started, so changing its
	// type and inserting a child runs what it holds
	differential(
		"exec-type-changed-then-insert",
		`
			const s = mk("script", { type: "text/plain" }); s.text = CNT; conn(s);
			const a = window.__n || 0;
			s.removeAttribute("type");
			const b = window.__n || 0;
			s.appendChild(document.createTextNode(""));
			const c = window.__n || 0;
			s.append(CNT);
			return [a, b, c, window.__n || 0, s.text];
		`
	),
	differential(
		"exec-type-changed-then-connect",
		`
			const s = mk("script", { type: "text/plain" }); s.text = CNT;
			s.type = "text/javascript";
			conn(s);
			return [window.__n || 0, s.text];
		`
	),
	differential(
		"exec-movebefore",
		`
			if (!("moveBefore" in Element.prototype)) return "no moveBefore";
			const s = conn(mk()); const d = conn(mk("div")); d.textContent = CNT;
			s.moveBefore(d.firstChild, null);
			const a = window.__n || 0;
			const s2 = mk(); s2.text = CNT; conn(s2); const d2 = conn(mk("div"));
			d2.moveBefore(s2, null);
			return [a, window.__n || 0];
		`
	),
	differential(
		"exec-surroundcontents",
		`
			const d = conn(mk("div")); d.textContent = CNT;
			const s = mk();
			rangeOver(d).surroundContents(s);
			return [window.__n || 0, s.text, d.childNodes.length];
		`
	),
	differential(
		"exec-shadow-root",
		`
			const host = conn(mk("div")); const root = host.attachShadow({ mode: "open" });
			const s = mk(); root.append(s);
			s.append(CNT);
			return [window.__n || 0, s.text, root.textContent];
		`
	),
	differential(
		"exec-svg-script",
		`
			const svg = conn(svgEl("svg")); const s = svgEl("script");
			svg.append(s);
			s.textContent = CNT;
			const a = window.__n || 0;
			s.append(CNT);
			return [a, window.__n || 0, s.textContent];
		`
	),

	// --- mutation records ------------------------------------------------------

	differential(
		"mutations-textcontent",
		`const s = mk(); s.text = "a = 1;"; return observe(s, () => { s.textContent = "b = location;"; });`
	),
	differential(
		"mutations-append-string",
		`const s = mk(); s.text = "a = 1;"; return observe(s, () => { s.append("b = location;"); });`
	),
	differential(
		"mutations-data",
		`const s = mk(); s.text = "a = location;"; return observe(s, () => { s.firstChild.data = "b = top;"; });`
	),
	differential(
		"mutations-appenddata-second-child",
		`const s = mk(); s.append("a = location;", "b;"); return observe(s, () => { s.lastChild.appendData(" c = top;"); });`
	),
	differential(
		"mutations-connected-empty-append",
		`const s = conn(mk()); return observe(s, () => { s.append("var __m = location.href;"); });`
	),
	differential(
		"mutations-normalize",
		`const s = mk(); s.append("a = location;", "b = top;"); return observe(s, () => { s.normalize(); });`
	),
	differential(
		"mutations-splittext",
		`const s = mk(); s.text = "a = location;"; return observe(s, () => { s.firstChild.splitText(4); });`
	),
	differential(
		"mutations-removechild",
		`const s = mk(); s.append("a = location;", "b = top;"); return observe(s, () => { s.removeChild(s.firstChild); });`
	),
	differential(
		"mutations-style",
		`const s = mk("style"); s.textContent = ".a{}"; return observe(s, () => { s.append(".b { background: url(/x.png) }"); s.firstChild.data = ".c{}"; });`
	),

	// --- escapes: PAYLOAD must never run unrewritten ------------------------

	escapeTest(
		"text-then-connect",
		`const script = mk(); script.text = "${PAYLOAD}"; document.body.append(script);`
	),
	escapeTest(
		"innertext-then-connect",
		`const script = mk(); script.innerText = "${PAYLOAD}"; document.body.append(script);`
	),
	escapeTest(
		"innerhtml-then-connect",
		`const script = mk(); script.innerHTML = "${PAYLOAD}"; document.body.append(script);`
	),
	escapeTest(
		"connected-empty-text",
		`${EMPTY_CONNECTED} script.text = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-textcontent",
		`${EMPTY_CONNECTED} script.textContent = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-innertext",
		`${EMPTY_CONNECTED} script.innerText = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-innerhtml",
		`${EMPTY_CONNECTED} script.innerHTML = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-sethtmlunsafe",
		`${EMPTY_CONNECTED} script.setHTMLUnsafe("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-append-string",
		`${EMPTY_CONNECTED} script.append("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-prepend-string",
		`${EMPTY_CONNECTED} script.prepend("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-replacechildren",
		`${EMPTY_CONNECTED} script.replaceChildren("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-appendchild",
		`${EMPTY_CONNECTED} script.appendChild(document.createTextNode("${PAYLOAD}"));`
	),
	escapeTest(
		"connected-empty-insertbefore",
		`${EMPTY_CONNECTED} script.insertBefore(document.createTextNode("${PAYLOAD}"), null);`
	),
	escapeTest(
		"connected-empty-replacechild",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); script.replaceChild(document.createTextNode("${PAYLOAD}"), span);`
	),
	escapeTest(
		"connected-empty-span-before",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.before("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-span-after",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.after("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-span-replacewith",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.replaceWith("${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-span-outerhtml",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.outerHTML = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-span-outertext",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.outerText = "${PAYLOAD}";`
	),
	escapeTest(
		"connected-empty-span-insertadjacenttext",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.insertAdjacentText("beforebegin", "${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-span-insertadjacenthtml",
		`${EMPTY_CONNECTED} const span = mk("span"); script.append(span); span.insertAdjacentHTML("afterend", "${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-insertadjacenttext",
		`${EMPTY_CONNECTED} script.insertAdjacentText("afterbegin", "${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-insertadjacenthtml",
		`${EMPTY_CONNECTED} script.insertAdjacentHTML("beforeend", "${PAYLOAD}");`
	),
	escapeTest(
		"connected-empty-fragment-split-program",
		`${EMPTY_CONNECTED} const f = document.createDocumentFragment(); f.append("checkglobal(", "top);", mk("b"), "pass()"); script.appendChild(f);`
	),
	escapeTest(
		"connected-empty-move-from-div",
		`${EMPTY_CONNECTED} const d = mk("div"); d.textContent = "${PAYLOAD}"; document.body.append(d); script.appendChild(d.firstChild);`
	),
	escapeTest(
		"chardata-before",
		`${EMPTY_CONNECTED_TEXT} t.before("${PAYLOAD}");`
	),
	escapeTest(
		"chardata-after",
		`${EMPTY_CONNECTED_TEXT} t.after("${PAYLOAD}");`
	),
	escapeTest(
		"chardata-replacewith",
		`${EMPTY_CONNECTED_TEXT} t.replaceWith("${PAYLOAD}");`
	),
	// Blink does not prepare a script on a data write, so the trigger is a
	// later insertion - which natively runs what the data write left
	escapeTest(
		"chardata-data-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.data = "${PAYLOAD}"; ${TRIGGER}`
	),
	escapeTest(
		"chardata-nodevalue-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.nodeValue = "${PAYLOAD}"; ${TRIGGER}`
	),
	escapeTest(
		"chardata-textcontent-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.textContent = "${PAYLOAD}"; ${TRIGGER}`
	),
	escapeTest(
		"chardata-appenddata-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.appendData("${PAYLOAD}"); ${TRIGGER}`
	),
	escapeTest(
		"chardata-insertdata-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.insertData(0, "${PAYLOAD}"); ${TRIGGER}`
	),
	escapeTest(
		"chardata-replacedata-then-insert",
		`${EMPTY_CONNECTED_TEXT} t.replaceData(0, 0, "${PAYLOAD}"); ${TRIGGER}`
	),
	escapeTest(
		"chardata-writes-then-splittext",
		`${EMPTY_CONNECTED_TEXT} t.data = "checkglobal(top);pass()//"; t.splitText(4);`
	),
	escapeTest(
		"range-insertnode-into-text",
		`${EMPTY_CONNECTED_TEXT} const r = document.createRange(); r.setStart(t, 0); r.insertNode(document.createTextNode("${PAYLOAD}"));`
	),
	escapeTest(
		"range-insertnode-fragment",
		`${EMPTY_CONNECTED} const f = document.createDocumentFragment(); f.append("checkglobal(top);", "pass()"); rangeOver(script).insertNode(f);`
	),
	escapeTest(
		"range-surroundcontents-partial",
		`
			const d = mk("div"); d.textContent = "xx${PAYLOAD}yy"; document.body.append(d);
			const r = document.createRange(); r.setStart(d.firstChild, 2); r.setEnd(d.firstChild, 2 + ${PAYLOAD.length});
			r.surroundContents(mk());
		`
	),
	// what a range extracts out of a script is a clone of its text, holding
	// the rewritten program with no record of what the page wrote
	escapeTest(
		"range-extract-from-script-into-empty",
		`
			const src = mk("script", { type: "text/x-inert" });
			src.text = "${PAYLOAD}";
			const f = rangeOver(src).extractContents();
			${EMPTY_CONNECTED} script.append(f);
		`
	),
	escapeTest(
		"range-clone-from-js-script-into-empty",
		`
			const src = mk(); src.text = "${PAYLOAD}";
			const f = rangeOver(src).cloneContents();
			${EMPTY_CONNECTED} script.append(f);
		`
	),
	escapeTest(
		"move-text-between-scripts",
		`
			const src = mk(); src.append("checkglobal(top);", "pass()");
			${EMPTY_CONNECTED} const f = document.createDocumentFragment(); f.append(...src.childNodes); script.append(f);
		`
	),
	escapeTest(
		"movebefore-from-inert-script",
		`
			if (!("moveBefore" in Element.prototype)) { pass("no moveBefore"); } else {
				const src = mk("script", { type: "text/plain" }); src.text = "${PAYLOAD}"; document.body.append(src);
				// an atomic move does not prepare the script; the insertion after it does
				${EMPTY_CONNECTED} script.moveBefore(src.firstChild, null); ${TRIGGER}
			}
		`
	),
	escapeTest(
		"node-textcontent-setter-call",
		`${EMPTY_CONNECTED} Object.getOwnPropertyDescriptor(Node.prototype, "textContent").set.call(script, "${PAYLOAD}");`
	),
	escapeTest(
		"htmlelement-innertext-setter-call",
		`${EMPTY_CONNECTED} Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText").set.call(script, "${PAYLOAD}");`
	),
	escapeTest(
		"other-realm-text-node",
		`
			const f = document.createElement("iframe"); document.body.append(f);
			const t = f.contentDocument.createTextNode("${PAYLOAD}");
			${EMPTY_CONNECTED} script.appendChild(t);
		`
	),
	escapeTest(
		"other-document-text-node",
		`
			const t = document.implementation.createHTMLDocument("").createTextNode("${PAYLOAD}");
			${EMPTY_CONNECTED} script.append(t);
		`
	),
	escapeTest(
		"shadow-root",
		`
			const host = mk("div"); document.body.append(host);
			const script = mk(); host.attachShadow({ mode: "open" }).append(script);
			script.append("${PAYLOAD}");
		`
	),
	escapeTest(
		"svg-script-textcontent",
		`
			const svg = svgEl("svg"); const script = svgEl("script");
			script.textContent = "${PAYLOAD}";
			svg.append(script); document.body.append(svg);
		`
	),
	escapeTest(
		"svg-script-connected-empty-append",
		`
			const svg = svgEl("svg"); const script = svgEl("script");
			svg.append(script); document.body.append(svg);
			script.appendChild(document.createTextNode("${PAYLOAD}"));
		`
	),
	escapeTest(
		"svg-script-cdata",
		`
			const xdoc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml");
			const svg = svgEl("svg"); const script = svgEl("script");
			svg.append(script); document.body.append(svg);
			script.appendChild(xdoc.createCDATASection("${PAYLOAD}"));
		`
	),
	// a script that is not javascript holds its text as written; one that
	// becomes javascript afterwards has to be rewritten before it can run
	escapeTest(
		"type-removed-then-connect",
		`const script = mk("script", { type: "text/plain" }); script.textContent = "${PAYLOAD}"; script.removeAttribute("type"); document.body.append(script);`
	),
	escapeTest(
		"type-property-changed-then-connect",
		`const script = mk("script", { type: "application/json" }); script.text = "${PAYLOAD}"; script.type = "text/javascript"; document.body.append(script);`
	),
	escapeTest(
		"language-removed-then-connect",
		`const script = mk("script", { language: "vbscript" }); script.text = "${PAYLOAD}"; script.removeAttribute("language"); document.body.append(script);`
	),
	escapeTest(
		"type-removed-connected-then-insert",
		`const script = mk("script", { type: "text/plain" }); script.text = "${PAYLOAD}"; document.body.append(script); script.removeAttribute("type"); ${TRIGGER}`
	),
	escapeTest(
		"type-removed-connected-then-splittext",
		`const script = mk("script", { type: "text/plain" }); script.text = "${PAYLOAD}//"; document.body.append(script); script.type = ""; script.firstChild.splitText(3);`
	),
	escapeTest(
		"type-changed-clone-then-connect",
		`const src = mk("script", { type: "text/x-template" }); src.innerHTML = "${PAYLOAD}"; const script = src.cloneNode(true); script.removeAttribute("type"); document.body.append(script);`
	),
	escapeTest(
		"type-changed-module-to-classic",
		`const script = mk("script", { type: "text/plain" }); script.text = "${PAYLOAD}"; script.setAttribute("type", "module"); document.body.append(script);`
	),
	// editing a shown, editable script inserts text the way a user would
	escapeTest(
		"contenteditable-inserttext",
		`
			const script = mk(); script.style.display = "block"; script.contentEditable = "true";
			document.body.append(script);
			script.focus();
			getSelection().collapse(script, 0);
			document.execCommand("insertText", false, "${PAYLOAD}");
			${TRIGGER}
		`
	),
];
