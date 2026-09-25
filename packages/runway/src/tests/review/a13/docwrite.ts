import { htmlTest } from "../../../testcommon.ts";

// document.write as an attribute write path: whole tags, tags split across
// calls, writes into a fresh about:blank frame, and writeln.

const T = String.raw`const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return "THROW:" + e.name + ":" + e.message; } };`;
const sig = String.raw`const sig = (el) => el ? [el.getAttributeNames().join(), el.getAttribute("src") ?? el.getAttribute("href"), (() => { const u = el.src || el.href; try { return new URL(u).pathname; } catch { return u; } })(), el.outerHTML].join(" | ") : "missing";`;

export default [
	htmlTest({
		name: "rv13-docwrite",
		html: `<!doctype html><body><script>${T}${sig}
document.write('<img id=w1 src="/w1.png">');
document.write('<img id=w2 src="/w2');
document.write('.png">');
document.write('<a id=w3 hr');
document.write('ef="/w3" style="color: red">x</a>');
document.writeln('<a id=w4 href="/w4"', ' target="_top">y</a>');
</script><script>
runTest(async () => {
	for (const id of ["w1", "w2", "w3", "w4"]) assertConsistent(id, T(() => sig(document.getElementById(id))));
	const f = document.createElement("iframe"); document.body.append(f);
	const d = f.contentDocument;
	d.open(); d.write('<!doctype html><body><a id=f1 href="rel/x">x</a><img id=f2 src="/f2'); d.write('.png"><base href="/b/"><a id=f3 href="y">y</a>'); d.close();
	for (const id of ["f1", "f2", "f3"]) assertConsistent("frame " + id, T(() => sig(d.getElementById(id))));
}, true);
</script></body>`,
	}),
];
