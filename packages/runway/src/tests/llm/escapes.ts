import http from "http";
import { basicTest, serverTest, playwrightTest } from "../../testcommon.ts";

const PAYLOAD = "checkglobal(top);pass()";
const IFRAME_PAYLOAD = "parent.checkglobal(top);parent.pass()";
const SAFE_COMPLETION = 'setTimeout(() => pass("no escape"), 100);';

function escapeTest(props: { name: string; js: string }) {
	return basicTest({
		name: props.name,
		js: props.js,
		autoPass: false,
		scramjetOnly: true,
	});
}

function scriptTextEscape(name: string, body: string) {
	return escapeTest({
		name,
		js: `
			const script = document.createElement("script");
			${body}
			document.body.append(script);
		`,
	});
}

function createHtmlServer(
	html: string
): Promise<{ server: http.Server; port: number }> {
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			if (req.url === "/") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(html);
				return;
			}
			res.writeHead(404);
			res.end("Not found");
		});
		server.listen(0, () => {
			resolve({ server, port: (server.address() as any).port });
		});
	});
}

export default [
	escapeTest({
		name: "escapes-document-parsehtmlunsafe-static-img-onerror",
		js: `
			const doc = Document.parseHTMLUnsafe(
				'<img src="x:" onerror="checkglobal(top)">'
			);
			document.body.append(doc.querySelector("img"));
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-top-function",
		js: `
			new top.Function("${PAYLOAD}")();
		`,
	}),
	escapeTest({
		name: "escapes-parent-function",
		js: `
			new parent.Function("${PAYLOAD}")();
		`,
	}),
	escapeTest({
		name: "escapes-reflect-set-location-javascript",
		js: `
			Reflect.set(window, "location", "javascript:${PAYLOAD}");
		`,
	}),
	escapeTest({
		name: "escapes-reflect-set-document-location-javascript",
		js: `
			Reflect.set(document, "location", "javascript:${PAYLOAD}");
		`,
	}),
	playwrightTest({
		name: "escapes-postmessage-source-eval",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createHtmlServer(`
				<!doctype html>
				<pre id="result">ready</pre>
				<script>
					const resultEl = document.getElementById("result");
					addEventListener("message", (event) => {
						try {
							const realEval = Reflect.get(event.source, "eval");
							if (typeof realEval !== "function") {
								resultEl.textContent = JSON.stringify({ status: "no-eval" });
								return;
							}
							try {
								realEval("checkglobal(top)");
								resultEl.textContent = JSON.stringify({ status: "safe" });
							} catch (error) {
								resultEl.textContent = JSON.stringify({
									status: "leak",
									message: String(error && error.message || error),
								});
							}
						} catch (error) {
							resultEl.textContent = JSON.stringify({
								status: "error",
								message: String(error && error.message || error),
							});
						}
					});
				</script>
			`);

			try {
				await navigate(`http://localhost:${port}/`);
				await frame
					.locator("#result")
					.waitFor({ state: "attached", timeout: 10000 });
				await page.evaluate(() => {
					const iframe = document.querySelector(
						"#testframe"
					) as HTMLIFrameElement | null;
					if (!iframe?.contentWindow) {
						throw new Error("testframe contentWindow unavailable");
					}
					iframe.contentWindow.postMessage("probe", "*");
				});
				await page.waitForTimeout(250);
				const result = await frame
					.locator("#result")
					.textContent({ timeout: 10000 });
				if (!result) {
					throw new Error("no result");
				}
				const parsed = JSON.parse(result);
				if (parsed.status === "leak") {
					throw new Error(parsed.message);
				}
				if (parsed.status === "error") {
					throw new Error(parsed.message);
				}
				if (parsed.status !== "safe") {
					throw new Error(`unexpected status: ${parsed.status}`);
				}
			} finally {
				server.close();
			}
		},
	}),
	escapeTest({
		name: "escapes-object-assign-window-location-javascript",
		js: `
			Object.assign(window, { location: "javascript:${PAYLOAD}" });
		`,
	}),
	scriptTextEscape("escapes-script-text", `script.text = "${PAYLOAD}";`),
	scriptTextEscape(
		"escapes-script-innertext",
		`script.innerText = "${PAYLOAD}";`
	),
	scriptTextEscape(
		"escapes-script-append-string",
		`script.append("${PAYLOAD}");`
	),
	scriptTextEscape(
		"escapes-script-appendchild-textnode",
		`script.appendChild(document.createTextNode("${PAYLOAD}"));`
	),
	scriptTextEscape(
		"escapes-script-prepend-string",
		`script.prepend("${PAYLOAD}");`
	),
	scriptTextEscape(
		"escapes-script-replacechildren-string",
		`script.replaceChildren("${PAYLOAD}");`
	),
	scriptTextEscape(
		"escapes-script-insertadjacenttext",
		`script.insertAdjacentText("beforeend", "${PAYLOAD}");`
	),
	scriptTextEscape(
		"escapes-script-textnode-data",
		`
			const text = document.createTextNode("");
			script.appendChild(text);
			text.data = "${PAYLOAD}";
		`
	),
	scriptTextEscape(
		"escapes-script-textnode-nodevalue",
		`
			const text = document.createTextNode("");
			script.appendChild(text);
			text.nodeValue = "${PAYLOAD}";
		`
	),
	scriptTextEscape(
		"escapes-script-textnode-textcontent",
		`
			const text = document.createTextNode("");
			script.appendChild(text);
			text.textContent = "${PAYLOAD}";
		`
	),
	scriptTextEscape(
		"escapes-script-textnode-appenddata",
		`
			const text = document.createTextNode("check");
			script.appendChild(text);
			text.appendData("global(top);pass()");
		`
	),
	scriptTextEscape(
		"escapes-script-textnode-insertdata",
		`
			const text = document.createTextNode("check(top);pass()");
			script.appendChild(text);
			text.insertData(5, "global");
		`
	),
	scriptTextEscape(
		"escapes-script-textnode-replacedata",
		`
			const text = document.createTextNode("checkbogus(top);pass()");
			script.appendChild(text);
			text.replaceData(5, 5, "global");
		`
	),
	escapeTest({
		name: "escapes-setattributenode-onclick",
		js: `
			const button = document.createElement("button");
			const attr = document.createAttribute("onclick");
			attr.value = "${PAYLOAD}";
			button.setAttributeNode(attr);
			document.body.append(button);
			button.click();
		`,
	}),
	escapeTest({
		name: "escapes-setattribute-onclick",
		js: `
			const button = document.createElement("button");
			button.setAttribute("onclick", "checkglobal(top)");
			document.body.append(button);
			button.click();
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-setattributens-onclick",
		js: `
			const button = document.createElement("button");
			button.setAttributeNS(null, "onclick", "checkglobal(top)");
			document.body.append(button);
			button.click();
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-setnameditem-onclick",
		js: `
			const button = document.createElement("button");
			const attr = document.createAttribute("onclick");
			attr.value = "${PAYLOAD}";
			button.attributes.setNamedItem(attr);
			document.body.append(button);
			button.click();
		`,
	}),
	escapeTest({
		name: "escapes-setattributenode-script-src-data",
		js: `
			const script = document.createElement("script");
			const attr = document.createAttribute("src");
			attr.value = "data:text/javascript," + encodeURIComponent("${PAYLOAD}");
			script.setAttributeNode(attr);
			document.body.append(script);
		`,
	}),
	escapeTest({
		name: "escapes-setnameditem-script-src-data",
		js: `
			const script = document.createElement("script");
			const attr = document.createAttribute("src");
			attr.value = "data:text/javascript," + encodeURIComponent("${PAYLOAD}");
			script.attributes.setNamedItem(attr);
			document.body.append(script);
		`,
	}),
	escapeTest({
		name: "escapes-setattributenode-iframe-srcdoc",
		js: `
			const iframe = document.createElement("iframe");
			const attr = document.createAttribute("srcdoc");
			attr.value = "<script>${IFRAME_PAYLOAD}<\\/script>";
			iframe.setAttributeNode(attr);
			document.body.append(iframe);
		`,
	}),
	escapeTest({
		name: "escapes-shadowroot-innerhtml-onerror",
		js: `
			const host = document.createElement("div");
			const root = host.attachShadow({ mode: "open" });
			document.body.append(host);
			root.innerHTML = '<img src="x:" onerror="checkglobal(top)">';
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-shadowroot-sethtmlunsafe-onerror",
		js: `
			const host = document.createElement("div");
			const root = host.attachShadow({ mode: "open" });
			document.body.append(host);
			root.setHTMLUnsafe('<img src="x:" onerror="checkglobal(top)">');
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-domparser-xhtml-img-onerror",
		js: `
			const doc = new DOMParser().parseFromString(
				'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x:" onerror="checkglobal(top)"/></body></html>',
				'application/xhtml+xml'
			);
			document.body.append(doc.querySelector("img"));
			${SAFE_COMPLETION}
		`,
	}),
	serverTest({
		name: "escapes-xhr-responsexml-xhtml-img-onerror",
		autoPass: false,
		scramjetOnly: true,
		js: `
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/payload.xhtml");
			xhr.onload = () => {
				document.body.append(xhr.responseXML.querySelector("img"));
				${SAFE_COMPLETION}
			};
			xhr.send();
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/payload.xhtml") {
					res.writeHead(200, { "Content-Type": "application/xhtml+xml" });
					res.end(
						'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x:" onerror="checkglobal(top)"/></body></html>'
					);
				}
			});
		},
	}),
	serverTest({
		name: "escapes-xhr-response-document-html-img-onerror",
		autoPass: false,
		scramjetOnly: true,
		js: `
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/payload.html");
			xhr.responseType = "document";
			xhr.onload = () => {
				document.body.append(xhr.response.querySelector("img"));
				${SAFE_COMPLETION}
			};
			xhr.send();
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/payload.html") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end('<!doctype html><img src="x:" onerror="checkglobal(top)">');
				}
			});
		},
	}),
	serverTest({
		name: "escapes-xhr-response-document-xhtml-img-onerror",
		autoPass: false,
		scramjetOnly: true,
		js: `
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/payload.xhtml");
			xhr.responseType = "document";
			xhr.onload = () => {
				document.body.append(xhr.response.querySelector("img"));
				${SAFE_COMPLETION}
			};
			xhr.send();
		`,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/payload.xhtml") {
					res.writeHead(200, { "Content-Type": "application/xhtml+xml" });
					res.end(
						'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x:" onerror="checkglobal(top)"/></body></html>'
					);
				}
			});
		},
	}),
	escapeTest({
		name: "escapes-xslt-transformtofragment-img-onerror",
		js: `
			const xml = new DOMParser().parseFromString("<root/>", "text/xml");
			const xsl = new DOMParser().parseFromString(
				'<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="html" omit-xml-declaration="yes"/><xsl:template match="/"><img xmlns="http://www.w3.org/1999/xhtml" src="x:" onerror="checkglobal(top)"/></xsl:template></xsl:stylesheet>',
				"application/xml"
			);
			const processor = new XSLTProcessor();
			processor.importStylesheet(xsl);
			document.body.append(processor.transformToFragment(xml, document));
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-xslt-transformtodocument-img-onerror",
		js: `
			const xml = new DOMParser().parseFromString("<root/>", "text/xml");
			const xsl = new DOMParser().parseFromString(
				'<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="xml" omit-xml-declaration="yes"/><xsl:template match="/"><html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x:" onerror="checkglobal(top)"/></body></html></xsl:template></xsl:stylesheet>',
				"application/xml"
			);
			const processor = new XSLTProcessor();
			processor.importStylesheet(xsl);
			const doc = processor.transformToDocument(xml);
			document.body.append(doc.querySelector("img"));
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-svg-script-textcontent",
		js: `
			const ns = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(ns, "svg");
			const script = document.createElementNS(ns, "script");
			script.textContent = "checkglobal(top)";
			svg.appendChild(script);
			document.body.append(svg);
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-svg-script-setattributens-href-data",
		js: `
			const ns = "http://www.w3.org/2000/svg";
			const xlink = "http://www.w3.org/1999/xlink";
			const svg = document.createElementNS(ns, "svg");
			const script = document.createElementNS(ns, "script");
			script.setAttributeNS(xlink, "href", "data:text/javascript,checkglobal(top)");
			svg.appendChild(script);
			document.body.append(svg);
			${SAFE_COMPLETION}
		`,
	}),
	escapeTest({
		name: "escapes-setnameditem-iframe-srcdoc",
		js: `
			const iframe = document.createElement("iframe");
			const attr = document.createAttribute("srcdoc");
			attr.value = "<script>${IFRAME_PAYLOAD}<\\/script>";
			iframe.attributes.setNamedItem(attr);
			document.body.append(iframe);
		`,
	}),
];
