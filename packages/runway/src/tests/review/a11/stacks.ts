import { probeTest } from "./lib.ts";

// normalise URLs + positions so only the *shape* of each stack is compared
const norm = `const N = (s) => String(s).replace(/https?:\\/\\/[^\\s)]*/g, 'URL').replace(/:\\d+:\\d+/g, ':L:C').replace(/<anonymous>:\\d+:\\d+/g,'<anon>:L:C');`;

export default [
	probeTest({
		name: "rv11-stack-shapes",
		probes: {
			sync: `${norm} function a(){ return new Error('m1'); } function b(){ return a(); } return N(b().stack);`,
			typeerr: `${norm} try { null.x } catch (e) { return N(e.stack); }`,
			async_chain: `${norm} async function a1(){ await null; throw new Error('as'); } async function a2(){ await a1(); } try { await a2(); } catch(e) { return N(e.stack); }`,
			promise_all: `${norm} async function t(){ await null; throw new Error('pa'); } try { await Promise.all([t()]); } catch(e) { return N(e.stack); }`,
			eval_: `${norm} try { eval('function ev(){ throw new Error("ev") } ev()'); } catch(e) { return N(e.stack); }`,
			newfn: `${norm} try { new Function('throw new Error("nf")')(); } catch(e) { return N(e.stack); }`,
			klass: `${norm} class K { constructor(){ this.e = new Error('k'); } get g(){ return new Error('g'); } static s(){ return new Error('s'); } } return [N(new K().e.stack), N(new K().g.stack), N(K.s().stack)];`,
			timeout: `${norm} return await new Promise(r => setTimeout(function tcb(){ r(N(new Error('to').stack)); }, 0));`,
			listener: `${norm} return await new Promise(r => { const t = new EventTarget(); t.addEventListener('x', function lcb(){ r(N(new Error('li').stack)); }); t.dispatchEvent(new Event('x')); });`,
			array_map: `${norm} return N([1].map(function mcb(){ return new Error('mp'); })[0].stack);`,
			capture: `${norm} const o = {}; Error.captureStackTrace(o); return N(o.stack);`,
			capture_named: `${norm} class HttpErr extends Error { constructor(m){ super(m); this.name='HttpErr'; Error.captureStackTrace(this, HttpErr); } } return N(new HttpErr('he').stack);`,
			custom_name: `${norm} const e = new Error('cn'); e.name = 'Custom'; return N(e.stack);`,
			msg_after: `${norm} const e = new Error('before'); e.message = 'after'; return N(e.stack);`,
			no_msg: `${norm} return N(new TypeError().stack);`,
			domexc: `${norm} try { document.querySelector('###'); } catch(e) { return N(e.stack); }`,
			domexc_new: `${norm} return N(new DOMException('dm', 'AbortError').stack);`,
			multiline: `${norm} return N(new Error('l1\\nl2').stack);`,
			limit0: `const old = Error.stackTraceLimit; Error.stackTraceLimit = 0; const s = new Error('z').stack; Error.stackTraceLimit = old; return s;`,
			limit1: `${norm} const old = Error.stackTraceLimit; Error.stackTraceLimit = 1; const s = new Error('z').stack; Error.stackTraceLimit = old; return N(s);`,
			overflow: `function f(){ f(); } try { f(); } catch(e) { return [e instanceof RangeError, typeof e.stack, String(e.stack).split('\\n').length, String(e.stack).split('\\n')[0]]; }`,
			cause: `${norm} return N(new Error('c', {cause: new Error('inner')}).stack);`,
			agg: `${norm} return N(new AggregateError([new Error('x')], 'agg').stack);`,
			obj_throwing_name: `const e = new Error('x'); Object.defineProperty(e, 'name', {get(){ throw new Error('boom') }}); try { return String(e.stack).split('\\n')[0]; } catch (x) { return 'THROW ' + x.message; }`,
			stack_setter: `const e = new Error('x'); e.stack = 'custom'; return e.stack;`,
			stack_desc: `const e = new Error('x'); const d = Object.getOwnPropertyDescriptor(e, 'stack'); return d ? Object.keys(d).sort().join(',') + ' ' + typeof d.get + typeof d.value : 'none';`,
			bound: `${norm} function bf(){ return new Error('bf'); } return N(bf.bind(null)().stack);`,
			proxy_trap: `${norm} const p = new Proxy({}, { get(){ return new Error('pt'); } }); return N(p.x.stack);`,
			generator: `${norm} function* gen(){ yield new Error('gn'); } return N(gen().next().value.stack);`,
		},
	}),
];
