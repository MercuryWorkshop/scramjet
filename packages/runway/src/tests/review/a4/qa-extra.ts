import { basicTest } from "../../../testcommon.ts";

// QA for report item 1: packages/inject/src/context.ts calls loadScramjet()
// (which ends in client.hook()) BEFORE setupHistoryEmulation/setupWindowOpen/
// setupAlwaysLastBubble. Mirror that real order: hook first, emulators after.
export default [
	basicTest({
		name: "rv4qa-inject-real-order-hook-then-emulators",
		scramjetOnly: true,
		js: `
  const SJ = Symbol.for("scramjet client global");
  const parentClient = window[SJ];
  const f = document.createElement("iframe");
  document.body.appendChild(f);
  const w = window[0];
  const already = SJ in w;
  const seen = [];
  if (!already) {
    const c = new parentClient.constructor(w, parentClient.init);
    c.hook();
    c.Proxy("History.prototype.pushState", { apply(ctx) { seen.push("emu-pushState"); } });
    c.Proxy("window.open", { apply(ctx) { seen.push("emu-open"); ctx.return(null); } });
    c.Proxy("EventTarget.prototype.addEventListener", { apply(ctx) { seen.push("emu-ael"); } });
  }
  let pushedUrl = null;
  try { w.history.pushState(null, "", "/rv4qa"); } catch (e) { pushedUrl = /URL '([^']+)'/.exec(e.message)?.[1]; }
  w.open("about:blank", "_blank");
  w.addEventListener("click", () => {});
  const data = await new Promise(r => { w.addEventListener("message", e => r(e.data)); w.postMessage("hello", "*"); setTimeout(() => r("timeout"), 1000); });
  const r = { already, seen: seen.join(), pushStateRewritten: !!pushedUrl && pushedUrl.includes("/~/sj/"), messageData: String(data).slice(0, 60) };
  assert(!already, "frame was already hooked: " + JSON.stringify(r));
  assertEqual(r.seen.includes("emu-pushState") && r.seen.includes("emu-open") && r.seen.includes("emu-ael"), true, "embedder emulators installed after hook() run: " + JSON.stringify(r));
  assertEqual(r.messageData, "hello", "core message interceptor intact: " + JSON.stringify(r));
`,
	}),
];
