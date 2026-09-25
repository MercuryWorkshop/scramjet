import { htmlTest } from "../../../testcommon.ts";

// Non-string values and object URLs through the attribute write paths.

export default [
	htmlTest({
		name: "rv13-values-objects",
		html: `<!doctype html><body><p id=probe>p</p><script>
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : String(v); } catch (e) { return "THROW:" + e.name; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
runTest(async () => {
	const vals = { nul: null, undef: undefined, num: 12, obj: { toString() { return "/o.png"; } }, url: new URL("/u.png", location.href), loc: location, arr: ["/a", "b"] };
	for (const [k, v] of Object.entries(vals)) {
		const a = document.createElement("a");
		assertConsistent("setAttribute href " + k, T(() => { a.setAttribute("href", v); return a.getAttribute("href") + " | " + a.href; }));
		const b = document.createElement("a");
		assertConsistent("prop href " + k, T(() => { b.href = v; return b.getAttribute("href") + " | " + b.href; }));
		const i = document.createElement("img");
		assertConsistent("prop img.src " + k, T(() => { i.src = v; return i.getAttribute("src") + " | " + i.src; }));
	}
	assertConsistent("symbol", T(() => document.createElement("a").setAttribute("href", Symbol("x"))));
	// object URLs
	const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
	const iu = URL.createObjectURL(new Blob([png], { type: "image/png" }));
	const img = document.createElement("img"); img.src = iu; document.body.append(img);
	await new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 2000); });
	assertConsistent("blob img", [img.naturalWidth, img.getAttribute("src") === iu, img.src === iu, img.currentSrc === iu].join());
	const cu = URL.createObjectURL(new Blob(["#probe { color: rgb(1, 2, 3) }"], { type: "text/css" }));
	const l = document.createElement("link"); l.rel = "stylesheet"; l.href = cu; document.head.append(l);
	await new Promise((r) => { l.onload = l.onerror = r; setTimeout(r, 2000); });
	assertConsistent("blob css", [getComputedStyle(document.getElementById("probe")).color, l.getAttribute("href") === cu, l.href === cu].join());
	const ju = URL.createObjectURL(new Blob(["window.BLOBJS = location.href.length > 0"], { type: "text/javascript" }));
	const s = document.createElement("script"); s.src = ju; document.head.append(s);
	await new Promise((r) => { s.onload = s.onerror = r; setTimeout(r, 2000); });
	assertConsistent("blob script", [String(window.BLOBJS), s.getAttribute("src") === ju, s.src === ju].join());
	const hu = URL.createObjectURL(new Blob(["<p id=x>hi</p><script>parent.BLOBFRAME = location.href.slice(0, 5)<" + "/script>"], { type: "text/html" }));
	const f = document.createElement("iframe"); f.src = hu; document.body.append(f);
	await new Promise((r) => { f.onload = r; setTimeout(r, 3000); });
	assertConsistent("blob iframe", [String(window.BLOBFRAME), f.getAttribute("src") === hu, f.src === hu].join());
	const du = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
	const di = document.createElement("img"); di.setAttribute("src", du); document.body.append(di);
	await new Promise((r) => { di.onload = di.onerror = r; setTimeout(r, 2000); });
	assertConsistent("data img", [di.naturalWidth, di.src === du, di.currentSrc === du].join());
}, true);
</script></body>`,
	}),
];
