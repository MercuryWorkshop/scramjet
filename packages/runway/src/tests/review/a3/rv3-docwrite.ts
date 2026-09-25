import { htmlTest, serverTest } from "../../../testcommon.ts";

const C = `const c = (label, fn) => { let v; try { v = fn(); } catch (e) { v = "THROW " + e.name + ": " + e.message; } assertConsistent(label, v); };`;

export default [
	// document.write during parsing, split across calls, the way ad tags do it
	serverTest({
		name: "rv3-docwrite-parse",
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/ext.js") {
					res.writeHead(200, {
						"content-type": "application/javascript",
					});
					res.end(
						"window.__ext = (window.__ext||0) + 1; document.write('<span id=extw>ew</span>');"
					);
					return;
				}
				res.writeHead(200, {
					"content-type": "text/html",
				});
				res.end(`<!doctype html><html><head><script>${C}</script></head><body>
<script>document.write('<scr' + 'ipt src="/ext.js"></scr' + 'ipt>');</script>
<script>window.__afterExt = window.__ext;</script>
<script>document.write('<div id="d1" class="a'); document.write('b">hello'); document.write('</div>');</script>
<script>document.write('<p id=p1>para');</script><script>document.write(' more</p>');</script>
<script>document.write('<a id="a1" href="/x?a=1&amp;b=2">x</a>');</script>
<script>document.write('<img id="i1" src="/img.png">');</script>
<script>document.write('<table id=t1><tr><td>1'); document.write('</td></tr></table>');</script>
<script>document.write('<script>window.__inl = 1</' + 'script>');</script>
<script>window.__inlAfter = window.__inl;</script>
<script>document.writeln('<b id=b1>x</b>');</script>
<script>document.write('<noscript><img src="/ns.png"></noscript><i id=i2>i</i>');</script>
<script>document.write('<svg id=sv viewBox="0 0 1 1"><path d="M0"/></svg>');</script>
<script>document.write('<!-- c'); document.write('omment --><u id=u1>u</u>');</script>
<script>
runTest(async () => {
  c("ext", () => window.__afterExt);
  c("extw", () => !!document.getElementById("extw"));
  c("d1", () => document.getElementById("d1") && document.getElementById("d1").outerHTML);
  c("p1", () => document.getElementById("p1") && document.getElementById("p1").outerHTML);
  c("a1", () => document.getElementById("a1").getAttribute("href") + " " + document.getElementById("a1").search);
  c("i1", () => document.getElementById("i1").getAttribute("src"));
  c("t1", () => document.getElementById("t1") && document.getElementById("t1").outerHTML);
  c("inl", () => window.__inlAfter);
  c("b1", () => document.getElementById("b1") && document.getElementById("b1").nextSibling && JSON.stringify(document.getElementById("b1").nextSibling.data));
  c("i2", () => !!document.getElementById("i2"));
  c("sv", () => document.getElementById("sv") && document.getElementById("sv").outerHTML);
  c("u1", () => !!document.getElementById("u1") && document.getElementById("u1").previousSibling.nodeType);
}, true);
</script></body></html>`);
			});
		},
	}),
	// iframe open/write/close - editors (TinyMCE, CKEditor 4), ad iframes, about:blank documents
	htmlTest({
		name: "rv3-docwrite-iframe",
		html: `<!doctype html><body><script>${C}
runTest(async () => {
  const f = document.createElement("iframe");
  document.body.append(f);
  const d = f.contentDocument;
  d.open();
  d.write('<!DOCTYPE html><html><head><title>x</title><base href="https://example.org/dir/"></head><body><a id=a href="p">p</a><div id=q>');
  d.write('q</div><script>window.__w = 7; parent.__fromChild = document.getElementById("q").textContent;<\\/script>');
  d.write('</body></html>');
  d.close();
  c("title", () => d.title);
  c("compat", () => d.compatMode);
  c("q", () => d.getElementById("q") && d.getElementById("q").outerHTML);
  c("script", () => f.contentWindow.__w);
  c("fromChild", () => window.__fromChild);
  c("a", () => d.getElementById("a") && d.getElementById("a").href);
  c("bodyHTML", () => d.body && d.body.innerHTML.replace(/<script[\\s\\S]*?<\\/script>/, "S"));
  // second round: reopen
  d.open(); d.write("<p id=r>again</p>"); d.close();
  c("reopen", () => d.body && d.body.innerHTML);
  c("docopen-noargs-window", () => typeof d.open);
}, true);
</script></body>`,
	}),
	htmlTest({
		name: "rv3-docwrite-createdoc",
		html: `<!doctype html><body><script>${C}
runTest(async () => {
  const doc = document.implementation.createHTMLDocument("");
  doc.open();
  doc.write("<html><body><div id=x>1</div>");
  c("before-close", () => doc.body ? doc.body.innerHTML : null);
  doc.close();
  c("after-close", () => doc.body ? doc.body.innerHTML : null);
  const doc2 = document.implementation.createHTMLDocument("");
  doc2.write('<base href="https://example.org/">');
  doc2.close();
  c("base", () => doc2.querySelector("base") ? doc2.querySelector("base").getAttribute("href") : null);
}, true);
</script></body>`,
	}),
];
