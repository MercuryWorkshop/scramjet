import { htmlTest } from "../../testcommon.ts";

export default [
	// The policy is not the proxy's to enforce, but the element is the page's
	// to find: still a meta, still matched by its http-equiv, still reading its
	// own policy back.
	htmlTest({
		name: "html-csp-meta-stays-an-element",
		html: `<!DOCTYPE html>
<html>
	<head>
		<meta http-equiv="Content-Security-Policy" content="img-src *">
	</head>
	<body>
		<script>
			runTest(async () => {
				const meta = document.querySelector('meta[http-equiv="content-security-policy" i]');
				assert(meta, "the meta is found by its http-equiv");
				assertEqual(meta.nodeType, Node.ELEMENT_NODE);
				assertEqual(meta.getAttribute("content"), "img-src *");
				assertEqual(meta.content, "img-src *");
			}, true);
		</script>
	</body>
</html>`,
	}),
];
