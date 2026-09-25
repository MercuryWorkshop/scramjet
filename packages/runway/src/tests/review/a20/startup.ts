import { serverTest } from "../../../testcommon.ts";

// rv20: worker start-up cost (new Worker -> first message), main vs dev.

const route = (server: any) =>
	server.on("request", (req: any, res: any) => {
		if (res.headersSent) return;
		const path = (req.url || "/").split("?")[0];
		if (path === "/" || path === "/script.js") return;
		if (path === "/up.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
				"Cache-Control": "no-store",
			});
			res.end("postMessage(performance.now());");
			return;
		}
		if (path === "/sh.js") {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
				"Cache-Control": "no-store",
			});
			res.end("onconnect = (e) => e.ports[0].postMessage(1);");
			return;
		}
		res.writeHead(404);
		res.end();
	});

export default [
	serverTest({
		name: "rv20-startup",
		autoPass: true,
		js: String.raw`
		const N = 12;
		const time = async (mk) => {
			const out = [];
			for (let i = 0; i < N; i++) {
				const t0 = performance.now();
				const w = mk(i);
				const inner = await new Promise((res) => { (w.port || w).onmessage = (e) => res(e.data); w.onerror = () => res(-1); setTimeout(() => res(-2), 10000); });
				out.push([performance.now() - t0, inner]);
				(w.terminate ? w.terminate() : w.port.close());
			}
			const firsts = out.map((x) => x[0]).sort((a, b) => a - b);
			const inner = out.map((x) => x[1]).sort((a, b) => a - b);
			return { median: Math.round(firsts[N >> 1]), min: Math.round(firsts[0]), max: Math.round(firsts[N - 1]), innerMedian: Math.round(inner[N >> 1]) };
		};
		const src = "postMessage(performance.now());";
		const r = {
			file: await time((i) => new Worker("/up.js?i=" + i)),
			blob: await time(() => new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })))),
			data: await time((i) => new Worker("data:text/javascript," + encodeURIComponent(src + "//" + i))),
			shared: await time((i) => new SharedWorker("/sh.js?i=" + i, "s" + i)),
		};
		console.log("RV20TIME " + JSON.stringify(r));
		`,
		start: async (server) => route(server),
	}),
];
