// Ported from dom-serializer v3.0.0 (src/index.spec.ts), which ran the
// serializer over documents parsed by htmlparser2 (through cheerio). Here the
// vendored parser does the parsing.
//
// The vendored serializer has the options pinned to what scramjet passes
// (`encodeEntities: "utf8"`), so the cases for the other option values -
// `decodeEntities: false`, `emptyAttrs`, `selfClosingTags`, the non-utf8
// default - are left out; the rest keep upstream's inputs and expectations.
import { describe, expect, it } from "vitest";
import {
	Element,
	parseDocument,
	render,
} from "../../src/shared/htmlparser/index";
import { encodeXML } from "../../src/shared/htmlparser/serializer";

const html = (markup: string) => render(parseDocument(markup));
const xml = (markup: string) =>
	render(parseDocument(markup, { xmlMode: true }), true);

describe("render DOM parsed with htmlparser2", () => {
	describe("(html)", () => {
		it("should handle double quotes within single quoted attributes properly", () => {
			const markup = "<hr class='an \"edge\" case' />";
			expect(html(markup)).toStrictEqual(
				'<hr class="an &quot;edge&quot; case">'
			);
		});

		it("should escape entities to utf8 if requested", () => {
			const markup = '<a href="a < b &quot; & c">& " &lt; &gt;</a>';
			expect(html(markup)).toStrictEqual(
				'<a href="a < b &quot; &amp; c">&amp; " &lt; &gt;</a>'
			);
		});

		it("should stringify non-string attribute values before escaping", () => {
			const root = parseDocument("<div></div>");
			const div = root.children[0] as Element;

			(div.attribs as Record<string, unknown>).width = 42;

			expect(render(root)).toStrictEqual('<div width="42"></div>');
		});

		it("should render <br /> tags without a slash", () => {
			const markup = "<br />";
			expect(html(markup)).toStrictEqual("<br>");
		});

		it("should retain encoded HTML content within attributes", () => {
			const markup = '<hr class="cheerio &amp; node = happy parsing" />';
			expect(html(markup)).toStrictEqual(
				'<hr class="cheerio &amp; node = happy parsing">'
			);
		});

		it('should shorten the "checked" attribute when it contains the value "checked"', () => {
			const markup = "<input checked/>";
			expect(html(markup)).toStrictEqual("<input checked>");
		});

		it('should not shorten the "name" attribute when it contains the value "name"', () => {
			const markup = '<input name="name"/>';
			expect(html(markup)).toStrictEqual('<input name="name">');
		});

		it('should not append ="" to attributes with no value', () => {
			const markup = "<div dropdown-toggle>";
			expect(html(markup)).toStrictEqual("<div dropdown-toggle></div>");
		});

		it("should render comments correctly", () => {
			const markup = "<!-- comment -->";
			expect(html(markup)).toStrictEqual("<!-- comment -->");
		});

		it("should render whitespace by default", () => {
			const markup =
				'<a href="./haha.html">hi</a> <a href="./blah.html">blah</a>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should preserve multiple hyphens in data attributes", () => {
			const markup = '<div data-foo-bar-baz="value"></div>';
			expect(html(markup)).toStrictEqual(
				'<div data-foo-bar-baz="value"></div>'
			);
		});

		it("should not encode characters in script tag", () => {
			const markup = '<script>alert("hello world")</script>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should not encode tags in script tag", () => {
			const markup = '<script>"<br>"</script>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should not encode json data", () => {
			const markup =
				'<script>var json = {"simple_value": "value", "value_with_tokens": "&quot;here & \'there\'&quot;"};</script>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should render childless SVG nodes with a closing slash in HTML mode", () => {
			const markup =
				'<svg><circle x="12" y="12"/><path d="123M"/><polygon points="60,20 100,40 100,80 60,100 20,80 20,40"/></svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should render childless MathML nodes with a closing slash in HTML mode", () => {
			const markup = "<math><infinity/></math>";
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should allow SVG elements to have children", () => {
			const markup =
				'<svg><circle cx="12" r="12"><title>dot</title></circle></svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should not include extra whitespace in SVG self-closed elements", () => {
			const markup = '<svg><image href="x.png"/>     </svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should fix-up bad nesting in SVG in HTML mode", () => {
			const markup = '<svg><g><image href="x.png"></svg>';
			expect(html(markup)).toStrictEqual(
				'<svg><g><image href="x.png"/></g></svg>'
			);
		});

		it("should preserve XML prefixed attributes on inline SVG nodes in HTML mode", () => {
			const markup =
				'<svg><text id="t" xml:lang="fr">Bonjour</text><use xlink:href="#t"/></svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should handle mixed-case SVG content in HTML mode", () => {
			const markup = '<svg viewBox="0 0 8 8"><radialGradient/></svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should render HTML content in SVG foreignObject in HTML mode", () => {
			const markup =
				'<svg><foreignObject requiredFeatures=""><img src="test.png" viewbox>text<svg viewBox="0 0 8 8"><circle r="3"/></svg></foreignObject></svg>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should render iframe nodes with a closing tag in HTML mode", () => {
			const markup = '<iframe src="test"></iframe>';
			expect(html(markup)).toStrictEqual(markup);
		});

		it("should encode double quotes in attribute", () => {
			const markup = `<img src="/" alt='title" onerror="alert(1)" label="x'>`;
			expect(html(markup)).toStrictEqual(
				'<img src="/" alt="title&quot; onerror=&quot;alert(1)&quot; label=&quot;x">'
			);
		});
	});

	describe("(xml)", () => {
		it("should render CDATA correctly", () => {
			const markup =
				"<a> <b> <![CDATA[ asdf&asdf ]]> <c/> <![CDATA[ asdf&asdf ]]> </b> </a>";
			expect(xml(markup)).toStrictEqual(markup);
		});

		it('should append ="" to attributes with no value', () => {
			const markup = "<div dropdown-toggle>";
			expect(xml(markup)).toStrictEqual('<div dropdown-toggle=""/>');
		});

		it('should append ="" to boolean attributes with no value', () => {
			const markup = "<input disabled>";
			expect(xml(markup)).toStrictEqual('<input disabled=""/>');
		});

		it("should preserve XML prefixes on attributes", () => {
			const markup =
				'<div xmlns:ex="http://example.com/ns"><p ex:ample="attribute">text</p></div>';
			expect(xml(markup)).toStrictEqual(markup);
		});

		it("should preserve mixed-case XML elements and attributes", () => {
			const markup = '<svg viewBox="0 0 8 8"><radialGradient/></svg>';
			expect(xml(markup)).toStrictEqual(markup);
		});

		it("should encode entities in otherwise special tags", () => {
			expect(xml('<script>"<br/>"</script>')).toStrictEqual(
				"<script>&quot;<br/>&quot;</script>"
			);
		});

		it("should stringify non-string SVG attribute values before escaping", () => {
			const root = parseDocument("<svg><rect/></svg>", { xmlMode: true });
			const rect = (root.children[0] as Element).children[0] as Element;

			(rect.attribs as Record<string, unknown>).width = 42;
			(rect.attribs as Record<string, unknown>).height = 24;

			expect(render(root, true)).toStrictEqual(
				'<svg><rect width="42" height="24"/></svg>'
			);
		});
	});
});

// From entities v8.0.0 (src/escape.spec.ts, src/encode.spec.ts), the parts
// covering the three escapers the serializer uses.
describe("escaping", () => {
	it("encodeXML encodes non-ASCII and astral characters", () => {
		expect(encodeXML("\"'&<>")).toBe("&quot;&apos;&amp;&lt;&gt;");
		expect(encodeXML("üä€")).toBe("&#xfc;&#xe4;&#x20ac;");
		expect(encodeXML("😄a")).toBe("&#x1f604;a");
		expect(encodeXML("plain")).toBe("plain");
	});

	it("escapes nbsp in HTML text and attributes", () => {
		expect(html("<p a='\u00a0\"'>\u00a0<></p>")).toBe(
			'<p a="&nbsp;&quot;">&nbsp;&lt;&gt;</p>'
		);
	});
});
