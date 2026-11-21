import { playwrightTest } from "../../../testcommon.ts";

// v3 review: who builds the double-proxied requests on amazon.com?
export default [
	playwrightTest({
		name: "v3-probe-amazon-double-proxy-initiator",
		fn: async ({ page, navigate }) => {
			const cdp = await page.context().newCDPSession(page);
			await cdp.send("Network.enable");
			await cdp.send("Target.setAutoAttach", {
				autoAttach: true,
				waitForDebuggerOnStart: false,
				flatten: true,
			});
			const hits: any[] = [];
			const onReq = (e: any) => {
				const u: string = e.request?.url ?? "";
				if (
					/~\/sj\/[^/]+\/[^/]+\/https?%3A%2F%2Flocalhost/.test(u) ||
					/~\/sj\/[^/]+\/[^/]+\/http%3A%2F%2Flocalhost%3A\d+%2F~%2Fsj/.test(u)
				) {
					hits.push({
						url: decodeURIComponent(u).slice(0, 220),
						type: e.type,
						initiator: e.initiator,
					});
				}
			};
			cdp.on("Network.requestWillBeSent", onReq);
			await navigate("https://www.amazon.com/");
			await page.waitForTimeout(15000);
			const { root } = await cdp.send("DOM.getDocument", {
				depth: -1,
				pierce: true,
			});
			const found: string[] = [];
			const walk = async (n: any) => {
				if (
					n.nodeName === "IMG" &&
					(n.attributes ?? []).some((a: string) =>
						/http%3A%2F%2Flocalhost|http:\/\/localhost:\d+\/~\/sj\/[^"]*http:\/\/localhost/.test(
							a
						)
					)
				) {
					const parent = n.parentId
						? await cdp
								.send("DOM.getOuterHTML", { nodeId: n.parentId })
								.catch(() => null)
						: null;
					found.push(
						((parent as any)?.outerHTML ?? JSON.stringify(n.attributes)).slice(
							0,
							1500
						)
					);
				}
				for (const c of [
					...(n.children ?? []),
					...(n.contentDocument ? [n.contentDocument] : []),
					...(n.shadowRoots ?? []),
				])
					await walk(c);
			};
			await walk(root);
			throw new Error(
				"DOUBLE " +
					hits.length +
					"\n" +
					hits
						.map(
							(h) =>
								`${h.type} ${h.initiator?.type} ${h.url}\n    ` +
								frames(h).join("\n    ")
						)
						.join("\n")
			);
			const frames = (h: any) =>
				(h.initiator?.stack?.callFrames ?? [])
					.slice(0, 8)
					.map(
						(f: any) =>
							`${f.functionName || "?"} ${decodeURIComponent(f.url).slice(-90)}:${f.lineNumber}:${f.columnNumber}`
					);
			throw new Error(
				"PROBE " +
					hits.length +
					" double-proxied\n" +
					hits
						.slice(0, 6)
						.map(
							(h) =>
								`${h.type} ${h.initiator?.type} ${h.url}\n    ` +
								frames(h).join("\n    ")
						)
						.join("\n")
			);
		},
	}),
];
