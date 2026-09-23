// The DOM builder (the domhandler replacement) and the parser options scramjet
// added on top of htmlparser2. The first block follows htmlparser2's
// src/index.spec.ts; its snapshots printed domhandler's node objects, so the
// same inputs are checked through the serializer instead.
import { describe, expect, it } from "vitest";
import {
	Comment,
	Document,
	DomBuilder,
	Element,
	ElementType,
	Parser,
	type ParserOptions,
	parseDocument,
	render,
	Text,
} from "../../src/shared/htmlparser/index";

/** A tree as plain data, so structure can be compared with `toEqual`. */
function shape(node: Document | Element["children"][number]): unknown {
	switch (node.type) {
		case ElementType.Root:
			return Array.from(node.children as ArrayLike<never>, shape);
		case ElementType.Tag:
			return [
				node.name,
				{ ...node.attribs },
				Array.from(node.children as ArrayLike<never>, shape),
			];
		case ElementType.CDATA:
			return ["#cdata", Array.from(node.children as ArrayLike<never>, shape)];
		case ElementType.Directive:
			return ["#directive", node.name, node.data];
		default:
			return [`#${node.type}`, node.data];
	}
}

describe("Index", () => {
	it("parseDocument", () => {
		const dom = parseDocument("<a foo><b><c><?foo>Yay!");
		expect(shape(dom)).toEqual([
			[
				"a",
				{ foo: "" },
				[
					[
						"b",
						{},
						[
							[
								"c",
								{},
								[
									["#comment", "?foo"],
									["#text", "Yay!"],
								],
							],
						],
					],
				],
			],
		]);
		expect(render(dom)).toBe("<a foo><b><c><!--?foo-->Yay!</c></b></a>");
	});

	it("parseDocument in foreign content", () => {
		const dom = parseDocument("<svg><![CDATA[a<b]]></svg>");
		expect(shape(dom)).toEqual([["svg", {}, [["#text", "a<b"]]]]);
		expect(render(dom)).toBe("<svg>a&lt;b</svg>");
	});

	it("streamed input builds the same document", () => {
		const input = "&amp;This is text<!-- and comments --><tags>";
		const builder = new DomBuilder();
		const parser = new Parser(builder);
		for (const c of input) parser.write(c);
		parser.end();

		expect(shape(builder.root)).toEqual([
			["#text", "&This is text"],
			["#comment", " and comments "],
			["tags", {}, []],
		]);
		expect(shape(builder.root)).toEqual(shape(parseDocument(input)));
	});
});

describe("DomBuilder", () => {
	it("links parents", () => {
		const root = parseDocument("<div><p>text</p></div>");
		const div = root.children[0] as Element;
		const p = div.children[0] as Element;
		expect(div.parent).toBe(root);
		expect(p.parent).toBe(div);
		expect(p.children[0].parent).toBe(p);
	});

	it("counts open elements while streaming", () => {
		const builder = new DomBuilder();
		const parser = new Parser(builder);
		parser.write("<div><span>");
		expect(builder.openElements).toBe(2);
		parser.write("</span></div>text");
		expect(builder.openElements).toBe(0);
		parser.write("<p>");
		expect(builder.openElements).toBe(1);
		parser.end();
		expect(builder.openElements).toBe(0);
	});

	it("builds CDATA nodes in XML mode", () => {
		const root = parseDocument("<a><![CDATA[x&y]]></a>", { xmlMode: true });
		expect(shape(root)).toEqual([["a", {}, [["#cdata", [["#text", "x&y"]]]]]]);
		expect(render(root, true)).toBe("<a><![CDATA[x&y]]></a>");
	});

	it("keeps doctypes as directives", () => {
		const root = parseDocument("<!DOCTYPE html><html></html>");
		expect(shape(root)[0]).toEqual(["#directive", "!doctype", "!DOCTYPE html"]);
		expect(render(root)).toBe("<!DOCTYPE html><html></html>");
	});

	it("resets with the parser", () => {
		const builder = new DomBuilder();
		const parser = new Parser(builder);
		parser.end("<a>");
		parser.reset();
		parser.end("<b>");
		expect(shape(builder.root)).toEqual([["b", {}, []]]);
	});

	it("throws on writes after the end", () => {
		const parser = new Parser(new DomBuilder());
		parser.end();
		expect(() => parser.write("x")).toThrow(".write() after done!");
	});

	it("keeps attributes named after Object.prototype members", () => {
		// upstream's `{}` record silently drops `__proto__`; ours has no prototype
		const root = parseDocument(
			"<a __proto__=x constructor=y hasOwnProperty=z></a>"
		);
		const a = root.children[0] as Element;
		expect(Object.getPrototypeOf(a.attribs)).toBe(null);
		expect(Object.keys(a.attribs)).toEqual([
			"__proto__",
			"constructor",
			"hasownproperty",
		]);
		expect(render(root)).toBe(
			'<a __proto__="x" constructor="y" hasownproperty="z"></a>'
		);
	});
});

describe("Node mutation", () => {
	it("prepend keeps order and sets parents", () => {
		const root = parseDocument("<head><title>t</title></head>");
		const head = root.children[0] as Element;
		const scripts = [
			new Element("script", { src: "a" }),
			new Element("script", { src: "b" }),
		];
		head.prepend(scripts);
		expect(scripts[0].parent).toBe(head);
		expect(render(root)).toBe(
			'<head><script src="a"></script><script src="b"></script><title>t</title></head>'
		);
	});

	it("replaceChild swaps a node in place", () => {
		const root = parseDocument("<a></a><b></b>");
		const comment = new Comment("gone");
		root.replaceChild(0, comment);
		expect(comment.parent).toBe(root);
		expect(render(root)).toBe("<!--gone--><b></b>");
	});

	it("copies plain attribute objects onto null-prototype records", () => {
		const element = new Element("img", { src: "x" }, [new Text("t")]);
		expect(Object.getPrototypeOf(element.attribs)).toBe(null);
		expect(element.children[0].parent).toBe(element);
	});
});

describe("Scramjet parser options", () => {
	const html = (markup: string, options?: ParserOptions) =>
		render(parseDocument(markup, options));

	it("startingForeignContext parses as though inside svg or math", () => {
		// in HTML, the self-closing slash on a non-void element is ignored
		expect(html("<clippath/><script>a</script>")).toBe(
			"<clippath><script>a</script></clippath>"
		);
		const svg = parseDocument("<clippath/><script><b>x</b></script>", {
			startingForeignContext: "svg",
		});
		// SVG casing is applied, self-closing is honoured, and <script> isn't
		// raw text in foreign content
		expect(shape(svg)).toEqual([
			["clipPath", {}, []],
			["script", {}, [["b", {}, [["#text", "x"]]]]],
		]);

		const math = parseDocument("<mrow/><x/>", {
			startingForeignContext: "math",
		});
		expect(shape(math)).toEqual([
			["mrow", {}, []],
			["x", {}, []],
		]);

		expect(html("<br/>", { startingForeignContext: "html" })).toBe("<br>");
	});

	it("startingForeignContext survives reset", () => {
		const builder = new DomBuilder();
		const parser = new Parser(builder, { startingForeignContext: "svg" });
		parser.end("<a/>");
		parser.reset();
		parser.end("<clippath/>");
		expect(shape(builder.root)).toEqual([["clipPath", {}, []]]);
	});

	it("noscript is raw text unless scripting is disabled", () => {
		const markup = "<noscript><img src=x onerror=y></noscript>";
		expect(shape(parseDocument(markup))).toEqual([
			["noscript", {}, [["#text", "<img src=x onerror=y>"]]],
		]);
		expect(shape(parseDocument(markup, { scriptingEnabled: false }))).toEqual([
			["noscript", {}, [["img", { src: "x", onerror: "y" }, []]]],
		]);
	});

	it("noscript detection doesn't disturb noembed or noframes", () => {
		for (const tag of ["noembed", "noframes"]) {
			expect(shape(parseDocument(`<${tag}><b></b></${tag}>`))).toEqual([
				[tag, {}, [["#text", "<b></b>"]]],
			]);
		}
		expect(shape(parseDocument("<nosuch><b></b></nosuch>"))).toEqual([
			["nosuch", {}, [["b", {}, []]]],
		]);
	});

	it("</p> and </br> break out of foreign content", () => {
		expect(shape(parseDocument("<svg><g></p><b>x</b>"))).toEqual([
			["svg", {}, [["g", {}, []]]],
			["p", {}, []],
			["b", {}, [["#text", "x"]]],
		]);
		expect(shape(parseDocument("<math><mrow></br><i>"))).toEqual([
			["math", {}, [["mrow", {}, []]]],
			["br", {}, []],
			["i", {}, []],
		]);
		// ...but not from an HTML integration point, where HTML rules apply
		expect(shape(parseDocument("<math><mi></br><i>"))).toEqual([
			[
				"math",
				{},
				[
					[
						"mi",
						{},
						[
							["br", {}, []],
							["i", {}, []],
						],
					],
				],
			],
		]);
		// in XML they're ordinary end tags
		expect(
			shape(parseDocument("<svg><g></p></g></svg>", { xmlMode: true }))
		).toEqual([["svg", {}, [["g", {}, []]]]]);
	});
});
