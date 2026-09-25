import { basicTest, type Test } from "../../../testcommon.ts";
const t = (name: string, js: string) =>
	basicTest({
		name: "rv6-ev3-" + name,
		js,
	});
export default [
	t(
		"default-passive-wheel",
		`
		const f = (e) => e.preventDefault();
		addEventListener("wheel", f);
		const ev = new WheelEvent("wheel", { cancelable: true });
		dispatchEvent(ev);
		removeEventListener("wheel", f);
		assertEqual(ev.defaultPrevented, false, "window wheel listeners default to passive");
		addEventListener("wheel", f, { passive: false });
		const ev2 = new WheelEvent("wheel", { cancelable: true });
		dispatchEvent(ev2);
		removeEventListener("wheel", f);
		assertEqual(ev2.defaultPrevented, true);
		document.addEventListener("touchstart", f, {});
		const ev3 = new Event("touchstart", { cancelable: true });
		document.dispatchEvent(ev3);
		document.removeEventListener("touchstart", f);
		assertEqual(ev3.defaultPrevented, false, "document touchstart default passive with {} options");
	`
	),
	t(
		"cross-realm-signal",
		`
		const fr = document.createElement("iframe"); document.body.appendChild(fr);
		const ac = new fr.contentWindow.AbortController();
		let n = 0;
		addEventListener("rv6s", () => n++, { signal: ac.signal });
		dispatchEvent(new Event("rv6s"));
		ac.abort();
		dispatchEvent(new Event("rv6s"));
		assertEqual(n, 1);
		let threw = false;
		try { addEventListener("rv6s", () => {}, { signal: { aborted: false, addEventListener() {} } }); } catch (e) { threw = e instanceof TypeError; }
		assert(threw, "fake signal rejected like native");
		const ac2 = new AbortController(); ac2.abort();
		let m = 0;
		addEventListener("rv6s", () => m++, { signal: ac2.signal });
		dispatchEvent(new Event("rv6s"));
		assertEqual(m, 0, "already-aborted signal");
	`
	),
	t(
		"options-undefined-members",
		`
		let n = 0;
		addEventListener("rv6u", () => n++, { capture: undefined, once: undefined, passive: undefined, signal: undefined });
		dispatchEvent(new Event("rv6u"));
		assertEqual(n, 1);
	`
	),
	t(
		"bare-postmessage-strict",
		`
		"use strict";
		const p = new Promise((res) => addEventListener("message", (e) => res([e.data, e.origin, e.source === window]), { once: true }));
		const { postMessage: pm } = window;
		pm("bare", "*");
		const r = await p;
		assertEqual(r.join(","), "bare," + location.origin + ",true");
		const p2 = new Promise((res) => addEventListener("message", (e) => res(e.data), { once: true }));
		(0, window.postMessage)("bare2", "*");
		assertEqual(await p2, "bare2");
		let threw;
		try { window.postMessage.call({}, "x", "*"); } catch (e) { threw = e instanceof TypeError; }
		assert(threw, "bad receiver TypeError");
		let threw2;
		try { window.postMessage(); } catch (e) { threw2 = e instanceof TypeError; }
		assert(threw2, "arity TypeError");
	`
	),
	t(
		"window-event-replaceable",
		`
		"use strict";
		const d = Object.getOwnPropertyDescriptor(window, "event");
		assertEqual(typeof d.get + typeof d.set, "functionfunction", "accessor with setter");
		window.event = 5;
		assertEqual(window.event, 5, "[Replaceable] write sticks");
	`
	),
] as Test[];
