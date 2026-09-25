import { htmlTest } from "../../../testcommon.ts";

// CSS attr() reads the live attribute, so generated content shows the
// rewritten value (the print-stylesheet `a[href]:after { content: attr(href) }`
// idiom from HTML5 Boilerplate / Bootstrap 3).

export default [
	htmlTest({
		name: "rv13-css-attr-function",
		html: `<!doctype html><head><style>
.show::after { content: " (" attr(href) ")"; }
.t::after { content: attr(target); }
.st::after { content: attr(style); }
.oc::after { content: attr(onclick); }
.im::before { content: attr(src); }
</style></head><body>
<a id=a1 class=show href="/p/x">parsed</a>
<a id=a2 class=t href="/p" target="_top">t</a>
<div id=d1 class=st style="background: url(/b.png)"></div>
<div id=d2 class=oc onclick="go()"></div>
<span id=s1 class=im src="/not-an-img.png"></span>
<script>
runTest(async () => {
	const a3 = document.createElement("a"); a3.className = "show"; a3.href = "/p/y"; document.body.append(a3);
	const c = (el, pseudo) => getComputedStyle(el, pseudo).content;
	assertConsistent("parsed href", c(document.getElementById("a1"), "::after"));
	assertConsistent("script href", c(a3, "::after"));
	assertConsistent("target", c(document.getElementById("a2"), "::after"));
	assertConsistent("style", c(document.getElementById("d1"), "::after"));
	assertConsistent("onclick", c(document.getElementById("d2"), "::after"));
	assertConsistent("span src (no rule)", c(document.getElementById("s1"), "::before"));
}, true);
</script></body>`,
	}),
];
