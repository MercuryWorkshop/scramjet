import { serverTest } from "../../../testcommon.ts";

const inner = (tag: string) =>
	`<!doctype html><body><script>try { const g = parent.__got || parent.parent.__got; g["${tag}"] = location.href.split("#")[0].replace(/:\\d+/, ":PORT"); } catch (e) { }</script></body>`;

export default [
	serverTest({
		name: "rv3-frames-object-embed-frame",
		async start(server) {
			server.on("request", (req, res) => {
				res.writeHead(200, {
					"content-type": "text/html",
				});
				if (req.url === "/inner-object") return res.end(inner("object"));
				if (req.url === "/inner-embed") return res.end(inner("embed"));
				if (req.url === "/inner-frame") return res.end(inner("frame"));
				if (req.url === "/frameset")
					return res.end(
						`<!doctype html><frameset cols="50%,50%"><frame src="/inner-frame"><frame src="about:blank"></frameset>`
					);
				res.end(`<!doctype html><body>
<object data="/inner-object" type="text/html" width=10 height=10></object>
<embed src="/inner-embed" type="text/html" width=10 height=10>
<iframe src="/frameset"></iframe>
<script>
const got = window.__got = {};
runTest(async () => {
  await new Promise(r => setTimeout(r, 2500));
  assertConsistent("object", got.object);
  assertConsistent("embed", got.embed);
  assertConsistent("frame", got.frame);
}, true);
</script></body>`);
			});
		},
	}),
];
