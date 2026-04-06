import { basicTest } from "../testcommon.ts";

export default [
	basicTest({
		name: "foreigncontext-innerhtml-svg-self-closing",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.innerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<path></path><circle></circle>", "tags should be self-closing");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-not-svg-self-closing",
		js: `
			const svg = document.createElement("div");
			svg.innerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<path><circle></circle></path>", "tags should not be self-closing");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-wrong-namespace-svg-self-closing",
		js: `
			const svg = document.createElement("svg");
			svg.innerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<path><circle></circle></path>", "tags should not be self-closing");
		`,
	}),
	basicTest({
		name: "foreigncontext-outerhtml-not-inside-svg",
		js: `
			const div = document.createElement("div");
			div.innerHTML = "<svg><path /><circle /></svg><path /><circle />";
			assertEqual(div.outerHTML, "<div><svg><path></path><circle></circle></svg><path><circle></circle></path></div>", "tags outside the svg should not be self-closing, but inside should be");
		`,
	}),
	basicTest({
		name: "foreigncontext-outerhtml-inside-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const div = document.createElement("div");
			svg.appendChild(div);
			div.outerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<path></path><circle></circle>", "written outerhtml inside the svg should be self-closing");
		`,
	}),

	basicTest({
		name: "foreigncontext-insertadjacenthtml-svg-beforeend",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.insertAdjacentHTML("beforeend", "<path /><circle />");
			assertEqual(svg.innerHTML, "<path></path><circle></circle>", "insertAdjacentHTML on svg should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-insertadjacenthtml-g-afterbegin",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
			svg.appendChild(g);
			g.insertAdjacentHTML("afterbegin", "<path /><circle />");
			assertEqual(svg.innerHTML, "<g><path></path><circle></circle></g>", "insertAdjacentHTML on nested g should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-insertadjacenthtml-div-html-rules",
		js: `
			const div = document.createElement("div");
			div.insertAdjacentHTML("beforeend", "<path /><circle />");
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "insertAdjacentHTML on HTML div should not use svg self-closing rules");
		`,
	}),

	basicTest({
		name: "foreigncontext-innerhtml-nested-svg",
		js: `
			const outer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const inner = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			outer.appendChild(inner);
			inner.innerHTML = "<path /><circle />";
			assertEqual(outer.innerHTML, "<svg><path></path><circle></circle></svg>", "inner svg innerHTML should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-clippath",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const cp = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
			svg.appendChild(cp);
			cp.innerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<clipPath><path></path><circle></circle></clipPath>", "clipPath innerHTML should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-symbol",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const sym = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
			svg.appendChild(sym);
			sym.innerHTML = "<path /><circle />";
			assertEqual(svg.innerHTML, "<symbol><path></path><circle></circle></symbol>", "symbol innerHTML should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-svg-rect-line",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.innerHTML = "<rect /><line />";
			assertEqual(svg.innerHTML, "<rect></rect><line></line>", "other empty svg elements should serialize like path/circle");
		`,
	}),

	basicTest({
		name: "foreigncontext-innerhtml-html-div-under-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const div = document.createElement("div");
			svg.appendChild(div);
			div.innerHTML = "<path /><circle />";
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "HTML div under svg still parses innerHTML as HTML");
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-div-inside-foreignobject",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
			const div = document.createElement("div");
			fo.appendChild(div);
			svg.appendChild(fo);
			div.innerHTML = "<path /><circle />";
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "div inside foreignObject should parse as HTML");
		`,
	}),

	basicTest({
		name: "foreigncontext-innerhtml-defs-gradient-stops",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
			const lg = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
			defs.appendChild(lg);
			svg.appendChild(defs);
			lg.innerHTML = "<stop /><stop />";
			assertEqual(
				svg.innerHTML,
				"<defs><linearGradient><stop></stop><stop></stop></linearGradient></defs>",
				"gradient stop elements should follow svg empty-element serialization"
			);
		`,
	}),
	basicTest({
		name: "foreigncontext-innerhtml-polygon-ellipse",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.innerHTML = '<polygon points="0,0 1,0 1,1" /><ellipse cx="0" cy="0" rx="1" ry="1" />';
			assertEqual(
				svg.innerHTML,
				'<polygon points="0,0 1,0 1,1"></polygon><ellipse cx="0" cy="0" rx="1" ry="1"></ellipse>',
				"polygon and ellipse should serialize with explicit end tags in svg context"
			);
		`,
	}),

	basicTest({
		name: "foreigncontext-range-fragment-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const range = document.createRange();
			range.selectNodeContents(svg);
			svg.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(svg.innerHTML, "<path></path><circle></circle>", "fragment parsed with svg as range context should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-div-html",
		js: `
			const div = document.createElement("div");
			const range = document.createRange();
			range.selectNodeContents(div);
			div.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "fragment parsed with div as range context should use HTML rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-nested-g",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
			svg.appendChild(g);
			const range = document.createRange();
			range.selectNodeContents(g);
			g.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(svg.innerHTML, "<g><path></path><circle></circle></g>", "fragment with g as range context should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-html-div-under-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const div = document.createElement("div");
			svg.appendChild(div);
			const range = document.createRange();
			range.selectNodeContents(div);
			div.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "HTML div as range context under svg should parse fragment as HTML");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-foreignobject-div",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
			const div = document.createElement("div");
			fo.appendChild(div);
			svg.appendChild(fo);
			const range = document.createRange();
			range.selectNodeContents(div);
			div.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "div inside foreignObject as range context should parse fragment as HTML");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-clippath",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const cp = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
			svg.appendChild(cp);
			const range = document.createRange();
			range.selectNodeContents(cp);
			cp.appendChild(range.createContextualFragment("<path /><circle />"));
			assertEqual(svg.innerHTML, "<clipPath><path></path><circle></circle></clipPath>", "clipPath as range context should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-range-fragment-collapsed-start-of-svg-text",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
			svg.appendChild(text);
			const range = document.createRange();
			range.setStart(text, 0);
			range.collapse(true);
			text.appendChild(range.createContextualFragment("<tspan>a</tspan>"));
			assertEqual(svg.innerHTML, "<text><tspan>a</tspan></text>", "collapsed range at start of svg text element should use svg foreign rules for fragment");
		`,
	}),

	basicTest({
		name: "foreigncontext-document-parsehtmlunsafe-body-svg",
		js: `
			const doc = Document.parseHTMLUnsafe("<body><svg><path /><circle /></svg><path /><circle /></body>");
			assertEqual(
				doc.body.innerHTML,
				"<svg><path></path><circle></circle></svg><path><circle></circle></path>",
				"parseHTMLUnsafe document should parse svg subtree as foreign content"
			);
		`,
	}),
	basicTest({
		name: "foreigncontext-domparser-parsefromstring-html-svg",
		js: `
			const doc = new DOMParser().parseFromString(
				"<!doctype html><html><body><svg><path /><circle /></svg><path /><circle /></body></html>",
				"text/html"
			);
			assertEqual(
				doc.body.innerHTML,
				"<svg><path></path><circle></circle></svg><path><circle></circle></path>",
				"DOMParser text/html should parse svg subtree as foreign content"
			);
		`,
	}),
	basicTest({
		name: "foreigncontext-element-sethtmlunsafe-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setHTMLUnsafe("<path /><circle />");
			assertEqual(svg.innerHTML, "<path></path><circle></circle>", "setHTMLUnsafe on svg should use foreign content rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-element-sethtmlunsafe-div",
		js: `
			const div = document.createElement("div");
			div.setHTMLUnsafe("<path /><circle />");
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "setHTMLUnsafe on HTML div should use HTML rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-element-sethtmlunsafe-html-div-under-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const div = document.createElement("div");
			svg.appendChild(div);
			div.setHTMLUnsafe("<path /><circle />");
			assertEqual(div.innerHTML, "<path><circle></circle></path>", "setHTMLUnsafe on HTML div under svg should use HTML rules");
		`,
	}),
	basicTest({
		name: "foreigncontext-element-gethtml-svg",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.innerHTML = "<path /><circle />";
			assertEqual(svg.getHTML(), "<path></path><circle></circle>", "getHTML on svg should match innerHTML serialization for foreign content");
		`,
	}),
];
