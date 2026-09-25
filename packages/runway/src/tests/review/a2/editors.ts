import { htmlTest } from "../../../testcommon.ts";

const fw = (name: string, head: string, body: string, js: string) =>
	htmlTest({
		name: `rv2-ed-${name}`,
		html: `<!DOCTYPE html><html><head>${head}</head><body>${body}<script>
		runTest(async () => {
			const R = {};
			const rec = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		}, true);
		</script></body></html>`,
	});

export default [
	fw(
		"quill",
		`<link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>`,
		`<div id=ed><p>Hello <a href="/x">link</a></p></div>`,
		`
		const q = new Quill("#ed", { theme: "snow" });
		await rec("init", () => q.getContents().ops);
		q.insertText(0, "Start ", { bold: true });
		q.insertText(q.getLength() - 1, " end");
		q.formatText(0, 5, "link", "https://e.test/a");
		q.insertEmbed(3, "image", "/img.png");
		await rec("after", () => q.getContents().ops);
		await rec("html", () => q.root.innerHTML);
		await rec("semantic", () => q.getSemanticHTML());
		q.clipboard.dangerouslyPasteHTML(0, "<b>pasted</b> <a href='/p'>p</a><img src='/pi.png'>");
		await rec("pasted", () => q.getContents().ops);
		await rec("text", () => q.getText());
		`
	),
	fw(
		"codemirror5",
		`<link rel=stylesheet href="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.css"><script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.js"></script><script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/javascript/javascript.js"></script>`,
		`<textarea id=ta>function f() {\n  return location.href;\n}</textarea>`,
		`
		const cm = CodeMirror.fromTextArea(document.getElementById("ta"), { mode: "javascript", lineNumbers: true });
		await rec("value", () => cm.getValue());
		cm.replaceRange("// hi <b>\\n", { line: 0, ch: 0 });
		cm.setCursor({ line: 1, ch: 3 });
		cm.replaceSelection("XYZ");
		await rec("value2", () => cm.getValue());
		await rec("lines", () => cm.lineCount());
		await new Promise(r => setTimeout(r, 100));
		await rec("rendered", () => Array.from(document.querySelectorAll(".CodeMirror-line")).map(l => l.textContent));
		cm.save();
		await rec("ta", () => document.getElementById("ta").value);
		`
	),
	fw(
		"prosemirror",
		``,
		`<div id=pm></div>`,
		`
		const m = await import("https://esm.sh/prosemirror-example-setup@1.2.3?bundle-deps&deps=prosemirror-model@1.22.3");
		const { EditorState } = await import("https://esm.sh/prosemirror-state@1.4.3?bundle-deps");
		const { EditorView } = await import("https://esm.sh/prosemirror-view@1.34.3?bundle-deps&deps=prosemirror-model@1.22.3");
		const { schema, DOMParser: PDP } = await import("https://esm.sh/prosemirror-schema-basic@1.2.3?bundle-deps&deps=prosemirror-model@1.22.3").then(async (b) => ({ schema: b.schema, DOMParser: (await import("https://esm.sh/prosemirror-model@1.22.3")).DOMParser }));
		const content = document.createElement("div");
		content.innerHTML = "<p>Hello <a href='/x'>world</a> <img src='/p.png'></p>";
		const view = new EditorView(document.getElementById("pm"), { state: EditorState.create({ doc: PDP.fromSchema(schema).parse(content) }) });
		await rec("doc", () => view.state.doc.toJSON());
		view.dispatch(view.state.tr.insertText("INS ", 1));
		await rec("doc2", () => view.state.doc.textContent);
		await rec("dom", () => view.dom.innerHTML);
		`
	),
];
