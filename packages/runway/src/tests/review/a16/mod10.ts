import { site } from "./lib.ts";

export default [
	site("rv16-map-base-href-static", {
		"/sub/b.js": "export default 'b@sub';",
		"/b.js": "export default 'b@root';",
		"/": `<!doctype html><html><head><base href="/sub/"><script type="importmap">{"imports":{"b":"./b.js","./k.js":"./b.js"}}</script></head><body>
<script type="module">
import b from "b";
import k from "./k.js";
runTest(async () => { assertConsistent("static", b); assertConsistent("key", k); }, true);
</script></body></html>`,
	}),
];
