import { serverTest } from "../testcommon.ts";

// A request the browser sends straight to the site, bypassing the proxy,
// carries the proxy page's own URL as its referer.
const bypassed = (req: { headers: Record<string, any> }) =>
	String(req.headers.referer ?? "").includes("/~/sj/");

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

export default [
	serverTest({
		name: "linkheader-preload",
		start: async (server, port, { pass, fail }) => {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						Link: `<http://localhost:${port}/script.js>; rel="preload"; as="script"`,
					});
					res.end();
				} else if (req.url === "/script.js") {
					console.log("script.js loaded");
					pass("script.js loaded");
				} else {
					console.log("unexpected url request", req.url);
					res.writeHead(404);
					res.end("Not found");
					fail("unexpected url request");
				}
			});
		},
	}),
	serverTest({
		name: "linkheader-multiple-preloads",
		start: async (server, port, { pass, fail }) => {
			const loaded = new Set<string>();
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						Link: `<http://localhost:${port}/script1.js>; rel="preload"; as="script", <http://localhost:${port}/script2.js>; rel="preload"; as="script"`,
					});
					res.end();
				} else if (req.url === "/script1.js") {
					loaded.add("script1");
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end("console.log('script1');");
					if (loaded.size === 2) {
						pass("both scripts preloaded");
					}
				} else if (req.url === "/script2.js") {
					loaded.add("script2");
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end("console.log('script2');");
					if (loaded.size === 2) {
						pass("both scripts preloaded");
					}
				} else {
					res.writeHead(404);
					res.end("Not found");
					fail(`unexpected url request: ${req.url}`);
				}
			});
		},
	}),
	serverTest({
		name: "linkheader-next-prev",
		start: async (server, port) => {
			const link = `<http://localhost:${port}/page2>; rel="next", <http://localhost:${port}/page0>; rel="prev"`;
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`
                    <script>
                        fetch("/page1").then(res => {
                            let next = res.headers.get("Link");
                            const expected = '${link}';
                            if (next === expected) {
                                __testPass("next link header is correct");
                            } else {
                                __testFail("next link header is incorrect", { actual: next, expected: expected });
                            }
                        });
                    </script>
                    `);
				} else if (req.url === "/page1") {
					res.writeHead(200, {
						Link: link,
					});
					res.end("Page 1");
				} else {
					res.writeHead(404);
					res.end("Not found");
				}
			});
		},
	}),
	serverTest({
		name: "linkheader-next-prev-xhr",
		start: async (server, port) => {
			const link = `<http://localhost:${port}/page2>; rel="next", <http://localhost:${port}/page0>; rel="prev"`;
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`
                    <script>
                        const xhr = new XMLHttpRequest();
                        xhr.open("GET", "/page1");
                        xhr.onload = () => {
                            let next = xhr.getResponseHeader("Link");
                            const expected = '${link}';
                            if (next === expected) {
                                __testPass("next link header is correct (xhr)");
                            } else {
                                __testFail("next link header is incorrect (xhr)", { actual: next, expected: expected });
                            }
                        };
                        xhr.send();
                    </script>
                    `);
				} else if (req.url === "/page1") {
					res.writeHead(200, {
						Link: link,
					});
					res.end("Page 1");
				} else {
					res.writeHead(404);
					res.end("Not found");
				}
			});
		},
	}),
	serverTest({
		// one server serves both harnesses, so these count scramjet's requests alone
		scramjetOnly: true,
		name: "linkheader-imagesrcset-preload-is-proxied",
		start: async (server, port, { pass, fail }) => {
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						Link: `</img.png>; rel=preload; as=image; imagesrcset="http://localhost:${port}/srcset.png 1x, http://localhost:${port}/srcset.png 2x"; imagesizes="100vw"`,
					});
					res.end(
						`<!doctype html><script>setTimeout(() => fetch("/done"), 1500)</script>`
					);
				} else if (path === "/srcset.png" || path === "/img.png") {
					res.writeHead(200, { "Content-Type": "image/png" });
					res.end(PNG);
					if (bypassed(req)) fail(`${path} bypassed the proxy`);
				} else if (path === "/done") {
					res.writeHead(204);
					res.end();
					pass("no preload bypassed the proxy");
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
	serverTest({
		scramjetOnly: true,
		name: "linkheader-modulepreload-fetched-once",
		start: async (server, port, { pass, fail }) => {
			let hits = 0;
			server.on("request", (req, res) => {
				const path = (req.url ?? "").split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
						Link: `</m.js>; rel=modulepreload`,
					});
					res.end(`<!doctype html><script type="module" src="/m.js"></script>`);
				} else if (path === "/m.js") {
					hits++;
					res.writeHead(200, { "Content-Type": "text/javascript" });
					res.end(
						`setTimeout(() => fetch("/done"), 1000); export const x = 1;`
					);
				} else if (path === "/done") {
					res.writeHead(204);
					res.end();
					if (hits === 1) pass("the module was fetched once");
					else fail(`the module was fetched ${hits} times`);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
