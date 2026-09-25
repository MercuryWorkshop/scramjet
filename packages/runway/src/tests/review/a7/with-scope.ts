import { basicTest } from "../../../testcommon.ts";

// Vue's runtime template compiler: `new Function("with(_ctx){ return ... }")`
// with _ctx a Proxy whose `has` claims every key not starting with "_"
// (RuntimeCompiledPublicInstanceProxyHandlers). Rewriter helpers injected into
// such code resolve against _ctx instead of the global.
const P: Record<string, string> = {
	vue_like_prop: `const ctx=new Proxy({item:{location:'L', top:'T', name:'n'}, k:'location'}, {has:(t,key)=> typeof key==='string' && key[0] !== '_' && !['Math','JSON','String','Array','Object','undefined','Number','Date'].includes(key), get:(t,key)=> t[key]}); const f=new Function('_ctx', 'with(_ctx){ return [item.name, item[k], item.location, item.top] }'); try { return f(ctx); } catch(e){ return 'THROW '+e.message; }`,
	vue_like_computed: `const ctx=new Proxy({item:{a:1}, k:'a'}, {has:(t,key)=> typeof key==='string' && key[0] !== '_', get:(t,key)=> t[key]}); const f=new Function('_ctx', 'with(_ctx){ return item[k] }'); try { return f(ctx); } catch(e){ return 'THROW '+e.message; }`,
	vue_like_call: `const ctx=new Proxy({o:{f(){ return 5; }}, k:'f'}, {has:(t,key)=> typeof key==='string' && key[0] !== '_', get:(t,key)=> t[key]}); const f=new Function('_ctx', 'with(_ctx){ return o[k]() }'); try { return f(ctx); } catch(e){ return 'THROW '+e.message; }`,
	vue_like_location: `const ctx=new Proxy({}, {has:(t,key)=> typeof key==='string' && key[0] !== '_' && key!=='location' && key!=='window', get:(t,key)=> t[key]}); const f=new Function('_ctx', 'with(_ctx){ return location.pathname }'); try { return f(ctx); } catch(e){ return 'THROW '+e.message; }`,
	vue_like_eval_str: `const ctx=new Proxy({s:'1+1'}, {has:(t,key)=> typeof key==='string' && key[0] !== '_' && key!=='eval', get:(t,key)=> t[key]}); const f=new Function('_ctx', 'with(_ctx){ return eval(s) }'); try { return f(ctx); } catch(e){ return 'THROW '+e.message; }`,
	with_plain_obj: `const o={item:{x:1}, k:'x'}; const f=new Function('o','with(o){ return item[k] }'); return f(o);`,
	with_inline_script: `window.__ws=null; const s=document.createElement('script'); s.textContent='with({item:{x:2},k:"x", $scramjet$prop:undefined, $scramjet$wrap: undefined}){ window.__ws=item[k]; }'; try { document.body.appendChild(s); } catch(e){} return window.__ws;`,
};

export default [
	basicTest({
		name: "rv7-with-scope",
		autoPass: false,
		js: `
		const probes = {${Object.entries(P)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'};
		for (const [k, v] of Object.entries(probes)) {
			try { out[k] = JSON.stringify(await v()); } catch (e) { out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message); }
		}
		console.log('RV7PROBE ' + JSON.stringify(out));
		fail('RV7PROBE ' + JSON.stringify(out));
		`,
	}),
];
