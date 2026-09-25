import { serverTest } from "../../../testcommon.ts";

// rv19: login popup hands its result back through storage/BroadcastChannel.

export default [
	serverTest({
		name: "rv19-popupstorage-handoff",
		autoPass: true,
		js: `
			const out = {};
			sessionStorage.setItem("state", "S1");
			const bc = new BroadcastChannel("auth");
			const gotBc = new Promise((r) => { bc.onmessage = (e) => r(e.data); setTimeout(() => r("timeout"), 5000); });
			const gotStorage = new Promise((r) => { addEventListener("storage", (e) => { if (e.key === "auth_result") r([e.key, e.newValue, e.url.replace(location.origin, "O")]); }); setTimeout(() => r("timeout"), 5000); });
			window.open("/cb?code=abc", "login", "width=300,height=300");
			out.bc = await gotBc;
			out.storage = await gotStorage;
			out.ls = localStorage.getItem("auth_result");
			out.ssUnchanged = sessionStorage.getItem("state");
			assertConsistent("handoff", out);
			if (out.bc === "timeout" || out.storage === "timeout" || out.ls !== "tok-abc") fail(JSON.stringify(out));
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/cb") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><script>
						const ok = sessionStorage.getItem("state") === "S1";
						sessionStorage.setItem("state", "popup-changed");
						localStorage.setItem("auth_result", ok ? "tok-" + new URLSearchParams(location.search).get("code") : "bad-state");
						new BroadcastChannel("auth").postMessage({ ok, code: new URLSearchParams(location.search).get("code") });
						setTimeout(() => close(), 300);
					</script>`);
					return;
				}
			});
		},
	}),
];
