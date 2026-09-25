import { probeTest } from "./lib.ts";

export default [
	probeTest({
		name: "rv11-global-surface",
		probes: {
			enumerable_extra: `const f = document.createElement('iframe'); document.body.appendChild(f); const base = new Set(Object.keys(f.contentWindow)); return Object.keys(window).filter(k => !base.has(k) && !['runTest','assert','assertEqual','assertDeepEqual','ok','pass','fail','assertConsistent','checkglobal'].includes(k));`,
			own_extra: `const f = document.createElement('iframe'); document.body.appendChild(f); const base = new Set(Object.getOwnPropertyNames(f.contentWindow)); return Object.getOwnPropertyNames(window).filter(k => !base.has(k) && !/^(runTest|assert|assertEqual|assertDeepEqual|ok|pass|fail|assertConsistent|checkglobal)$/.test(k));`,
			scramjet_named: `return Object.getOwnPropertyNames(window).filter(k => /scram|\\$sj|__sj|^\\$[a-z]/i.test(k));`,
			symbols: `return Object.getOwnPropertySymbols(window).map(String);`,
			doc_symbols: `return Object.getOwnPropertySymbols(document).map(String).concat(Object.getOwnPropertyNames(document));`,
			el_own: `const d = document.createElement('div'); d.innerHTML = '<a href="/x">x</a>'; const a = d.firstChild; a.getAttribute('href'); return Object.getOwnPropertyNames(a).concat(Object.getOwnPropertySymbols(a).map(String));`,
			proto_own_extra: `const f = document.createElement('iframe'); document.body.appendChild(f); const W = f.contentWindow; const diffs = []; for (const n of ['Element','Node','Document','HTMLElement','Window','EventTarget','Function','Object','Array','String','Promise','Error','Event','MessageEvent','History','Location','Navigator']) { const a = window[n] && window[n].prototype, b = W[n] && W[n].prototype; if (!a || !b) continue; const bn = new Set(Reflect.ownKeys(b).map(String)); for (const k of Reflect.ownKeys(a).map(String)) if (!bn.has(k)) diffs.push(n + '.' + k); } return diffs;`,
		},
	}),
];
