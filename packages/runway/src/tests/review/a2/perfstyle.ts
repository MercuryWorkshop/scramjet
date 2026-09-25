import { basicTest } from "../../../testcommon.ts";

// CSS-in-JS insertion patterns that append to one <style> element
const bench = (
	name: string,
	setup: string,
	body: string,
	n: number,
	check = ""
) =>
	basicTest({
		name: `rv2-perfstyle-${name}`,
		scramjetOnly: true,
		js: `
			${setup}
			const t0 = performance.now();
			for (let i = 0; i < ${n}; i++) { ${body} }
			const dt = performance.now() - t0;
			${check}
			fail("TIMING ${name} n=${n} total=" + dt.toFixed(1) + "ms");
		`,
	});

const rule =
	"'.c' + i + '{color:red;background:url(/img/' + i + '.png);margin:' + i + 'px}'";

export default [
	bench(
		"goober-data-append",
		`const s = document.createElement("style"); s.id = "_goober"; s.appendChild(document.createTextNode(" ")); document.head.appendChild(s); const t = s.firstChild;`,
		`t.data = t.data + ${rule};`,
		400,
		`if (s.sheet.cssRules.length < 200) fail("rules missing " + s.sheet.cssRules.length);`
	),
	bench(
		"sc-textnode-per-rule",
		`const s = document.createElement("style"); document.head.appendChild(s);`,
		`s.appendChild(document.createTextNode(${rule}));`,
		400,
		`if (s.sheet.cssRules.length < 200) fail("rules missing " + s.sheet.cssRules.length);`
	),
	bench(
		"sc-insertBefore",
		`const s = document.createElement("style"); document.head.appendChild(s); let ref = null;`,
		`s.insertBefore(document.createTextNode(${rule}), ref);`,
		400
	),
	bench(
		"textContent-plus-equals",
		`const s = document.createElement("style"); document.head.appendChild(s);`,
		`s.textContent += ${rule};`,
		400
	),
	bench(
		"appendData",
		`const s = document.createElement("style"); s.appendChild(document.createTextNode("")); document.head.appendChild(s); const t = s.firstChild;`,
		`t.appendData(${rule});`,
		400
	),
	bench(
		"new-style-each",
		``,
		`const s = document.createElement("style"); s.appendChild(document.createTextNode(${rule})); document.head.appendChild(s);`,
		400
	),
];
