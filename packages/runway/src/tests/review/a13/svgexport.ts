import { htmlTest } from "../../../testcommon.ts";

// SVG export: serialize a live inline SVG with XMLSerializer and load it as an
// image (the svg-to-png / "download chart" path).

export default [
	htmlTest({
		name: "rv13-svg-export",
		html: `<!doctype html><body>
<svg id=s1 xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20"><defs><linearGradient id=g><stop offset=0 stop-color=red /></linearGradient><rect id=r width=20 height=20 fill="url(#g)"/></defs><use xlink:href="#r"/></svg>
<svg id=s2 xmlns="http://www.w3.org/2000/svg" width="20" height="20"><defs><rect id=r2 width=20 height=20 fill=blue /></defs><use href="#r2"/></svg>
<script>
runTest(async () => {
	for (const id of ["s1", "s2"]) {
		const str = new XMLSerializer().serializeToString(document.getElementById(id));
		const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
		const res = await new Promise((r) => { const i = new Image(); i.onload = () => r("load " + i.naturalWidth); i.onerror = () => r("error"); i.src = url; });
		assertConsistent(id + " as image", res);
		const blob = new Blob([str], { type: "image/svg+xml" });
		const bu = URL.createObjectURL(blob);
		const res2 = await new Promise((r) => { const i = new Image(); i.onload = () => r("load " + i.naturalWidth); i.onerror = () => r("error"); i.src = bu; });
		assertConsistent(id + " as blob image", res2);
		assertConsistent(id + " mentions mirror", /scramjet-attr/.test(str));
	}
}, true);
</script></body>`,
	}),
];
