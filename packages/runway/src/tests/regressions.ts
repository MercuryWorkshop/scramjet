import { basicTest, serverTest } from "../testcommon.ts";
// historical regressions

export default [
	// scramjet/core
	// introduced by: ?
	// fixed by: https://github.com/HeyPuter/browser.js/commit/1715a6aeb072284b58ce38f807f1b14f5151dd7a
	basicTest({
		name: "regression-1715-for-body-walk",
		js: `
            const a = {top: 1, parent: 2, location: 3, eval: 4};
            for (let x in a) {
                checkglobal(window[x]);
            }
            for (let x in a) checkglobal(window[x]);

            const b = ["top", "parent", "location", "eval"];
            for (const x of b) {
                checkglobal(window[x]);
            }
            for (const x of b) checkglobal(window[x]);
    `,
	}),

	// scramjet/core
	// introduced by: ?
	// fixed by: https://github.com/HeyPuter/browser.js/commit/ae35b473dd2cbb0b76d3098e9a748e296cedf425
	basicTest({
		name: "regression-ae35-optional-postmessage",
		js: `
        const messages = [];
        const fakeTarget = {
          postMessage: (msg) => messages.push(msg)
        };
        fakeTarget?.postMessage("test");
        assertEqual(messages.length, 1, "optional postMessage should work");

        const nullTarget = null;
        nullTarget?.postMessage("test");
        assertEqual(messages.length, 1, "null optional should not call");
      `,
	}),

	// scramjet/rewriter
	// tree would be culled if destructure_rewrites was off and a destructure happened
	// introduced by: ?
	// fixed by https://github.com/HeyPuter/browser.js/commit/09f823c9573f9cdd09bc94663a384ace9816fd4c
	// related issue: https://discord.com/channels/1259284248129437726/1457141828557078592
	basicTest({
		name: "regression-09f823c-rewriter-culled",
		js: `
			let [a, b] = (checkglobal(top), [0,1]);
			([b, c] = (checkglobal(top), [0,1]));
			let { d } = (checkglobal(top), ({a: 2}));
			({ d } = (checkglobal(top), ({a:1})));
		`,
	}),

	// scramjet/rewriter
	// crash on overlapping CleanFunction and importfn
	// TODO: this only happens when destructure_rewrites is on. harness does not let you set flags
	// introduced by: ?
	// fixed by https://github.com/HeyPuter/browser.js/commit/09f823c9573f9cdd09bc94663a384ace9816fd4c
	// related issue: https://discord.com/channels/1259284248129437726/1457141828557078592
	basicTest({
		name: "regression-09f823c-rewriter-crash",
		js: `
			()=>import("data:text/javascript,checkglobal(top)")
		`,
	}),

	// scramjet/html
	// module script metadata must stay in scramjet's reserved query params.
	// Leaking it as an upstream type=module query can make module graphs load twice.
	serverTest({
		name: "regression-module-script-query-does-not-leak",
		scramjetOnly: true,
		async start(server) {
			let depRequests = 0;
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`
						<!doctype html>
						<script type="importmap">
							{
								"imports": {
									"#dep": "/dep.js?real=1"
								}
							}
						</script>
						<link rel="modulepreload" crossorigin href="/dep.js?real=1">
						<script type="module" src="/mod.js?real=1"></script>
					`);
					return;
				}

				if (req.url?.startsWith("/mod.js")) {
					const url = new URL(req.url, "http://test.invalid");
					res.writeHead(200, { "Content-Type": "application/javascript" });
					if (url.searchParams.get("real") !== "1") {
						res.end(
							`window.fail("original module script query was not preserved")`
						);
					} else if (url.searchParams.has("type")) {
						res.end(
							`window.fail("scramjet module marker leaked upstream", { search: ${JSON.stringify(url.search)} })`
						);
					} else {
						res.end(`
							import "#dep";
							setTimeout(async () => {
								const depRequests = await fetch("/dep-count").then((res) => res.text());
								if (depRequests === "1") window.pass("module URLs canonicalized without leaking proxy metadata");
								else window.fail("modulepreload and import produced duplicate upstream requests", { depRequests });
							});
						`);
					}
					return;
				}

				if (req.url?.startsWith("/dep.js")) {
					depRequests++;
					const url = new URL(req.url, "http://test.invalid");
					res.writeHead(200, { "Content-Type": "application/javascript" });
					if (url.searchParams.get("real") !== "1") {
						res.end(
							`window.fail("original module dependency query was not preserved")`
						);
					} else if (url.searchParams.has("type")) {
						res.end(
							`window.fail("scramjet module marker leaked upstream from dependency", { search: ${JSON.stringify(url.search)} })`
						);
					} else {
						res.end(`export default 1;`);
					}
					return;
				}

				if (req.url === "/dep-count") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end(String(depRequests));
					return;
				}

				res.writeHead(404);
				res.end("not found");
			});
		},
	}),
];
