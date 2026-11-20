import { htmlTest } from "../../testcommon.ts";

const check = `
	runTest(async () => {
		assertEqual(document.compatMode, "CSS1Compat");
	}, true);
`;

export default [
	// A root-level element after `</html>` is enough to send the rewriter down
	// its quirky-structure path, which injects ahead of everything else. Ahead
	// of the doctype is too far: a start tag before a DOCTYPE token sets the
	// document to quirks mode (HTML Standard 13.2.6.4.1).
	htmlTest({
		name: "html-quirky-structure-keeps-doctype",
		html: `<!DOCTYPE html>
<html>
	<head></head>
	<body>
		<script>
			runTest(async () => {
				assertEqual(document.compatMode, "CSS1Compat");
				assertEqual(document.firstChild.nodeType, Node.DOCUMENT_TYPE_NODE);
			}, true);
		</script>
	</body>
</html>
<div></div>`,
	}),
	// whitespace ahead of the doctype is dropped by the parser, and a leading
	// newline from a template engine is everywhere
	htmlTest({
		name: "html-quirky-structure-keeps-doctype-after-newline",
		html: `\n\n<!DOCTYPE html>\n<html><head></head><body><script>${check}</script></body></html><div></div>`,
	}),
	// no <html> tag at all, which also takes the quirky-structure path
	htmlTest({
		name: "html-quirky-structure-keeps-doctype-without-html",
		html: `<!DOCTYPE html><title>t</title><script>${check}</script>`,
	}),
	// and a comment ahead of the doctype changes nothing
	htmlTest({
		name: "html-quirky-structure-keeps-doctype-after-comment",
		html: `<!-- hi --><!DOCTYPE html><title>t</title><script>${check}</script>`,
	}),
];
