import { basicTest, htmlTest, type Test } from "../../../testcommon.ts";

// JS rewriter review (agent 8). Tests are run with no incumbency override
// (Chrome default = pst on develop), and again with lazystamp / stamp where
// the rewriter output differs. main ignores `incumbencyMode`.

const tests: Test[] = [];

type Mode = "pst" | "stamp" | "lazystamp" | "none" | undefined;
function withMode(t: Test, mode: Mode): Test {
	if (mode) {
		t.name = `${t.name}-${mode}`;
		t.incumbencyMode = mode;
	}
	return t;
}

for (const mode of [undefined, "lazystamp", "stamp"] as Mode[]) {
	// no-semicolon (StandardJS style) code: a postMessage statement after a line
	// that does not end in `;`
	tests.push(
		withMode(
			htmlTest({
				name: "rv8-asi-postmessage-after-let",
				html: `<!DOCTYPE html><body><script>
runTest(async () => {
  const w = { postMessage(m) { return m } }
  let r = 0
  w.postMessage(1)
  r = 1
  assertEqual(r, 1)
  const f = function () { return 2 }
  window.postMessage("hello", "*")
  assertEqual(f(), 2)
  pass()
}, false)
</script></body>`,
			}),
			mode
		)
	);

	// a directive with no semicolon followed by a postMessage statement
	tests.push(
		withMode(
			htmlTest({
				name: "rv8-asi-postmessage-after-directive",
				html: `<!DOCTYPE html><body>
<script>window.__errs=[];addEventListener("error",e=>__errs.push(e.message))</script>
<script>
"use strict"
window.postMessage("x", "*")
window.__strict = (function () { return this === undefined })()
</script>
<script>
runTest(async () => {
  assertDeepEqual(window.__errs, [], "errors: " + window.__errs.join())
  assertEqual(window.__strict, true, "script after directive should have run strict: " + window.__strict)
  pass()
}, false)
</script></body>`,
			}),
			mode
		)
	);

	// iframe-resizer / embed style snippet: postMessage to parent as a statement
	tests.push(
		withMode(
			htmlTest({
				name: "rv8-asi-parent-postmessage",
				html: `<!DOCTYPE html><body>
<script>
var height = document.body.scrollHeight
parent.postMessage({ type: "resize", height }, "*")
window.__ran = true
</script>
<script>
runTest(async () => {
  assertEqual(window.__ran, true, "embed snippet should run")
  pass()
}, false)
</script></body>`,
			}),
			mode
		)
	);

	// semantics of stamped calls
	tests.push(
		withMode(
			basicTest({
				name: "rv8-call-semantics",
				js: `
  const w = { v: 1, postMessage(m) { return [this === w, m] } };
  assertDeepEqual(w.postMessage(1), [true, 1]);
  assertDeepEqual(w["postMessage"](2), [true, 2]);
  assertDeepEqual(w?.postMessage(3), [true, 3]);
  const n = null;
  assertEqual(n?.postMessage(3), undefined);
  assertDeepEqual((w.postMessage)(4), [true, 4]);
  let calls = 0;
  const g = { get p() { calls++; return w; } };
  g.p.postMessage(5);
  assertEqual(calls, 1);
  const ch = new MessageChannel();
  ch.port1.postMessage("x");
  const got = await new Promise(r => { ch.port2.onmessage = e => r(e.data); });
  assertEqual(got, "x");
  class A { m() { return this.x } }
  class B extends A { constructor() { super(); this.x = 4 } m() { return super.m() + 1 } }
  assertEqual(new B().m(), 5);
  const o = { f(...a) { return a.length } };
  assertEqual(o.f(...[1, 2], 3), 3);
  const tag = { t(s) { return this === tag } };
  assertEqual(tag.t\`x\`, true);
  assertEqual((0, o.f)(1), 1);
`,
			}),
			mode
		)
	);
}

// javascript: URLs written by the page and read back
tests.push(
	basicTest({
		name: "rv8-javascript-href-readback",
		js: `
  const a = document.createElement("a");
  a.href = "javascript:void(0)";
  assertEqual(a.getAttribute("href"), "javascript:void(0)", "getAttribute");
  assertEqual(a.href, "javascript:void(0)", "href property");
  a.setAttribute("href", "javascript:alert(1)");
  assertEqual(a.href, "javascript:alert(1)", "href after setAttribute");
`,
	})
);

tests.push(
	htmlTest({
		name: "rv8-javascript-href-inline-readback",
		html: `<!DOCTYPE html><body><a id="l" href="javascript:void(0)">x</a>
<script>
runTest(async () => {
  const a = document.getElementById("l");
  assertEqual(a.getAttribute("href"), "javascript:void(0)", "getAttribute");
  assertEqual(a.href, "javascript:void(0)", "href property");
  pass()
}, false)
</script></body>`,
	})
);

// Function.prototype.toString round trip for functions from each rewrite path
tests.push(
	htmlTest({
		name: "rv8-tostring-roundtrip",
		html: `<!DOCTYPE html><body>
<script>
function inlineFn() { return location.href + top.name }
</script>
<script>
runTest(async () => {
  assertEqual(inlineFn.toString(), "function inlineFn() { return location.href + top.name }", "inline script");
  const e = eval("(function evalFn() { return location.host })");
  assertEqual(e.toString(), "function evalFn() { return location.host }", "eval");
  const F = new Function("a", "return location.href + a");
  assertEqual(F.toString(), "function anonymous(a\\n) {\\nreturn location.href + a\\n}", "Function");
  pass()
}, false)
</script></body>`,
	})
);

for (const mode of [undefined, "lazystamp", "stamp"] as Mode[]) {
	tests.push(
		withMode(
			basicTest({
				name: "rv8-postmessage-receivers",
				js: `
  // bare postMessage in a window: WebIDL sends an undefined this to the global
  const got1 = new Promise(r => addEventListener("message", function h(e) { if (e.data === "bare") { removeEventListener("message", h); r(e.source === window); } }));
  postMessage("bare", "*");
  assertEqual(await got1, true, "bare postMessage");
  const got2 = new Promise(r => addEventListener("message", function h(e) { if (e.data === "self") { removeEventListener("message", h); r(true); } }));
  self.postMessage("self", "*");
  assertEqual(await got2, true, "self.postMessage");
  // dedicated worker: bare and self. postMessage
  const src = "postMessage('w1'); self.postMessage('w2'); onmessage = e => postMessage('echo:' + e.data);";
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  const msgs = [];
  const done = new Promise((r, j) => { w.onmessage = e => { msgs.push(e.data); if (msgs.length === 3) r(); }; w.onerror = e => j(new Error("worker error: " + e.message)); setTimeout(() => j(new Error("timeout " + msgs.join())), 5000); });
  w.postMessage("x");
  await done;
  assertDeepEqual(msgs.sort(), ["echo:x", "w1", "w2"]);
  // BroadcastChannel
  const a = new BroadcastChannel("rv8"), b = new BroadcastChannel("rv8");
  const bc = new Promise(r => { b.onmessage = e => r(e.data); });
  a.postMessage("bc");
  assertEqual(await bc, "bc");
  // iframe contentWindow
  const f = document.createElement("iframe");
  document.body.appendChild(f);
  await new Promise(r => setTimeout(r, 50));
  f.contentWindow.postMessage("to-frame", "*");
  // a postMessage method on a plain object, looked up through a computed key
  const k = "post" + "Message";
  const o = { [k](v) { return this === o && v } };
  assertEqual(o[k](3), 3);
  const bound = window.postMessage.bind(window);
  const got3 = new Promise(r => addEventListener("message", function h(e) { if (e.data === "bound") { removeEventListener("message", h); r(true); } }));
  bound("bound", "*");
  assertEqual(await got3, true, "bound");
`,
			}),
			mode
		)
	);
}

tests.push(
	basicTest({
		name: "rv8-function-ctors-rewritten",
		js: `
  const AsyncFunction = (async function () {}).constructor;
  const GeneratorFunction = (function* () {}).constructor;
  const AsyncGeneratorFunction = (async function* () {}).constructor;
  assertEqual(Function("return location.href")(), location.href, "Function");
  checkglobal(Function("return top")());
  assertEqual(setTimeout.length >= 0, true);
  const r = await new Promise(res => { window.__st = res; setTimeout("window.__st(location.href)", 0); });
  assertEqual(r, location.href, "setTimeout string");
  assertEqual(eval("'use strict'"), "use strict", "directive completion");
  assertEqual(eval(""), undefined, "empty eval");
  assertEqual((0, eval)("var __rv8g = 1; __rv8g"), 1, "indirect eval completion");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-async-generator-function-ctors",
		js: `
  const AsyncFunction = (async function () {}).constructor;
  const GeneratorFunction = (function* () {}).constructor;
  const AsyncGeneratorFunction = (async function* () {}).constructor;
  const r = [typeof AsyncFunction("return 1"), typeof GeneratorFunction("yield 1"), typeof AsyncGeneratorFunction("yield 1")];
  assertDeepEqual(r, ["function", "function", "function"], "constructors return functions: " + r.join());
`,
	})
);

tests.push(
	htmlTest({
		name: "rv8-inline-handler-and-tostring",
		html: `<!DOCTYPE html><body>
<button id="b" onclick="window.__h = (window.__h || 0) + 1; return false">x</button>
<script>
runTest(async () => {
  const b = document.getElementById("b");
  b.click(); b.click();
  assertEqual(window.__h, 2, "inline handler ran twice");
  assertEqual(b.getAttribute("onclick"), "window.__h = (window.__h || 0) + 1; return false", "attr readback");
  const d = document.createElement("div");
  d.setAttribute("onclick", "window.__h2 = location.host");
  document.body.appendChild(d);
  d.click();
  assertEqual(window.__h2, location.host, "setAttribute handler");
  assertConsistent("handler-tostring", d.onclick.toString());
  assertConsistent("inline-handler-tostring", b.onclick.toString());
  pass();
}, false)
</script></body>`,
	})
);

tests.push(
	htmlTest({
		name: "rv8-javascript-url-iframe",
		html: `<!DOCTYPE html><body>
<script>
runTest(async () => {
  const f2 = document.createElement("iframe");
  f2.src = "javascript:'<b>yo</b>'";
  document.body.appendChild(f2);
  await new Promise(r => setTimeout(r, 1000));
  assertEqual(f2.contentDocument && f2.contentDocument.body && f2.contentDocument.body.textContent, "yo", "script-set javascript: iframe");
  pass();
}, false)
</script></body>`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-write",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write("<script>parent.__r = typeof location.href<\\/script>"); f.contentDocument.close();
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-eval",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentWindow.eval("parent.__r = typeof location.href");
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-function",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentWindow.Function("parent.__r = typeof location.href")();
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-script-el",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  const s = f.contentDocument.createElement("script"); s.textContent = "parent.__r = typeof location.href"; f.contentDocument.body.appendChild(s);
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-parent-script-el",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  const s = document.createElement("script"); s.textContent = "parent.__r = typeof location.href"; f.contentDocument.body.appendChild(s);
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-handler",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  const d = f.contentDocument.createElement("div"); d.setAttribute("onclick", "parent.__r = typeof location.href"); f.contentDocument.body.appendChild(d); d.click();
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-innerhtml-handler",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentDocument.body.innerHTML = "<img src=x onerror='parent.__r = typeof location.href'>";
  await new Promise(r => setTimeout(r, 500));
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-srcdoc",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); f.srcdoc = "<script>parent.__r = typeof location.href<\\/script>"; document.body.appendChild(f);
  await new Promise(r => f.onload = r);
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-settimeout",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentWindow.setTimeout("parent.__r = typeof location.href", 0); await new Promise(r => setTimeout(r, 200));
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-xrealm-javascript-href-frame",
		js: `
  window.__r = undefined;
  const errs = [];
  const f = document.createElement("iframe"); document.body.appendChild(f);
  f.contentWindow.location.href = "javascript:parent.__r = typeof location.href; void 0"; await new Promise(r => setTimeout(r, 500));
  await new Promise(r => setTimeout(r, 300));
  assertEqual(window.__r, "string", "code ran in the other realm");
`,
	})
);

tests.push(
	basicTest({
		name: "rv8-perf-eval-loop",
		js: `
  let t = performance.now();
  for (let i = 0; i < 3000; i++) eval("var q" + (i % 50) + " = " + i + "; (function f(){ return location.host })");
  const evalMs = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 3000; i++) new Function("a", "return a + " + i);
  const fnMs = performance.now() - t;
  const d = document.createElement("div");
  d.setAttribute("onclick", "window.__n = (window.__n||0) + 1");
  t = performance.now();
  for (let i = 0; i < 3000; i++) d.click();
  const clickMs = performance.now() - t;
  const big = "var x = [" + Array.from({length: 20000}, (_, i) => "{a:" + i + ", f(){ return location.href }}").join(",") + "]; 1";
  t = performance.now();
  eval(big);
  const bigMs = performance.now() - t;
  console.log("RV8PERF", JSON.stringify({ evalMs, fnMs, clickMs, bigMs }));
  fail("RV8PERF " + JSON.stringify({ evalMs: Math.round(evalMs), fnMs: Math.round(fnMs), clickMs: Math.round(clickMs), bigMs: Math.round(bigMs) }));
`,
	})
);

tests.push(
	htmlTest({
		name: "rv8-asi-location-assign",
		html: `<!DOCTYPE html><body>
<script>
window.__errs = []; addEventListener("error", e => __errs.push(e.message))
</script>
<script>
function go(u) { return u }
const target = "#rv8"
go(target)
location = target
window.__after = true
</script>
<script>
runTest(async () => {
  assertDeepEqual(window.__errs, [], "errors: " + window.__errs.join())
  assertEqual(window.__after, true)
  pass()
}, false)
</script></body>`,
	})
);

export default tests;
