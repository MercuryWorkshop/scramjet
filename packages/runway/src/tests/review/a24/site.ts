import { playwrightTest } from "../../../testcommon.ts";
export default [
	playwrightTest({
		name: "rv24-site-github-api",
		fn: async ({ frame, navigate }) => {
			await navigate("https://example.com/");
			await new Promise((r) => setTimeout(r, 1500));
			const out = await frame.locator("html").evaluate(async () => {
				const o: any = {};
				const r = await fetch(
					"https://api.github.com/repos/facebook/react/issues?per_page=2"
				);
				o.status = r.status;
				o.type = r.type;
				o.href = location.href;
				o.perf = performance
					.getEntriesByType("resource")
					.map((e) => e.name)
					.filter((n) => n.includes("issues"));
				o.hasSj = typeof (window as any).$scramjet;
				o.link = r.headers.get("link");
				o.rl = [
					r.headers.get("x-ratelimit-limit"),
					r.headers.get("x-ratelimit-remaining") !== null,
				];
				o.ct = r.headers.get("content-type");
				o.etag = !!r.headers.get("etag");
				o.keys = [...r.headers.keys()];
				const x = new XMLHttpRequest();
				x.open(
					"GET",
					"https://api.github.com/repos/facebook/react/issues?per_page=2"
				);
				await new Promise((res) => {
					x.onload = res;
					x.onerror = res;
					x.send();
				});
				o.xhrLink = x.getResponseHeader("link");
				o.xhrAllKeys = x
					.getAllResponseHeaders()
					.split("\r\n")
					.map((l) => l.split(":")[0])
					.filter(Boolean);
				return o;
			});
			throw new Error("R24 " + JSON.stringify(out));
		},
	}),
];
