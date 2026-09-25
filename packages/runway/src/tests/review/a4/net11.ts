import { t } from "./net.ts";
/* eslint-disable quotes */
const extra = (server: any) => {
	server.on("request", (req: any, res: any) => {
		if (req.url.startsWith("/stream")) {
			res.writeHead(200, {
				"Content-Type": "text/plain",
				"X-Stream": "1",
			});
			let i = 0;
			const iv = setInterval(() => {
				res.write("chunk" + i + "\n");
				if (++i === 5) {
					clearInterval(iv);
					res.end();
				}
			}, 300);
		}
	});
};
export default [
	t(
		"rv4-k-xhr-streaming",
		`
		const seen = [];
		await new Promise((res, rej) => {
			const x = new XMLHttpRequest();
			x.open("GET", "/stream", true);
			x.onreadystatechange = () => {
				if (x.readyState === 2) seen.push("h:" + x.getResponseHeader("x-stream"));
				if (x.readyState === 3) seen.push("p" + x.responseText.split("\\n").length);
				if (x.readyState === 4) res();
			};
			x.onerror = () => rej(new Error("err"));
		x.send();
		});
		assertEqual(seen[0], "h:1", "headers at readyState 2");
		assert(seen.filter(s => s.startsWith("p")).length >= 3, "incremental progress: " + seen.join());
	`,
		extra
	),
	t(
		"rv4-k-fetch-streaming",
		`
		const t0 = performance.now();
		const r = await fetch("/stream");
		const reader = r.body.getReader();
		const { value } = await reader.read();
		const first = performance.now() - t0;
		assert(first < 1200, "first chunk arrived early: " + first);
		while (!(await reader.read()).done);
	`,
		extra
	),
];
