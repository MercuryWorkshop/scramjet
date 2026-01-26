import { serverTest } from "../testcommon.ts";

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
];
