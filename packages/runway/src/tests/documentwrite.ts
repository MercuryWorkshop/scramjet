import { basicTest, htmlTest } from "../testcommon.ts";

// TODO: these tests suck
export default [
	basicTest({
		name: "documentwrite-sanity",
		js: `
			const doc = document.implementation.createHTMLDocument();
			doc.documentElement.innerHTML = "<html>some initial content</html>";
			doc.open();
			doc.write("<html><body><h1>Hello, world!</h1></body></html>");
			doc.close();

			assertEqual(doc.body.innerHTML, "<h1>Hello, world!</h1>", "document.write should write the correct HTML");
		`,
	}),
	basicTest({
		name: "documentwrite-streaming",
		js: `
			const doc = document.implementation.createHTMLDocument();
			doc.write("<!doctype html><body><div cl", 'ass="ok">hello');
			doc.writeln("</div", ">", "<span>tail</span>");
			doc.close();

			assertEqual(
				doc.body.innerHTML,
				'<div class="ok">hello</div><span>tail</span>\\n',
				"document.write/writeln should keep parser state across calls and arguments"
			);
		`,
	}),
	basicTest({
		name: "documentwrite-streaming-cross-realm",
		js: `
			const iframe = document.createElement("iframe");
			document.body.append(iframe);
			let iframewin = iframe.contentWindow;
			let write2 = iframewin.document.write;

			const doc = document.implementation.createHTMLDocument();
			doc.write("<!doctype html><body><div cl", 'ass="ok">hello');
			write2.call(doc, "</div", ">", "<span>tail</span>");
			doc.close();

			assertEqual(
				doc.body.innerHTML,
				'<div class="ok">hello</div><span>tail</span>',
				"document.write/writeln should keep parser state across calls and arguments"
			);
		`,
	}),
	basicTest({
		name: "documentwrite-close-flushes-buffered-tail",
		js: `
			const doc = document.implementation.createHTMLDocument();
			doc.write("<!doctype html><body><div>hello");
			doc.write("</div><span>tail");
			doc.close();

			assertEqual(
				doc.body.innerHTML,
				"<div>hello</div><span>tail</span>",
				"document.close should flush any remaining buffered HTML"
			);
		`,
	}),
	basicTest({
		name: "documentwrite-open-resets-partial-stream",
		js: `
			const doc = document.implementation.createHTMLDocument();
			doc.write("<!doctype html><body><div cl");
			doc.open();
			doc.write("<!doctype html><body><p>reset</p>");
			doc.close();

			assertEqual(
				doc.body.innerHTML,
				"<p>reset</p>",
				"document.open should discard the previous incremental write state"
			);
		`,
	}),
	basicTest({
		name: "documentwrite-empty-call-preserves-parser-state",
		js: `
			const doc = document.implementation.createHTMLDocument();
			doc.write("<!doctype html><body><div cl");
			doc.write("");
			doc.write('ass="ok">hello</div>');
			doc.close();

			assertEqual(
				doc.body.innerHTML,
				'<div class="ok">hello</div>',
				"empty document.write calls should not disturb streaming parser state"
			);
		`,
	}),
	htmlTest({
		name: "documentwrite-script-insertion-point",
		html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="before">before</div>
<script>
document.write("<span id=written>hello</span>");
assert(
	document.body.innerHTML.includes("hello"),
	"document.write from a parser-inserted script should inject markup"
);
assert(document.getElementById("before"), "content before the script should parse first");
pass();
</script>
<div id="after">after</div>

</body>
</html>`,
	}),
];
