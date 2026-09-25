import { basicTest } from "../../../testcommon.ts";
import { probeTest } from "./lib.ts";

export default [
	probeTest({
		name: "rv11-bind-fidelity",
		probes: {
			name_len: `function foo(a, b, c) {} const b = foo.bind(null, 1); return [b.name, b.length, 'prototype' in b, typeof b.prototype];`,
			bound_bound: `function foo(a, b, c) {} const b = foo.bind(null, 1).bind(null, 2); return [b.name, b.length];`,
			new_bound_class: `class K { constructor(a, b) { this.a = a; this.b = b; } } const B = K.bind(null, 1); const o = new B(2); return [o instanceof K, o instanceof B, o.a, o.b, Object.getPrototypeOf(o) === K.prototype];`,
			new_bound_fn: `function F(a) { this.a = a; } const B = F.bind({ignored: 1}, 5); const o = new B(); return [o.a, o instanceof F, o instanceof B];`,
			reflect_construct: `class K {} class S extends K {} const B = K.bind(null); const o = Reflect.construct(B, [], S); return [Object.getPrototypeOf(o) === S.prototype];`,
			this_binding: `const o = { v: 7, f() { return this.v; } }; const b = o.f.bind({ v: 9 }); return [b(), b.call({ v: 3 }), b.apply({ v: 4 })];`,
			args: `function f(...a) { return a; } return f.bind(null, 1, 2)(3, 4);`,
			noncallable: `try { Function.prototype.bind.call({}); return 'no throw'; } catch (e) { return [e.constructor.name, e.message]; }`,
			native_bind: `const b = document.querySelector.bind(document); return b('body') === document.body;`,
			native_bind_ctor: `try { const B = Map.bind(null); const m = new B([[1, 2]]); return [m.get(1), m instanceof Map]; } catch (e) { return 'THROW ' + e; }`,
			proxy_bind: `const p = new Proxy(function () { return 42; }, {}); return p.bind(null)();`,
			arrow_bind: `const a = () => this; return typeof a.bind({x: 1})();`,
			getter_name: `const b = Object.getOwnPropertyDescriptor(Function.prototype, 'bind'); return [typeof b.value, b.writable, b.enumerable, b.configurable, Function.prototype.bind.name, Function.prototype.bind.length, String(Function.prototype.bind)];`,
			bind_own_name: `function foo() {} Object.defineProperty(foo, 'name', { value: 42 }); const b = foo.bind(null); return [b.name];`,
			bind_len_override: `function foo(a,b) {} Object.defineProperty(foo, 'length', { value: 10 }); return [foo.bind(null, 1).length];`,
			async_bound: `async function af(x) { return x * 2; } return await af.bind(null, 21)();`,
			gen_bound: `function* g(x) { yield x; } return g.bind(null, 3)().next().value;`,
			class_call_throws: `class K {} try { K.bind(null)(); return 'no throw'; } catch (e) { return e.constructor.name; }`,
			hasInstance: `function F() {} const B = F.bind(null); return [new F() instanceof B, Function.prototype[Symbol.hasInstance].call(B, new F())];`,
			postMessage_bound: `return await new Promise(r => { addEventListener('message', function h(e) { if (e.data !== 'bpm') return; removeEventListener('message', h); r([e.data, e.source === window, e.origin === location.origin]); }); const pm = window.postMessage.bind(window); pm('bpm', '*'); setTimeout(() => r('TIMEOUT'), 1500); });`,
			settimeout_bound: `return await new Promise(r => { const st = setTimeout.bind(window); st(() => r('ok'), 0); setTimeout(() => r('TIMEOUT'), 1500); });`,
			fetch_bound: `const f = fetch.bind(window); const r = await f('echo/b'); return [r.status, await r.text()];`,
			fetch_bound_null: `const f = fetch.bind(null); const r = await f('echo/b2'); return [r.status, await r.text()];`,
			fetch_bound_obj: `try { const f = fetch.bind({}); const r = await f('echo/b3'); return [r.status]; } catch (e) { return 'THROW ' + e.name; }`,
		},
	}),
];
