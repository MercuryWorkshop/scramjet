import { htmlTest } from "../../../testcommon.ts";

// Attributes the parser mirrored, then changed through a native path the
// attribute layer does not intercept (CSSOM, reflected setters without an
// interceptor). The mirror goes stale and wins every read.

export default [
	htmlTest({
		name: "rv2-stale-style-cssom",
		html: `<!DOCTYPE html><html><body>
		<div id=a style="display:none">a</div>
		<div id=b style="color:red">b</div>
		<script>
		runTest(async () => {
			const a = document.getElementById("a");
			a.style.display = "block";
			assertConsistent("getAttribute", a.getAttribute("style"));
			assertConsistent("selector hidden", document.querySelectorAll('[style*="display:none"], [style*="display: none"]').length);
			assertConsistent("selector block", document.querySelectorAll('[style*="block"]').length);
			assertConsistent("outerHTML", a.outerHTML);
			const b = document.getElementById("b");
			b.style.cssText = "color: blue";
			assertConsistent("cssText", b.getAttribute("style"));
			assertConsistent("attr node", b.getAttributeNode("style").value);
			const p = a.parentNode;
			// the classic "re-render by round-tripping innerHTML"
			p.innerHTML = p.innerHTML;
			assertConsistent("roundtrip display", getComputedStyle(document.getElementById("a")).display);
			const c = a.cloneNode(true);
			assertConsistent("clone", c.getAttribute("style"));
		}, true);
		</script></body></html>`,
	}),
	htmlTest({
		name: "rv2-stale-meta-content",
		html: `<!DOCTYPE html><html><head>
		<meta name="description" content="original">
		<meta name="theme-color" content="#000000">
		<meta property="og:title" content="Old title">
		</head><body>
		<script>
		runTest(async () => {
			const d = document.querySelector('meta[name="description"]');
			d.content = "updated by SPA";
			assertConsistent("prop", d.content);
			assertConsistent("getAttribute", d.getAttribute("content"));
			assertConsistent("selector new", document.querySelectorAll('meta[content="updated by SPA"]').length);
			assertConsistent("selector old", document.querySelectorAll('meta[content="original"]').length);
			assertConsistent("outerHTML", d.outerHTML);
			const t = document.querySelector('meta[name="theme-color"]');
			t.content = "#ffffff";
			assertConsistent("theme", t.getAttribute("content"));
			assertConsistent("head", document.head.innerHTML.replace(/\\s+/g, " ").slice(0, 400));
			const og = document.querySelector('meta[property="og:title"]');
			og.setAttribute("content", "New");
			assertConsistent("og", [og.content, og.getAttribute("content")].join("|"));
		}, true);
		</script></body></html>`,
	}),
];
