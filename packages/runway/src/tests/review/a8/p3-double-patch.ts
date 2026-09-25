import { basicTest } from "../../../testcommon.ts";

// Mirrors packages/inject/src/context.ts (the browser.js frontend): a fresh
// client for a realm whose embedder installs client.Proxy() emulators on
// members *before* client.hook() (inject: History.prototype.pushState & co,
// window.open, EventTarget.prototype.addEventListener). Checks the core
// interceptors still apply afterwards.
export default [
	basicTest({
		name: "rv8p3-proxy-before-hook",
		scramjetOnly: true,
		js: `
  const SJ = Symbol.for("scramjet client global");
  const parentClient = window[SJ];
  assert(parentClient, "client reachable");
  const f = document.createElement("iframe");
  document.body.appendChild(f);
  // the raw window, without the hooking contentWindow getter
  const w = window[0];
  const already = SJ in w;
  const seen = [];
  if (!already) {
    const c = new parentClient.constructor(w, parentClient.init);
    c.Proxy("History.prototype.pushState", { apply(ctx) { seen.push("emu-pushState"); } });
    c.Proxy("EventTarget.prototype.addEventListener", { apply(ctx) { seen.push("emu-ael"); } });
    c.hook();
  }
  let pushedUrl = null;
  try { w.history.pushState(null, "", "/rv8p3"); } catch (e) { pushedUrl = /URL '([^']+)'/.exec(e.message)?.[1]; }
  const data = await new Promise(r => { w.addEventListener("message", e => r(e.data)); w.postMessage("hello", "*"); setTimeout(() => r("timeout"), 1000); });
  const r = { already, seen, pushStateRewritten: !!pushedUrl && pushedUrl.includes("/~/sj/"), messageData: typeof data === "string" ? data : JSON.stringify(data).slice(0, 80) };
  assertEqual(r.pushStateRewritten, true, "pushState URL rewritten: " + JSON.stringify(r));
  assertEqual(r.messageData, "hello", "message data: " + JSON.stringify(r));
`,
	}),
	basicTest({
		name: "rv8p3-rawproxy-on-instance",
		scramjetOnly: true,
		js: `
  // packages/inject/src/emulators/alwaysLastBubble.ts does this for every
  // click/auxclick/contextmenu reaching a link: RawProxy the *event instance's*
  // stopPropagation, with a handler that throws outside its own listener
  const client = window[Symbol.for("scramjet client global")];
  const e1 = new Event("x");
  client.RawProxy(e1, "stopPropagation", { apply() { throw new Error("emulator handler ran for another event"); } });
  const e2 = new Event("y");
  e2.stopPropagation();
  document.body.addEventListener("keydown", ev => ev.stopPropagation());
  document.body.dispatchEvent(new KeyboardEvent("keydown"));
  assertEqual(Object.getOwnPropertyNames(e1).includes("stopPropagation"), true, "patched onto the instance");
  assertEqual(Object.getOwnPropertyNames(Event.prototype).includes("stopPropagation"), true);
`,
	}),
];
