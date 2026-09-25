import { probeTest } from "./harness.ts";

// Vue 3's autoPrefix skips the unprefixed name for `filter` and writes
// `style.WebkitFilter`, a name develop's wrapper does not treat as CSS.
const probes: Record<string, string> = {
	in_style: `const d=mk(); return ['WebkitFilter' in d.style, 'webkitFilter' in d.style, Object.getOwnPropertyNames(d.style).includes('WebkitFilter'), Object.getOwnPropertyNames(d.style).includes('webkitFilter')];`,
	vue3_filter: `const Vue=(await import('https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js'));
const h=mk(); h.style.cssText='';
const w=Vue.ref(10), f=Vue.ref('blur(1px)');
const app=Vue.createApp({ setup(){ return ()=>Vue.h('div',{id:'vf', style:{width:w.value+'px', height:'4px', filter:f.value}}) } });
app.mount(h);
const d=document.getElementById('vf');
const out=[d.getAttribute('style'), h.innerHTML, getComputedStyle(d).filter];
f.value='grayscale(1)'; await Vue.nextTick(); out.push(d.getAttribute('style'));
f.value='url(/img/'+R+'-vuefilter.svg#x)'; await Vue.nextTick(); out.push(d.style.filter, getComputedStyle(d).filter.includes('/~/sj/'));
return out;`,
};

export default [
	probeTest("rv18-vue-style", probes, {
		timeout: 20000,
		settle: 500,
	}),
];
