import { serverTest } from "../../../testcommon.ts";
import { WebSocketServer } from "ws";
import { api, common } from "./net.ts";
/* eslint-disable quotes */
export default [
	serverTest({
		name: "rv4-l-zonejs",
		autoPass: true,
		js: `
			await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/zone.js@0.14.10/bundles/zone.umd.js"; s.onload = res; s.onerror = () => rej(new Error("zone load")); document.head.appendChild(s); });
			assert(window.Zone, "zone loaded");
			const tasks = [];
			const z = Zone.current.fork({ name: "t", onScheduleTask(d, c, t, task) { tasks.push(task.source); return d.scheduleTask(t, task); } });
			await new Promise((res, rej) => z.run(() => {
				fetch("/echo").then(r => { try { assertEqual(Zone.current.name, "t", "fetch then zone"); res(); } catch (e) { rej(e); } }, rej);
			}));
			await new Promise((res, rej) => z.run(() => {
				const x = new XMLHttpRequest();
				x.open("GET", "/text");
				x.onload = () => { try { assertEqual(Zone.current.name, "t", "xhr cb zone"); assertEqual(x.getResponseHeader("x-custom"), "abc", "hdr"); res(); } catch (e) { rej(e); } };
				x.onerror = () => rej(new Error("xhr err"));
				x.send();
			}));
			await new Promise((res, rej) => z.run(() => {
				const ws = new WebSocket("ws://" + location.host + "/");
				ws.onopen = () => ws.send("zz");
				ws.onmessage = (e) => { try { assertEqual(e.data, "zz", "ws echo"); assertEqual(Zone.current.name, "t", "ws cb zone"); ws.close(); res(); } catch (er) { rej(er); } };
				ws.onerror = () => rej(new Error("ws err"));
				setTimeout(() => rej(new Error("ws timeout")), 5000);
			}));
			assert(tasks.some(s => /XMLHttpRequest/.test(s)), "xhr task scheduled: " + tasks.join());
		`,
		async start(server) {
			api(server, common);
			const wss = new WebSocketServer({
				server,
			});
			wss.on("connection", (s) =>
				s.on("message", (m, b) =>
					s.send(m, {
						binary: b,
					})
				)
			);
		},
	}),
];
