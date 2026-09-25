import { probeTest } from "./lib.ts";

const tpl = `<div class="item"><a href="/item/<%= id %>"><img src="<%= img %>"></a> <% if (x < 3 && y > 1) { %>ok<% } %></div>`;
const hbs = `<a href="{{url}}" onclick="go({{id}})">{{name}}</a><style>.x{background:url({{bg}})}</style>`;
const json = `{"a":"</div>","u":"/api/x","h":"<img src=/y.png>"}`;
const ld = `{"@context":"https://schema.org","@type":"Organization","url":"https://example.com","logo":"/logo.png"}`;
const tmplEl = `<div x-data><a href="/t/1" @click="f()">t</a><img src="/t.png"><template x-if="a"><span :class="c">in</span></template></div>`;
const head = `<script type="text/template" id="t1">${tpl}</script><script type="text/x-handlebars-template" id="t2">${hbs}</script><script type="application/json" id="j1">${json}</script><script type="application/ld+json" id="ld">${ld}</script><template id="te">${tmplEl}</template><script type="text/html" id="kh"><li data-bind="text: name, attr:{href: url}"><img data-bind="attr:{src: pic}"></li></script>`;
const S = (s: string) => JSON.stringify(s);
const probes: Record<string, string> = {
	t1_innerHTML: `const e=document.getElementById('t1'); return e.innerHTML===${S(tpl)} ? 'SAME' : e.innerHTML;`,
	t1_textContent: `const e=document.getElementById('t1'); return e.textContent===${S(tpl)} ? 'SAME' : e.textContent;`,
	t1_text: `const e=document.getElementById('t1'); return e.text===${S(tpl)} ? 'SAME' : e.text;`,
	t2_innerHTML: `const e=document.getElementById('t2'); return e.innerHTML===${S(hbs)} ? 'SAME' : e.innerHTML;`,
	j1_textContent: `const e=document.getElementById('j1'); return e.textContent===${S(json)} ? 'SAME' : e.textContent;`,
	j1_parse: `return JSON.parse(document.getElementById('j1').textContent).u;`,
	ld_text: `const e=document.getElementById('ld'); return e.textContent===${S(ld)} ? 'SAME' : e.textContent;`,
	kh_innerHTML: `const e=document.getElementById('kh'); return e.innerHTML;`,
	te_innerHTML: `const e=document.getElementById('te'); return e.innerHTML===${S(tmplEl)} ? 'SAME' : e.innerHTML;`,
	te_content_clone: `const e=document.getElementById('te'); const c=e.content.cloneNode(true); const d=document.createElement('div'); d.appendChild(c); return [d.querySelector('a').getAttribute('href'), d.querySelector('img').getAttribute('src'), d.querySelector('a').getAttribute('@click'), d.innerHTML===${S(tmplEl)}];`,
	te_nested_template: `const e=document.getElementById('te'); const inner=e.content.querySelector('template'); return inner ? inner.innerHTML : 'none';`,
	dyn_tpl_script: `const s=document.createElement('script'); s.type='text/template'; s.innerHTML=${S(tpl)}; document.body.appendChild(s); return [s.innerHTML===${S(tpl)}, s.textContent===${S(tpl)}];`,
	dyn_json_script: `const s=document.createElement('script'); s.type='application/json'; s.textContent=${S(json)}; document.body.appendChild(s); return [s.textContent===${S(json)}, s.innerHTML];`,
	dyn_template_innerHTML: `const t=document.createElement('template'); t.innerHTML=${S(tmplEl)}; return [t.innerHTML===${S(tmplEl)} ? 'SAME' : t.innerHTML, t.content.querySelector('img').getAttribute('src')];`,
	dyn_template_img_load: `const t=document.createElement('template'); t.innerHTML='<img src="/tl.png">'; const img=document.importNode(t.content, true).firstChild; const p=new Promise(r=>{img.onload=()=>r('load');img.onerror=()=>r('error');}); document.body.appendChild(img); return [await p, img.src.replace(/localhost:\\d+/,'L')];`,
	underscore_like: `const src=document.getElementById('t1').innerHTML; const fn=new Function('obj','with(obj){return '+JSON.stringify(src).replace(/<%=\\s*(\\w+)\\s*%>/g,'"+$1+"').replace(/<%[^%]*%>/g,'')+'}'); return fn({id:5,img:'/p.png', x:1, y:2});`,
	shadow_innerHTML: `const h=document.createElement('div'); document.body.appendChild(h); const sr=h.attachShadow({mode:'open'}); sr.innerHTML='<style>:host{background:url(/sh.png)}</style><a href="/sa">a</a>'; return [sr.innerHTML, sr.querySelector('a').getAttribute('href'), sr.querySelector('a').href.replace(/localhost:\\d+/,'L')];`,
	declarative_shadow: `const d=document.createElement('div'); d.setHTMLUnsafe('<div><template shadowrootmode="open"><a href="/dsd">x</a></template></div>'); const sr=d.firstChild.shadowRoot; return sr ? [sr.innerHTML, sr.querySelector('a').href.replace(/localhost:\\d+/,'L')] : 'no shadow';`,
	getHTML_shadow: `const h=document.createElement('div'); const sr=h.attachShadow({mode:'open', serializable:true}); sr.innerHTML='<b>s</b>'; return h.getHTML({serializableShadowRoots:true});`,
	noscript_read: `const d=document.createElement('div'); d.innerHTML='<noscript><img src="/ns.png"></noscript>'; return [d.innerHTML, d.firstChild.textContent, d.firstChild.innerHTML];`,
	textarea_value: `const d=document.createElement('div'); d.innerHTML='<textarea><a href="/ta">x</a></textarea>'; return [d.firstChild.value, d.innerHTML];`,
	title_text: `const d=document.createElement('div'); d.innerHTML='<title>A &amp; B <b></title>'; return [d.firstChild.textContent, d.innerHTML];`,
	entity_decode_idiom: `const t=document.createElement('textarea'); t.innerHTML='&lt;p&gt; &amp; &quot;x&quot; &#39;y&#39; &copy;'; return t.value;`,
	div_decode_idiom: `const t=document.createElement('div'); t.innerHTML='Tom &amp; Jerry &lt;3'; return [t.textContent, t.innerText, t.innerHTML];`,
	pre_whitespace: `const d=document.createElement('pre'); d.innerHTML='\\nline1\\n  line2'; return [d.innerHTML, d.textContent];`,
	table_fragment: `const t=document.createElement('table'); t.innerHTML='<tr><td>1</td></tr>'; return [t.innerHTML, t.rows.length];`,
	tbody_insertAdjacent: `const t=document.createElement('table'); const tb=document.createElement('tbody'); t.appendChild(tb); tb.insertAdjacentHTML('beforeend','<tr><td><a href="/r">r</a></td></tr>'); return [tb.innerHTML, tb.rows.length];`,
	select_options: `const s=document.createElement('select'); s.innerHTML='<option value="/v1">A</option><option selected>B</option>'; return [s.options.length, s.value, s.innerHTML];`,
	svg_innerHTML: `const s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.innerHTML='<linearGradient id="gg" gradientUnits="userSpaceOnUse"><stop offset="0"/></linearGradient><path d="M0 0"/>'; return [s.innerHTML, s.firstChild.getAttribute('gradientUnits'), s.firstChild.namespaceURI];`,
	outerHTML_set: `const w=document.createElement('div'); const c=document.createElement('span'); w.appendChild(c); c.outerHTML='<a href="/oh">o</a>'; return [w.innerHTML, w.firstChild.getAttribute('href')];`,
	range_ccf_tr: `const t=document.createElement('table'); const tb=t.createTBody(); document.body.appendChild(t); const r=document.createRange(); r.selectNodeContents(tb); const f=r.createContextualFragment('<tr><td>x</td></tr>'); return f.firstChild && f.firstChild.nodeName;`,
	insertAdjacent_positions: `const d=document.createElement('div'); d.innerHTML='<p>m</p>'; document.body.appendChild(d); const p=d.firstChild; p.insertAdjacentHTML('beforebegin','<i>1</i>'); p.insertAdjacentHTML('afterbegin','<i>2</i>'); p.insertAdjacentHTML('beforeend','<i>3</i>'); p.insertAdjacentHTML('afterend','<i>4</i>'); return d.innerHTML;`,
	innerHTML_script_exec: `window.__ie=0; const d=document.createElement('div'); d.innerHTML='<script>window.__ie=1<\\/script>'; document.body.appendChild(d); return window.__ie;`,
	innerHTML_img_onerror: `window.__oe=0; const d=document.createElement('div'); d.innerHTML='<img src="/nonexist.png" onerror="window.__oe=location.host">'; document.body.appendChild(d); await new Promise(r=>setTimeout(r,300)); return window.__oe===location.host;`,
	innerHTML_null: `const d=document.createElement('div'); d.innerHTML=null; const a=d.innerHTML; d.innerHTML=undefined; return [a, d.innerHTML];`,
	innerHTML_number: `const d=document.createElement('div'); d.innerHTML=42; return d.innerHTML;`,
	innerHTML_frag_whitespace: `const d=document.createElement('div'); d.innerHTML='  <b>x</b>  '; return [d.childNodes.length, JSON.stringify(d.innerHTML)];`,
	comments: `const d=document.createElement('div'); d.innerHTML='<!-- c1 --><b>x</b><!--[if IE]><p>ie</p><![endif]-->'; return [d.childNodes.length, d.innerHTML];`,
	cdata_html: `const d=document.createElement('div'); d.innerHTML='<![CDATA[x]]>'; return [d.childNodes.length, d.firstChild.nodeType, d.innerHTML];`,
	attr_quotes: `const d=document.createElement('div'); d.innerHTML='<p title=\\'a "q" b\\' data-x="1 &amp; 2">x</p>'; return [d.firstChild.getAttribute('title'), d.firstChild.getAttribute('data-x'), d.innerHTML];`,
	custom_el: `const d=document.createElement('div'); d.innerHTML='<my-el some-prop="/x" href="/h"></my-el>'; return [d.firstChild.getAttribute('some-prop'), d.firstChild.getAttribute('href'), d.innerHTML];`,
	vue_attrs: `const d=document.createElement('div'); d.innerHTML='<a :href="url" v-bind:src="s" @click.prevent="f" #slot v-on:x="y">a</a>'; return [d.innerHTML, d.firstChild.getAttributeNames()];`,
};

export default [
	probeTest({
		name: "rv10-templates",
		head,
		probes,
	}),
];
