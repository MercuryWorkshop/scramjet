import { basicTest, type Test } from "../../../testcommon.ts";

const t = (name: string, js: string, mode?: string) => {
	const x = basicTest({
		name: "rv6-pb-" + name + (mode ? "-" + mode : ""),
		js,
	});
	(x as any).incumbencyMode = mode;
	x.timeoutMs = 60000;
	return x;
};
const tests: Test[] = [];
for (const mode of [undefined, "lazystamp"]) {
	tests.push(
		t(
			"perf",
			`
		const time = (label, n, fn) => { const s = performance.now(); fn(n); const d = performance.now() - s; console.log("RV6PERF " + label + " " + d.toFixed(1) + "ms"); return d; };
		const out = {};
		out.bind = time("bind-200k", 200000, (n) => { function f(a){return a;} let g; for (let i = 0; i < n; i++) g = f.bind(null, i); });
		out.addremove = time("add-remove-50k", 50000, (n) => { const el = document.createElement("div"); for (let i = 0; i < n; i++) { const f = () => {}; el.addEventListener("click", f, { passive: true }); el.removeEventListener("click", f); } });
		out.addremoveSame = time("add-remove-same-50k", 50000, (n) => { const el = document.createElement("div"); const f = () => {}; for (let i = 0; i < n; i++) { el.addEventListener("mousemove", f); el.removeEventListener("mousemove", f); } });
		out.dispatch = time("dispatch-100k", 100000, (n) => { const el = document.createElement("div"); let c = 0; el.addEventListener("mousemove", () => c++); for (let i = 0; i < n; i++) el.dispatchEvent(new Event("mousemove")); });
		out.pm = time("postMessage-5k", 5000, (n) => { for (let i = 0; i < n; i++) window.postMessage({ i }, "*"); });
		out.pmStr = time("postMessage-str-5k", 5000, (n) => { for (let i = 0; i < n; i++) window.postMessage("x" + i, "*"); });
		await new Promise(r => setTimeout(r, 50));
		out.call = time("fncall-1M", 1000000, (n) => { const o = { m(a) { return a + 1; } }; let s = 0; for (let i = 0; i < n; i++) s = o.m(s); });
		out.newError = time("error-stack-20k", 20000, (n) => { for (let i = 0; i < n; i++) new Error("x").stack; });
		document.title = JSON.stringify(out);
		throw new Error("RV6PERF " + JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,Math.round(v)]))));
	`,
			mode
		)
	);
}
tests.push(
	t(
		"bind-correct",
		`
	function F(a, b) { this.a = a; this.b = b; }
	F.prototype.z = 1;
	const B = F.bind(null, 1);
	assertEqual(B.name, "bound F", "name");
	assertEqual(B.length, 1, "length");
	const o = new B(2);
	assert(o instanceof F, "instanceof F");
	assert(o instanceof B, "instanceof B");
	assertEqual(o.a + o.b, 3);
	assertEqual(Function.prototype.bind.name, "bind");
	assertEqual(Function.prototype.bind.length, 1);
	assertEqual(Function.prototype.toString.call(Function.prototype.bind), "function bind() { [native code] }");
	assertEqual(Function.prototype.toString.call(B), "function () { [native code] }");
	class C { constructor(x) { this.x = x; } }
	const BC = C.bind(null, 5);
	assertEqual(new BC().x, 5);
	let threw; try { Function.prototype.bind.call({}); } catch (e) { threw = e instanceof TypeError; }
	assert(threw, "bind non-callable TypeError");
	const p = new Proxy(function () { return this; }, {});
	assertEqual(p.bind(7)().valueOf(), 7);
	const pm = window.postMessage.bind(window);
	assertEqual(typeof pm, "function");
	assertEqual(pm.name, "bound postMessage", "pm name");
	assertEqual(pm.length, 1, "pm length " + pm.length);
	assertEqual(Function.prototype.toString.call(pm), "function () { [native code] }", "pm toString");
	const add = document.addEventListener.bind(document);
	add("x", () => {});
	const q = queueMicrotask.bind(window);
	await new Promise(r => q(r));
	const qs = document.querySelector.bind(document);
	assertEqual(qs("body"), document.body);
	assertEqual(Object.getPrototypeOf(pm), Function.prototype);
	assert(!Object.prototype.hasOwnProperty.call(pm, "prototype"), "bound has no prototype");
`
	)
);
tests.push(
	t(
		"stacklimit-accessor",
		`
	let reads = 0, writes = 0;
	let v = 10;
	Object.defineProperty(Error, "stackTraceLimit", { get() { reads++; return v; }, set(x) { writes++; v = x; }, configurable: true });
	const ms = new Promise(r => addEventListener("message", r, { once: true }));
	const pm = window.postMessage; pm.call(window, "x", "*");
	window.postMessage("y", "*");
	await ms;
	assertEqual(reads + ":" + writes, "0:0", "page accessor untouched");
`
	)
);
tests.push(
	t(
		"prepare-stack-trace-page",
		`
	let calls = 0;
	Error.prepareStackTrace = (e, frames) => { calls++; return "custom"; };
	const ms = new Promise(r => addEventListener("message", r, { once: true }));
	window.postMessage("y", "*");
	await ms;
	assertEqual(calls, 0, "page prepareStackTrace invoked by postMessage");
	delete Error.prepareStackTrace;
`
	)
);
tests.push(
	t(
		"frozen-error",
		`
	Object.freeze(Error);
	const ms = new Promise(r => addEventListener("message", (e) => r(e.origin), { once: true }));
	window.postMessage("y", "*");
	assertEqual(await ms, location.origin);
`
	)
);
tests.push(
	t(
		"stacklimit-zero",
		`
	Error.stackTraceLimit = 0;
	const ms = new Promise(r => addEventListener("message", (e) => r([e.origin, e.source === window]), { once: true }));
	window.postMessage("y", "*");
	const r = await ms;
	assertEqual(r[0], location.origin); assert(r[1]);
	assertEqual(Error.stackTraceLimit, 0);
	Error.stackTraceLimit = 10;
`
	)
);
export default tests;
