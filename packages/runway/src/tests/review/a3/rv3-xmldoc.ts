import { serverTest } from "../../../testcommon.ts";

// A document served as XML (XHTML / SVG) - does it get the client injected and
// its scripts rewritten, or does page JS run raw in the proxy origin?
export default [
	serverTest({
		name: "rv3-xmldoc-xhtml",
		async start(server) {
			server.on("request", (req, res) => {
				res.writeHead(200, {
					"content-type": "application/xhtml+xml",
				});
				res.end(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><p>xhtml</p>
<script>//<![CDATA[
runTest(async () => { assertConsistent("href", location.href.replace(/:\\d+/, ":PORT")); assertConsistent("origin-ish", document.domain); assertConsistent("hasSW", typeof window.$scramjet); }, true);
//]]></script></body></html>`);
			});
		},
	}),
	serverTest({
		name: "rv3-xmldoc-svg",
		async start(server) {
			server.on("request", (req, res) => {
				res.writeHead(200, {
					"content-type": "image/svg+xml",
				});
				res.end(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg"><text y="20">svg doc</text><script>//<![CDATA[
runTest(async () => { assertConsistent("href", location.href.replace(/:\\d+/, ":PORT")); assertConsistent("domain", document.domain); }, true);
//]]></script></svg>`);
			});
		},
	}),
];
