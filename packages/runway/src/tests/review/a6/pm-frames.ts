import { multiFrameTest, type Test } from "../../../testcommon.ts";

type Mode = "pst" | "stamp" | "lazystamp" | undefined;
const modes: Mode[] = [undefined, "lazystamp", "stamp"];
const tests: Test[] = [];

// child -> parent: parent checks origin/source/data. child posts `send` js expression
// that must deliver {o: location.origin, k: <key>} to parent.
const childToParent: Record<string, string> = {
	star: `parent.postMessage(msg, "*")`,
	explicit: `parent.postMessage(msg, PARENT)`,
	options: `parent.postMessage(msg, { targetOrigin: PARENT })`,
	call: `parent.postMessage.call(parent, msg, "*")`,
	apply: `parent.postMessage.apply(parent, [msg, "*"])`,
	reflect: `Reflect.apply(parent.postMessage, parent, [msg, "*"])`,
	bound: `parent.postMessage.bind(parent)(msg, "*")`,
	boundTimeout: `setTimeout(parent.postMessage.bind(parent, msg, "*"), 0)`,
	alias: `const pm = parent.postMessage; pm.call(parent, msg, "*")`,
	computed: `const k = ["post", "Message"].join(""); parent[k](msg, "*")`,
	forEach: `[parent].forEach(w => w.postMessage(msg, "*"))`,
	promise: `Promise.resolve().then(() => parent.postMessage(msg, "*"))`,
	evalStr: `eval('parent.postMessage(msg, "*")')`,
	newFunction: `new Function("m", 'parent.postMessage(m, "*")')(msg)`,
	setTimeoutStr: `window.__msg = msg; setTimeout('parent.postMessage(window.__msg, "*")', 0)`,
	attrHandler: `window.__msg = msg; const b = document.createElement("button"); b.setAttribute("onclick", 'parent.postMessage(window.__msg, "*")'); document.body.appendChild(b); b.click()`,
	jsUrl: `window.__msg = msg; const a = document.createElement("a"); a.href = 'javascript:void parent.postMessage(window.__msg, "*")'; document.body.appendChild(a); a.click()`,
	top: `top.postMessage(msg, "*")`,
	opener_style_source: `window.parent.window.postMessage(msg, "*")`,
	stringMsg: `parent.postMessage(JSON.stringify(msg), "*")`,
	withPort: `const mc = new MessageChannel(); parent.postMessage(msg, "*", [mc.port1])`,
	afterReceive: `parent.postMessage("junk-first", "*"); addEventListener("message", () => {}); parent.postMessage(msg, "*")`,
	patched: `const orig = parent.postMessage; const w = parent; w.postMessage = function (...a) { return orig.apply(this, a); }; w.postMessage(msg, "*")`,
};

for (const mode of modes) {
	for (const [key, send] of Object.entries(childToParent)) {
		const test = multiFrameTest({
			name: `rv6-pmf-c2p-${mode ?? "default"}-${key}`,
			root: {
				js: () => `
					addEventListener("message", (e) => {
						let d = e.data;
						if (d === "junk-first") return;
						if (typeof d === "string") d = JSON.parse(d);
						try {
							assertEqual(e.origin, d.o, "origin of child");
							assert(e.source === frames[0], "source is child window");
							assertEqual(d.k, "${key}");
							pass();
						} catch (x) { fail(x.message); }
					});
					window.__childOrigin = null;
				`,
				subframes: [
					{
						originid: "cross",
						id: "child",
						js: () => `
							setTimeout(() => {
								const PARENT = document.referrer ? new URL(document.referrer).origin : "*";
								const msg = { o: location.origin, k: "${key}" };
								${send};
							}, 300);
						`,
					},
				],
			},
		});
		(test as any).incumbencyMode = mode;
		test.timeoutMs = 8000;
		tests.push(test);
	}
}

// parent -> child: child checks origin + source, replies via e.source to e.origin
const parentToChild: Record<string, string> = {
	star: `frames[0].postMessage(msg, "*")`,
	contentWindow: `document.querySelector("iframe").contentWindow.postMessage(msg, "*")`,
	reflect: `Reflect.apply(frames[0].postMessage, frames[0], [msg, "*"])`,
	bound: `frames[0].postMessage.bind(frames[0])(msg, "*")`,
	computed: `frames[0][["post","Message"].join("")](msg, "*")`,
};
for (const mode of modes) {
	for (const [key, send] of Object.entries(parentToChild)) {
		const test = multiFrameTest({
			name: `rv6-pmf-p2c-${mode ?? "default"}-${key}`,
			root: {
				js: () => `
					addEventListener("message", (e) => {
						try {
							assertEqual(e.data, "reply-${key}");
							assert(e.source === frames[0], "reply source");
							pass();
						} catch (x) { fail(x.message); }
					});
					window.onload = () => setTimeout(() => { const msg = { o: location.origin, k: "${key}" }; ${send}; }, 200);
				`,
				subframes: [
					{
						originid: "cross",
						id: "child",
						js: () => `
							addEventListener("message", (e) => {
								if (e.data.o !== e.origin) { parent.postMessage("bad origin " + e.origin + " vs " + e.data.o, "*"); return; }
								if (e.source !== parent) { parent.postMessage("bad source", "*"); return; }
								e.source.postMessage("reply-" + e.data.k, e.origin);
							});
						`,
					},
				],
			},
		});
		(test as any).incumbencyMode = mode;
		test.timeoutMs = 8000;
		tests.push(test);
	}
}

export default tests;
