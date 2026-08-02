import { serverTest, basicTest } from "../../testcommon.ts";

// Same-origin frames are the trickiest shape for a proxy: each frame gets its
// own client, and the page can reach across into another frame's document and
// read URLs there. Nothing here currently diverges - this is regression cover
// for an area with no existing tests.

const frameTest = (name: string, js: string) =>
	serverTest({
		name,
		autoPass: true,
		js,
		start: async (server) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				if (path === "/frame.html") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						'<!DOCTYPE html><html><body><a id="l" href="/inframe">x</a>' +
							'<img id="i" src="/inframe.png"></body></html>'
					);
					return;
				}
				if (path === "/nested.html") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						'<!DOCTYPE html><html><body><iframe src="/frame.html"></iframe></body></html>'
					);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("nf");
			});
		},
	});

const LOAD = `const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 4000); });`;

export default [
	frameTest(
		"frames-contentdocument-urls",
		`
			${LOAD}
			const f = document.createElement("iframe");
			f.src = "/frame.html";
			document.body.appendChild(f);
			await load(f);
			const doc = f.contentDocument;
			assert(doc, "contentDocument is reachable");
			assertEqual(doc.querySelector("#l").getAttribute("href"), "/inframe", "attribute inside the frame");
			assertEqual(doc.querySelector("#l").href, location.origin + "/inframe", "resolved href inside the frame");
			assertEqual(doc.querySelector("#i").src, location.origin + "/inframe.png", "img src inside the frame");
			assertEqual(f.contentWindow.location.href, location.origin + "/frame.html", "contentWindow.location.href");
			assertEqual(doc.baseURI, location.origin + "/frame.html", "frame baseURI");
			assertEqual(doc.URL, location.origin + "/frame.html", "frame document.URL");
			assertEqual(f.getAttribute("src"), "/frame.html", "the src attribute keeps the literal value");
		`
	),
	frameTest(
		"frames-collection-and-relationships",
		`
			${LOAD}
			const f = document.createElement("iframe");
			f.name = "myframe";
			f.src = "/frame.html";
			document.body.appendChild(f);
			await load(f);
			assertEqual(window.frames.length, 1, "frames.length");
			assertEqual(window.frames[0], f.contentWindow, "frames[0]");
			assertEqual(window.frames["myframe"], f.contentWindow, "frames by name");
			assertEqual(f.contentWindow.frameElement, f, "frameElement");
			assertEqual(f.contentWindow.parent, window, "parent seen from the frame");
			assertEqual(f.contentWindow.top, window.top, "top agrees");
			assertEqual(f.contentWindow.self, f.contentWindow, "self inside the frame");
			assertEqual(document.querySelectorAll("iframe").length, 1, "one iframe in the document");
		`
	),
	frameTest(
		"frames-nested",
		`
			${LOAD}
			const outer = document.createElement("iframe");
			outer.src = "/nested.html";
			document.body.appendChild(outer);
			await load(outer);
			await new Promise((r) => setTimeout(r, 300));
			const inner = outer.contentDocument.querySelector("iframe");
			assert(inner, "the nested iframe exists");
			assertEqual(inner.contentWindow.parent, outer.contentWindow, "the nested frame's parent");
			assertEqual(inner.contentWindow.top, window.top, "top from two levels down");
			assertEqual(
				inner.contentDocument.querySelector("#l").href,
				location.origin + "/inframe",
				"URL resolution two levels down"
			);
		`
	),
	frameTest(
		"frames-cross-document-scripting",
		`
			${LOAD}
			const f = document.createElement("iframe");
			f.src = "/frame.html";
			document.body.appendChild(f);
			await load(f);
			// reach in and mutate the child document from the parent
			const child = f.contentDocument;
			const img = child.createElement("img");
			img.src = "/created-in-parent.png";
			child.body.appendChild(img);
			assertEqual(img.src, location.origin + "/created-in-parent.png", "an element created in the child realm");
			assertEqual(img.getAttribute("src"), "/created-in-parent.png", "its attribute");
			child.body.innerHTML += '<a id="added" href="/added">y</a>';
			assertEqual(child.querySelector("#added").href, location.origin + "/added", "markup written into the child");
			assertEqual(f.contentWindow.document, child, "contentWindow.document === contentDocument");
		`
	),
	basicTest({
		name: "frames-srcdoc",
		js: `
			const f = document.createElement("iframe");
			f.srcdoc = '<!DOCTYPE html><html><body><a id="l" href="/sd">x</a></body></html>';
			document.body.appendChild(f);
			await new Promise((r) => { f.onload = r; setTimeout(r, 4000); });
			const doc = f.contentDocument;
			assert(doc, "srcdoc contentDocument");
			assertEqual(doc.querySelector("#l").getAttribute("href"), "/sd", "attribute inside srcdoc");
			assertEqual(doc.querySelector("#l").href, location.origin + "/sd", "resolved href inside srcdoc");
			assert(f.getAttribute("srcdoc").includes("/sd"), "srcdoc attribute round trip");
			assert(!f.getAttribute("srcdoc").includes("/~/sj/"), "srcdoc must not expose the proxy URL");
		`,
	}),
	basicTest({
		name: "frames-document-write",
		js: `
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			const doc = f.contentDocument;
			doc.open();
			doc.write('<a id="l" href="/ab">x</a><img id="i" src="/ab.png">');
			doc.close();
			assertEqual(doc.querySelector("#l").getAttribute("href"), "/ab", "written attribute");
			assertEqual(doc.querySelector("#l").href, location.origin + "/ab", "resolved href in the written frame");
			assertEqual(doc.querySelector("#i").src, location.origin + "/ab.png", "written img src");
			assert(!doc.baseURI.includes("/~/sj/"), "baseURI must not expose the proxy URL: " + doc.baseURI);
			assertEqual(doc.body.innerHTML, '<a id="l" href="/ab">x</a><img id="i" src="/ab.png">',
				"serialization round trip in the written frame");
		`,
	}),
	basicTest({
		name: "frames-sandbox-attribute",
		js: `
			const f = document.createElement("iframe");
			f.sandbox = "allow-scripts allow-same-origin";
			f.src = "/frame.html";
			document.body.appendChild(f);
			assertEqual(f.getAttribute("sandbox"), "allow-scripts allow-same-origin", "sandbox attribute round trip");
			assertEqual([...f.sandbox].sort().join(","), "allow-same-origin,allow-scripts", "sandbox token list");
			f.sandbox.add("allow-forms");
			assert(f.sandbox.contains("allow-forms"), "token list is mutable");
		`,
	}),
];
