import { probeTest } from "./lib.ts";

const bench = (label: string, n: number, setup: string, body: string) =>
	`${setup}; const t0 = performance.now(); for (let i = 0; i < ${n}; i++) { ${body} } return +(((performance.now() - t0) * 1000 / ${n}).toFixed(3));`;

export default [
	probeTest({
		name: "rv11-perf-common-dom",
		timeout: 20000,
		probes: {
			classList_add_remove: bench(
				"",
				50000,
				"const d = document.createElement('div'); document.body.appendChild(d)",
				"d.classList.add('a'); d.classList.remove('a');"
			),
			classList_toggle: bench(
				"",
				50000,
				"const d = document.createElement('div'); document.body.appendChild(d)",
				"d.classList.toggle('a');"
			),
			classList_contains: bench(
				"",
				50000,
				"const d = document.createElement('div'); d.className = 'x y z'",
				"d.classList.contains('y');"
			),
			className_set: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.className = 'c' + (i & 7);"
			),
			setAttr_class: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.setAttribute('class', 'c' + (i & 7));"
			),
			setAttr_data: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.setAttribute('data-x', 'v' + (i & 7));"
			),
			setAttr_aria: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.setAttribute('aria-label', 'v' + (i & 7));"
			),
			getAttr_class: bench(
				"",
				50000,
				"const d = document.createElement('div'); d.className = 'q'",
				"d.getAttribute('class');"
			),
			hasAttr: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.hasAttribute('hidden');"
			),
			removeAttr: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.removeAttribute('title');"
			),
			dataset_set: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.dataset.x = 'v' + (i & 7);"
			),
			id_set: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.id = 'i' + (i & 7);"
			),
			textContent_div: bench(
				"",
				50000,
				"const d = document.createElement('div'); document.body.appendChild(d)",
				"d.textContent = 't' + (i & 7);"
			),
			textContent_get_div: bench(
				"",
				50000,
				"const d = document.createElement('div'); d.innerHTML = '<b>x</b><i>y</i>'",
				"d.textContent;"
			),
			firstChild_walk: bench(
				"",
				50000,
				"const d = document.createElement('div'); d.innerHTML = '<b>x</b><i>y</i>'",
				"d.firstChild.nextSibling;"
			),
			createElement: bench("", 50000, "", "document.createElement('span');"),
			createTextNode: bench("", 50000, "", "document.createTextNode('x');"),
			input_value: bench(
				"",
				50000,
				"const d = document.createElement('input')",
				"d.value = 'v' + (i & 7);"
			),
			matches_class: bench(
				"",
				50000,
				"const d = document.createElement('div'); d.className = 'q'",
				"d.matches('.q');"
			),
			closest: bench(
				"",
				20000,
				"const d = document.createElement('div'); d.innerHTML = '<p><span><b id=bb>x</b></span></p>'; document.body.appendChild(d); const b = d.querySelector('#bb')",
				"b.closest('p');"
			),
			qsa_class: bench("", 20000, "", "document.querySelectorAll('.nope');"),
			getElementById: bench("", 50000, "", "document.getElementById('p');"),
			ael_rel: bench(
				"",
				20000,
				"const d = document.createElement('div'); const f = () => {}",
				"d.addEventListener('click', f); d.removeEventListener('click', f);"
			),
			dispatch: bench(
				"",
				20000,
				"const d = document.createElement('div'); d.addEventListener('x', () => {})",
				"d.dispatchEvent(new Event('x'));"
			),
			getBCR: bench(
				"",
				20000,
				"const d = document.getElementById('p')",
				"d.getBoundingClientRect();"
			),
			offsetWidth: bench(
				"",
				20000,
				"const d = document.getElementById('p')",
				"d.offsetWidth;"
			),
			attributes_iter: bench(
				"",
				20000,
				"const d = document.createElement('div'); d.setAttribute('a','1'); d.setAttribute('b','2'); d.setAttribute('class','c')",
				"for (const a of d.attributes) a.name;"
			),
			getAttributeNames: bench(
				"",
				20000,
				"const d = document.createElement('div'); d.setAttribute('a','1'); d.setAttribute('b','2')",
				"d.getAttributeNames();"
			),
			cloneNode_deep: bench(
				"",
				5000,
				"const d = document.createElement('div'); d.innerHTML = '<ul>' + '<li class=x><a href=\"/q\">x</a></li>'.repeat(20) + '</ul>'",
				"d.cloneNode(true);"
			),
			innerHTML_small: bench(
				"",
				5000,
				"const d = document.createElement('div')",
				"d.innerHTML = '<span class=a>hello</span><b>w</b>';"
			),
			innerHTML_get: bench(
				"",
				5000,
				"const d = document.createElement('div'); d.innerHTML = '<ul>' + '<li class=x><a href=\"/q\">x</a></li>'.repeat(20) + '</ul>'",
				"d.innerHTML;"
			),
			template_clone: bench(
				"",
				5000,
				"const t = document.createElement('template'); t.innerHTML = '<div class=a><span>x</span><a href=\"/y\">y</a></div>'",
				"t.content.cloneNode(true);"
			),
			importNode: bench(
				"",
				5000,
				"const t = document.createElement('template'); t.innerHTML = '<div class=a><span>x</span></div>'",
				"document.importNode(t.content, true);"
			),
			treewalker: bench(
				"",
				2000,
				"const d = document.createElement('div'); d.innerHTML = '<p>' + '<b>x</b>'.repeat(50) + '</p>'",
				"const w = document.createTreeWalker(d); while (w.nextNode()) {}"
			),
			json_roundtrip: bench(
				"",
				20000,
				"const o = {a: [1,2,3], b: 'x'}",
				"JSON.parse(JSON.stringify(o));"
			),
			promise_then: `const t0 = performance.now(); for (let i = 0; i < 20000; i++) await Promise.resolve(i); return +(((performance.now() - t0) * 1000 / 20000).toFixed(3));`,
			array_iter: bench(
				"",
				20000,
				"const a = [1,2,3,4,5]",
				"for (const x of a) {} [...a]; a.map(x => x);"
			),
			string_ops: bench(
				"",
				20000,
				"const s = 'hello world foo bar'",
				"s.split(' ').join('-').replace(/o/g, '0').includes('f00');"
			),
			url_ctor: bench(
				"",
				20000,
				"",
				"new URL('/a/b?c=1', location.href).searchParams.get('c');"
			),
			location_href: bench("", 20000, "", "location.href;"),
			document_url: bench("", 20000, "", "document.URL;"),
			fn_call_wrapped: bench(
				"",
				50000,
				"function f(a){ return a + 1 }",
				"f(i);"
			),
			method_call: bench(
				"",
				50000,
				"const o = { m(a){ return a + 1 } }",
				"o.m(i);"
			),
			getter_on_proto: bench(
				"",
				50000,
				"const d = document.createElement('div')",
				"d.nodeType; d.tagName; d.parentNode;"
			),
		},
	}),
];
