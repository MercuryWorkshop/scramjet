import { playwrightTest } from "../../../testcommon.ts";
import fs from "fs";

// SITES=url1,url2 ; writes SITES_OUT json: {url: {errors:[], consoleErrors:[], title}}
export default [
	playwrightTest({
		name: "rv1-sites",
		fn: async ({ page, navigate }) => {
			const urls = (process.env.SITES ?? "https://example.com/").split(",");
			const out: Record<string, any> = {};
			for (const url of urls) {
				const errors: string[] = [];
				const cerr: string[] = [];
				const onErr = (e: Error) =>
					errors.push(
						(
							e.message +
							" | " +
							(e.stack ?? "").split("\n").slice(0, 4).join(" / ")
						).slice(0, 600)
					);
				const onCon = (m: any) => {
					if (m.type() === "error" || m.type() === "warning")
						cerr.push(`[${m.type()}] ${m.text()}`.slice(0, 300));
				};
				const net: string[] = [];
				const onReq = (r: any) => {
					if (process.env.SITES_NET && r.method() !== "GET") {
						let pd = "";
						try {
							pd = (r.postData() ?? "<null>").slice(0, 200);
						} catch {
							pd = "<binary>";
						}
						net.push(
							`REQ ${r.method()} ${decodeURIComponent(r.url()).slice(0, 250)} hdrs=${JSON.stringify(r.headers()).slice(0, 400)} body=${pd}`
						);
					}
				};
				const onResp = (r: any) => {
					if (
						process.env.SITES_NET &&
						(r.status() >= 400 ||
							r.request().method() !== "GET" ||
							r.url().includes("wasm") ||
							r.url().includes("blob"))
					)
						net.push(
							`RESP ${r.status()} ${r.request().method()} ${decodeURIComponent(r.url()).slice(0, 250)} ct=${r.headers()["content-type"]} len=${r.headers()["content-length"]} fromSW=${r.fromServiceWorker()} frame=${(() => {
								try {
									return r.frame().url().slice(0, 80);
								} catch {
									return "worker?";
								}
							})()}`
						);
				};
				page.context().on("request", onReq);
				page.context().on("response", onResp);
				page.on("pageerror", onErr);
				page.on("console", onCon);
				const onWorker = (w: any) => {
					net.push("WORKER " + decodeURIComponent(w.url()).slice(0, 300));
					try {
						w.on("console", (m: any) =>
							net.push("WCON " + m.text().slice(0, 300))
						);
					} catch {}
				};
				page.on("worker", onWorker);
				const wsrc: string[] = [];
				if (process.env.SITES_WORKERSRC) {
					const cdp = await page.context().newCDPSession(page);
					await cdp.send("Target.setAutoAttach", {
						autoAttach: true,
						waitForDebuggerOnStart: true,
						flatten: false,
					});
					cdp.on("Target.receivedMessageFromTarget", (ev: any) => {
						if (
							ev.message.includes("importScripts") ||
							ev.message.includes('"msg"')
						)
							wsrc.push(
								"WMSG " + ev.targetId + " " + ev.message.slice(0, 20000)
							);
					});
					cdp.on("Target.attachedToTarget", async (ev: any) => {
						net.push(
							"TARGET " +
								ev.targetInfo.type +
								" " +
								ev.targetInfo.url.slice(0, 200)
						);
						const sid = ev.sessionId;
						const conn: any = cdp as any;
						const send = (method: string, params: any) =>
							conn
								.send("Target.sendMessageToTarget", {
									sessionId: sid,
									message: JSON.stringify({
										id: Math.floor(Math.random() * 1e9),
										method,
										params,
									}),
								})
								.catch(() => {});
						if (ev.targetInfo.type === "worker") {
							await send("Runtime.evaluate", {
								expression: `(() => { self.__log = [location.href]; self.addEventListener("error", (e) => self.__log.push(["error", e.message]));  const is = self.importScripts; self.importScripts = function (...a) { self.__log.push(["importScripts", a.map(String), new Error().stack.split("\\n").slice(1, 6).join(" | ")]); return is.apply(this, a); }; const pm = self.postMessage; addEventListener("message", (e) => self.__log.push(["msg", String(e.data).slice(0, 6000), e.isTrusted, e.origin, String(e.source)]), true); setTimeout(() => { fetch("http://127.0.0.1:1/").catch(()=>{}); }, 0); })()`,
							});
						}
						await send("Runtime.runIfWaitingForDebugger", {});
						for (const t of [300, 1000, 2500])
							setTimeout(
								() =>
									send("Runtime.evaluate", {
										expression: `JSON.stringify(self.__log)`,
										returnByValue: true,
									}),
								t
							);
					});
					page.on("worker", async (w: any) => {
						try {
							const blobId = decodeURIComponent(w.url()).match(
								/blob:https?:\/\/[^/]+\/([0-9a-f-]+)/
							);
							if (blobId) {
								const frames = page.frames();
								for (const fr of frames) {
									try {
										const t = await fr.evaluate(
											`fetch("blob:" + location.origin + "/${blobId[1]}").then(r => r.text()).catch(e => "ERR " + e)`
										);
										wsrc.push(String(t));
										break;
									} catch {}
								}
							}
						} catch (e) {
							wsrc.push("ERR " + e);
						}
					});
				}
				let navErr = null;
				try {
					await navigate(url);
				} catch (e: any) {
					navErr = String(e).slice(0, 200);
				}
				await new Promise((r) =>
					setTimeout(r, Number(process.env.SITE_WAIT ?? 8000))
				);
				let info: any = null;
				try {
					const frames = page.frames();
					const f =
						frames.find((fr) => fr.url().includes("/~/sj/")) ??
						frames[frames.length - 1];
					if (process.env.SITES_EVAL)
						info = await f.evaluate(
							fs.readFileSync(process.env.SITES_EVAL, "utf8")
						);
					else
						info = await f.evaluate(
							`({ title: document.title, textLen: document.body ? document.body.innerText.length : -1, els: document.getElementsByTagName("*").length })`
						);
				} catch (e: any) {
					info = "EVAL-ERR " + String(e).slice(0, 200);
				}
				let frameInfo: any[] = [];
				if (process.env.SITES_FRAMES) {
					for (const fr of page.frames()) {
						let v: any;
						try {
							v = await fr.evaluate(
								`[typeof $scramjetController, typeof $scramjet, document.readyState, location.href.slice(0, 200), document.querySelectorAll("script").length]`
							);
						} catch (e: any) {
							v = "ERR " + String(e).slice(0, 100);
						}
						frameInfo.push([fr.url().slice(0, 250), v]);
					}
				}
				page.context().off("request", onReq);
				page.context().off("response", onResp);
				page.off("pageerror", onErr);
				page.off("console", onCon);
				out[url] = {
					navErr,
					info,
					errors,
					consoleErrors: cerr,
					frameInfo,
					net,
					wsrc,
				};
			}
			fs.writeFileSync(
				process.env.SITES_OUT ?? "/tmp/sites.json",
				JSON.stringify(out, null, 1)
			);
		},
	}),
];
