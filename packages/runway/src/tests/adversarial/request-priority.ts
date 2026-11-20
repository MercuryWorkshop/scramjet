import { serverTest } from "../../testcommon.ts";

export default [
	// a Priority header the page set is sent as it is
	serverTest({
		name: "request-priority-set-by-page-kept",
		autoPass: true,
		js: `
			const id = Math.random().toString(36).slice(2);
			await fetch("/probe?" + id, { headers: { Priority: "u=7" } });
			const seen = await (await fetch("/seen?" + id)).json();
			assertEqual(seen.priority, "u=7");
		`,
		async start(server) {
			const runs: Record<string, string | null> = {};
			server.on("request", (req, res) => {
				const id = req.url!.split("?")[1];
				if (req.url!.startsWith("/probe?")) {
					runs[id] = (req.headers.priority as string | undefined) ?? null;
					res.end();
				} else if (req.url!.startsWith("/seen?")) {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ priority: runs[id] ?? null }));
				}
			});
		},
	}),
];
