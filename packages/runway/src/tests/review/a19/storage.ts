import { basicTest, serverTest } from "../../../testcommon.ts";

// rv19: Storage wrapper semantics vs bare Chrome.

export default [
	basicTest({
		name: "rv19-storage-proto-extension",
		js: `
			localStorage.clear();
			// the StackOverflow "store objects in localStorage" idiom
			Storage.prototype.setObject = function (k, v) { this.setItem(k, JSON.stringify(v)); };
			Storage.prototype.getObject = function (k) { const v = this.getItem(k); return v && JSON.parse(v); };
			const out = {};
			try { localStorage.setObject("o", { x: 1 }); out.set = localStorage.getItem("o"); } catch (e) { out.set = "ERR:" + e.message; }
			try { out.get = JSON.stringify(localStorage.getObject("o")); } catch (e) { out.get = "ERR:" + e.message; }
			try { out.typeofSS = typeof sessionStorage.setObject; } catch (e) { out.typeofSS = "ERR"; }
			out.inOp = "setObject" in localStorage;
			assertConsistent("protoext", out);
			localStorage.clear();
		`,
	}),
	basicTest({
		name: "rv19-storage-named-setter-on-member",
		js: `
			localStorage.clear();
			const out = {};
			try { localStorage.key = "kv"; } catch (e) { out.err = e.name; }
			out.getKey = localStorage.getItem("key");
			out.typeofKey = typeof localStorage.key;
			out.len = localStorage.length;
			out.keys = Object.keys(localStorage).join(",");
			assertConsistent("namedsetter", out);
			localStorage.removeItem("key");
		`,
	}),
	serverTest({
		name: "rv19-storage-event-clear",
		autoPass: true,
		js: `
			localStorage.clear();
			localStorage.setItem("a", "1"); localStorage.setItem("b", "2"); localStorage.setItem("c@x", "3");
			const evs = [];
			addEventListener("storage", (e) => evs.push([e.key, e.oldValue, e.newValue, e.url.replace(location.origin, "O"), e.storageArea === localStorage]));
			const f = document.createElement("iframe"); f.src = "/writer.html"; document.body.appendChild(f);
			await new Promise((r) => setTimeout(r, 1500));
			assertConsistent("events", evs);
		`,
		start: async (server) => {
			server.on("request", (req: any, res: any) => {
				if (res.headersSent) return;
				if (req.url === "/writer.html") {
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(
						"<script>localStorage.setItem('d@y','4'); localStorage.clear();</script>"
					);
				}
			});
		},
	}),
];
