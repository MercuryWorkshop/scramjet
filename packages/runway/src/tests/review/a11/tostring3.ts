import { serverTest } from "../../../testcommon.ts";

export default [
	serverTest({
		name: "rv11-fn-tostring-arrow-minimal",
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				const path = req.url.split("?")[0];
				if (path === "/") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><head><script src="/plain.js"></script><script>window.inl = x => x * 2;</script></head><body><script>
					runTest(async () => {
						const out = { plain: String(window.plain), plainArgs: String(window.plain2), inline: String(window.inl), evald: String(eval('(y => y + 1)')), fn: String(new Function('return z => z')()) };
						console.log('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring-arrow-minimal": out}));
						fail('RV11PROBE ' + JSON.stringify({"rv11-fn-tostring-arrow-minimal": out}));
					}, false);
					</script></body>`);
				} else if (path === "/plain.js") {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
					});
					res.end(
						`window.plain = x => x + 1;\nwindow.plain2 = (a, b) => a + b;\n`
					);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	}),
];
