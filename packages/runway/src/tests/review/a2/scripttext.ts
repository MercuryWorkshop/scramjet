import { htmlTest } from "../../../testcommon.ts";

export default [
	htmlTest({
		name: "rv2-scripttext-parsed",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<script id=s1>window.__a = "héllo 日本 😀 ${"\\u2028"}";</script>
<script id=s2 type="module">window.__m = import.meta.url; /* <!-- x --> */</script>
<script id=s3 type="text/x-template"><div :src="a">{{ location }}</div></script>
<script id=s4 type="application/json">{"u":"https://e.test/","s":"</scr" + "ipt>"}</script>
<script id=s5><!--
window.__c = 1;
//--></script>
<style id=st>@font-face{font-family:x;src:url(/f.woff2) format("woff2")} .a{background:url('/bg.png')} .b::after{content:"\\201C"}</style>
<script id=s6>
// comment with </b> and <!-- inside
window.__d = "<\\/script>";
</script>
</head><body>
<script>
runTest(async () => {
	for (const id of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
		const s = document.getElementById(id);
		assertConsistent(id + " text", s.text);
		assertConsistent(id + " tc", s.textContent);
		assertConsistent(id + " ih", s.innerHTML);
		assertConsistent(id + " oh", s.outerHTML);
		assertConsistent(id + " kids", s.childNodes.length + ":" + (s.firstChild && s.firstChild.nodeType));
		assertConsistent(id + " data", s.firstChild && s.firstChild.data);
		assertConsistent(id + " len", s.firstChild && s.firstChild.length);
	}
	const st = document.getElementById("st");
	assertConsistent("style tc", st.textContent);
	assertConsistent("style ih", st.innerHTML);
	assertConsistent("head", document.head.innerHTML);
	assertConsistent("a", window.__a);
	assertConsistent("c", window.__c);
	assertConsistent("d", window.__d);
}, true);
</script></body></html>`,
	}),
];
