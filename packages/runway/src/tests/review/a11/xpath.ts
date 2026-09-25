import { probeTest } from "./lib.ts";

export default [
	probeTest({
		name: "rv11-xpath-attrs",
		body: `<a id=xa href="/x/y">x</a><img id=xi src="/i.png"><div id=xs style="color: red"></div><script id=xsc>window.__x=1</script>`,
		probes: {
			href_pred: `return document.evaluate('//a[@href="/x/y"]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;`,
			href_contains: `return document.evaluate('count(//a[contains(@href, "/x/")])', document, null, XPathResult.NUMBER_TYPE, null).numberValue;`,
			href_string: `return document.evaluate('string(//a/@href)', document, null, XPathResult.STRING_TYPE, null).stringValue.replace(location.origin, 'O').slice(0, 80);`,
			src_string: `return document.evaluate('string(//img/@src)', document, null, XPathResult.STRING_TYPE, null).stringValue.replace(location.origin, 'O').slice(0, 80);`,
			attr_count: `return document.evaluate('count(//a[@id="xa"]/@*)', document, null, XPathResult.NUMBER_TYPE, null).numberValue;`,
			style_pred: `return document.evaluate('count(//div[@style="color: red"])', document, null, XPathResult.NUMBER_TYPE, null).numberValue;`,
			script_text: `return document.evaluate('string(//script[@id="xsc"])', document, null, XPathResult.STRING_TYPE, null).stringValue.slice(0, 60);`,
			attr_node_value: `const n = document.evaluate('//a/@href', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; return [n.value, n.nodeValue, n.name].map(String).map(s => s.replace(location.origin, 'O').slice(0, 60));`,
		},
	}),
];
