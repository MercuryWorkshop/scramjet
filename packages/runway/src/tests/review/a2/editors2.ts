import http from "http";
import type { AddressInfo } from "node:net";
import { playwrightTest } from "../../../testcommon.ts";

// Pass 2: real editors driven through Playwright. Each test serves one page
// from a local server, loads the editor from a CDN through the proxy, types,
// formats, undoes, selects and pastes, and reports everything (plus per-key
// latency) in the thrown EDREPORT so main and dev can be compared.

type Ed = {
	name: string;
	kind: "rich" | "code";
	head?: string;
	body: string;
	script: string; // module script; must set window.__ed = { text(), html() } and window.__ready = true
	target: string; // selector to click to focus
	boldKeys?: string; // default Control+b
};

const TEXT = (() => {
	const s = "The quick brown fox jumps over the lazy dog 0123456789 ";
	let out = "";
	while (out.length < 200) out += s;
	return out.slice(0, 200).trimEnd();
})();

const eds: Ed[] = [
	{
		name: "prosemirror",
		kind: "rich",
		head: `<link rel=stylesheet href="https://cdn.jsdelivr.net/npm/prosemirror-view@1.34.3/style/prosemirror.css"><link rel=stylesheet href="https://cdn.jsdelivr.net/npm/prosemirror-example-setup@1.2.3/style/style.css"><link rel=stylesheet href="https://cdn.jsdelivr.net/npm/prosemirror-menu@1.2.4/style/menu.css">`,
		body: `<div id=ed></div>`,
		script: `
			const { EditorState } = await import("https://esm.sh/prosemirror-state@1.4.3");
			const { EditorView } = await import("https://esm.sh/prosemirror-view@1.34.3");
			const { Schema, DOMParser: PDP } = await import("https://esm.sh/prosemirror-model@1.22.3");
			const { schema } = await import("https://esm.sh/prosemirror-schema-basic@1.2.3?deps=prosemirror-model@1.22.3");
			const { addListNodes } = await import("https://esm.sh/prosemirror-schema-list@1.4.1?deps=prosemirror-model@1.22.3,prosemirror-state@1.4.3,prosemirror-transform@1.10.0");
			const { exampleSetup } = await import("https://esm.sh/prosemirror-example-setup@1.2.3?deps=prosemirror-model@1.22.3,prosemirror-state@1.4.3,prosemirror-view@1.34.3,prosemirror-transform@1.10.0");
			const s = new Schema({ nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"), marks: schema.spec.marks });
			const view = new EditorView(document.getElementById("ed"), { state: EditorState.create({ doc: PDP.fromSchema(s).parse(document.createElement("div")), plugins: exampleSetup({ schema: s }) }) });
			window.__ed = { text: () => view.state.doc.textContent, html: () => view.dom.innerHTML };
		`,
		target: ".ProseMirror",
	},
	{
		name: "tiptap",
		kind: "rich",
		body: `<div id=ed></div>`,
		script: `
			const { Editor } = await import("https://esm.sh/@tiptap/core@2");
			const StarterKit = (await import("https://esm.sh/@tiptap/starter-kit@2")).default;
			const ed = new Editor({ element: document.getElementById("ed"), extensions: [StarterKit], content: "" });
			window.__ed = { text: () => ed.getText(), html: () => ed.getHTML() };
		`,
		target: ".ProseMirror",
	},
	{
		name: "lexical",
		kind: "rich",
		body: `<div id=ed contenteditable=true style="min-height:50px;border:1px solid"></div>`,
		script: `
			const L = await import("https://esm.sh/lexical@0.17.1");
			const { registerRichText } = await import("https://esm.sh/@lexical/rich-text@0.17.1?deps=lexical@0.17.1");
			const { registerHistory, createEmptyHistoryState } = await import("https://esm.sh/@lexical/history@0.17.1?deps=lexical@0.17.1");
			const { mergeRegister } = await import("https://esm.sh/@lexical/utils@0.17.1?deps=lexical@0.17.1");
			const editor = L.createEditor({ namespace: "t", onError: (e) => { throw e; }, theme: { text: { bold: "b", italic: "i" } } });
			editor.setRootElement(document.getElementById("ed"));
			mergeRegister(registerRichText(editor), registerHistory(editor, createEmptyHistoryState(), 300));
			editor.registerCommand(L.KEY_MODIFIER_COMMAND, (e) => { if (e.key === "b" && e.ctrlKey) { e.preventDefault(); editor.dispatchCommand(L.FORMAT_TEXT_COMMAND, "bold"); return true; } return false; }, L.COMMAND_PRIORITY_NORMAL);
			window.__ed = { text: () => editor.getEditorState().read(() => L.$getRoot().getTextContent()), html: () => document.getElementById("ed").innerHTML };
		`,
		target: "#ed",
	},
	{
		name: "slate",
		kind: "rich",
		body: `<div id=root></div>`,
		script: `
			const React = (await import("https://esm.sh/react@18.3.1")).default;
			const { createRoot } = await import("https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1");
			const S = await import("https://esm.sh/slate@0.103.0");
			const SR = await import("https://esm.sh/slate-react@0.108.0?deps=react@18.3.1,react-dom@18.3.1,slate@0.103.0,slate-dom@0.108.0");
			const { withHistory } = await import("https://esm.sh/slate-history@0.100.0?deps=slate@0.103.0");
			const editor = withHistory(SR.withReact(S.createEditor()));
			const e = React.createElement;
			const Leaf = ({ attributes, children, leaf }) => e("span", attributes, leaf.bold ? e("strong", null, children) : children);
			function App() {
				return e(SR.Slate, { editor, initialValue: [{ type: "p", children: [{ text: "" }] }] },
					e(SR.Editable, { id: "sl", renderLeaf: (p) => e(Leaf, p), onKeyDown: (ev) => {
						if (ev.ctrlKey && ev.key === "b") { ev.preventDefault(); const m = S.Editor.marks(editor); if (m && m.bold) S.Editor.removeMark(editor, "bold"); else S.Editor.addMark(editor, "bold", true); }
						if (ev.ctrlKey && ev.key === "z") { ev.preventDefault(); editor.undo(); }
					} }));
			}
			createRoot(document.getElementById("root")).render(e(App));
			await new Promise(r => setTimeout(r, 200));
			window.__ed = { text: () => S.Node.string(editor), html: () => document.getElementById("sl").innerHTML };
		`,
		target: "#sl",
	},
	{
		name: "quill",
		kind: "rich",
		head: `<link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>`,
		body: `<div id=ed></div>`,
		script: `
			const q = new Quill("#ed", { theme: "snow" });
			window.__ed = { text: () => q.getText(), html: () => q.root.innerHTML };
		`,
		target: ".ql-editor",
	},
	{
		name: "ckeditor5",
		kind: "rich",
		head: `<script src="https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js"></script>`,
		body: `<div id=ed></div>`,
		script: `
			const ed = await ClassicEditor.create(document.getElementById("ed"));
			window.__ed = { text: () => { const d = document.createElement("div"); d.innerHTML = ed.getData(); return d.textContent; }, html: () => ed.getData() };
		`,
		target: ".ck-editor__editable",
	},
	{
		name: "tinymce",
		kind: "rich",
		head: `<script src="https://cdn.jsdelivr.net/npm/tinymce@7.3.0/tinymce.min.js"></script>`,
		body: `<textarea id=ed></textarea>`,
		script: `
			const [ed] = await tinymce.init({ selector: "#ed", license_key: "gpl", menubar: false, plugins: [], promotion: false, branding: false });
			window.__ed = { text: () => ed.getContent({ format: "text" }), html: () => ed.getContent() };
		`,
		target: "iframe.tox-edit-area__iframe",
	},
	{
		name: "draftjs",
		kind: "rich",
		head: `<script src="https://cdn.jsdelivr.net/npm/react@16.14.0/umd/react.production.min.js"></script><script src="https://cdn.jsdelivr.net/npm/react-dom@16.14.0/umd/react-dom.production.min.js"></script><script src="https://cdn.jsdelivr.net/npm/immutable@3.8.2/dist/immutable.min.js"></script><script src="https://cdn.jsdelivr.net/npm/draft-js@0.11.7/dist/Draft.min.js"></script><link rel=stylesheet href="https://cdn.jsdelivr.net/npm/draft-js@0.11.7/dist/Draft.css">`,
		body: `<div id=root style="border:1px solid;min-height:40px"></div>`,
		script: `
			const { Editor, EditorState, RichUtils } = Draft;
			const e = React.createElement;
			let cur;
			class App extends React.Component {
				constructor(p) { super(p); this.state = { es: EditorState.createEmpty() }; cur = this; }
				render() { return e(Editor, { editorState: this.state.es, onChange: (es) => this.setState({ es }), handleKeyCommand: (cmd, es) => { const n = RichUtils.handleKeyCommand(es, cmd); if (n) { this.setState({ es: n }); return "handled"; } return "not-handled"; } }); }
			}
			ReactDOM.render(e(App), document.getElementById("root"));
			await new Promise(r => setTimeout(r, 100));
			window.__ed = { text: () => cur.state.es.getCurrentContent().getPlainText(), html: () => document.getElementById("root").innerHTML };
		`,
		target: ".public-DraftEditor-content",
	},
	{
		name: "codemirror6",
		kind: "code",
		body: `<div id=ed></div>`,
		script: `
			const { EditorView, basicSetup } = await import("https://esm.sh/codemirror@6.0.1");
			const { javascript } = await import("https://esm.sh/@codemirror/lang-javascript@6.2.2");
			const view = new EditorView({ doc: "", extensions: [basicSetup, javascript()], parent: document.getElementById("ed") });
			window.__ed = { text: () => view.state.doc.toString(), html: () => view.contentDOM.innerHTML, sel: () => { const r = view.state.selection.main; return r.to - r.from; } };
		`,
		target: ".cm-content",
	},
	{
		name: "monaco",
		kind: "code",
		head: `<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js"></script>`,
		body: `<div id=ed style="width:800px;height:300px"></div>`,
		script: `
			require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs" } });
			const monaco = await new Promise((res) => require(["vs/editor/editor.main"], () => res(window.monaco)));
			const ed = monaco.editor.create(document.getElementById("ed"), { value: "", language: "plaintext", quickSuggestions: false, wordBasedSuggestions: "off" });
			window.__ed = { text: () => ed.getValue(), html: () => "", sel: () => ed.getModel().getValueInRange(ed.getSelection()).length };
		`,
		target: ".view-lines",
	},
	{
		name: "ace",
		kind: "code",
		head: `<script src="https://cdn.jsdelivr.net/npm/ace-builds@1.35.4/src-min-noconflict/ace.js"></script>`,
		body: `<div id=ed style="width:800px;height:300px"></div>`,
		script: `
			const ed = ace.edit("ed");
			window.__ed = { text: () => ed.getValue(), html: () => "", sel: () => ed.getSelectedText().length };
		`,
		target: "#ed",
	},
	{
		name: "trix",
		kind: "rich",
		head: `<link rel=stylesheet href="https://cdn.jsdelivr.net/npm/trix@2.1.5/dist/trix.css"><script src="https://cdn.jsdelivr.net/npm/trix@2.1.5/dist/trix.umd.min.js"></script>`,
		body: `<input id=x type=hidden name=content><trix-editor input=x id=ed></trix-editor>`,
		script: `
			await new Promise(r => setTimeout(r, 300));
			const el = document.getElementById("ed");
			window.__ed = { text: () => el.editor.getDocument().toString(), html: () => el.innerHTML };
		`,
		target: "trix-editor",
	},
	{
		name: "editorjs",
		kind: "rich",
		head: `<script src="https://cdn.jsdelivr.net/npm/@editorjs/editorjs@2.30.5/dist/editorjs.umd.min.js"></script>`,
		body: `<div id=ed></div>`,
		script: `
			const ed = new EditorJS({ holder: "ed", autofocus: false });
			await ed.isReady;
			window.__ed = { text: () => Array.from(document.querySelectorAll("#ed .ce-paragraph")).map(p => p.textContent).join("\\n"), html: () => Array.from(document.querySelectorAll("#ed .ce-paragraph")).map(p => p.innerHTML).join("\\n") };
		`,
		target: ".ce-paragraph",
	},
	{
		name: "toastui",
		kind: "rich",
		head: `<link rel=stylesheet href="https://uicdn.toast.com/editor/3.2.2/toastui-editor.min.css"><script src="https://uicdn.toast.com/editor/3.2.2/toastui-editor-all.min.js"></script>`,
		body: `<div id=ed></div>`,
		script: `
			const ed = new toastui.Editor({ el: document.getElementById("ed"), initialEditType: "wysiwyg", previewStyle: "vertical", height: "300px" });
			window.__ed = { text: () => ed.getMarkdown(), html: () => ed.getHTML() };
		`,
		target: ".toastui-editor-ww-container .ProseMirror",
	},
];

const page = (
	ed: Ed
) => `<!DOCTYPE html><html><head><meta charset=utf-8>${ed.head ?? ""}</head><body>${ed.body}
<script type=module>
try {
${ed.script}
window.__ready = true;
} catch (e) { window.__readyError = String(e && e.stack || e); }
</script></body></html>`;

// run inside the proxied frame
function instrument(this: void) {
	const w = window as any;
	const L = {
		t0: 0,
		last: 0,
		res: [] as number[],
	};
	w.__lat = L;
	const install = (doc: Document) => {
		try {
			const dw = doc.defaultView as any;
			dw.addEventListener(
				"keydown",
				() => {
					if (L.t0 && L.last) L.res.push(L.last - L.t0);
					L.t0 = performance.now();
					L.last = 0;
				},
				true
			);
			new dw.MutationObserver(() => {
				if (L.t0) L.last = performance.now();
			}).observe(doc, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
			});
			for (const f of Array.from(doc.querySelectorAll("iframe"))) {
				try {
					if ((f as HTMLIFrameElement).contentDocument)
						install((f as HTMLIFrameElement).contentDocument!);
				} catch {}
			}
		} catch {}
	};
	install(document);
}

const mk = (ed: Ed, bare: boolean) => ({
	...playwrightTest({
		name: `rv2-edit${bare ? "bare" : ""}-${ed.name}`,
		fn: async ({ page: harness, frame: hframe, navigate: hnavigate }) => {
			// bare: an unproxied page of our own, for a Chrome baseline
			const np = bare ? await harness.context().newPage() : null;
			const pw = np ?? harness;
			const frame: any = np ?? hframe;
			const navigate = np
				? async (u: string) => {
						await np.goto(u);
					}
				: hnavigate;
			const errors: string[] = [];
			pw.on("pageerror", (e) =>
				errors.push("PAGEERROR " + String(e.message).slice(0, 200))
			);
			pw.on("console", (m) => {
				if (m.type() === "error")
					errors.push("CONSOLE " + m.text().slice(0, 160));
			});
			const server = http.createServer((req, res) => {
				if (req.url === "/" || req.url?.startsWith("/?")) {
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
					});
					res.end(page(ed));
				} else {
					res.writeHead(404);
					res.end();
				}
			});
			await new Promise<void>((r) => server.listen(0, () => r()));
			const port = (server.address() as AddressInfo).port;
			const R: Record<string, unknown> = {};
			const ev = <T>(fn: string) =>
				frame.locator("html").evaluate((_h, f) => {
					try {
						return (0, eval)(f);
					} catch (e) {
						return "EVALERR " + e;
					}
				}, fn) as Promise<T>;
			try {
				await navigate(`http://localhost:${port}/`);
				const t0 = Date.now();
				let ready: unknown = false;
				while (Date.now() - t0 < 30000) {
					try {
						ready = await ev(
							"window.__ready || (window.__readyError ? 'ERR ' + window.__readyError : false)"
						);
					} catch {}
					if (ready) break;
					await new Promise((r) => setTimeout(r, 250));
				}
				R.ready = ready === true ? true : String(ready).slice(0, 300);
				if (ready !== true) throw new Error("not ready");
				await frame.locator(ed.target).first().click({
					timeout: 10000,
				});
				await new Promise((r) => setTimeout(r, 200));
				await frame.locator("html").evaluate(instrument);
				// 1. typing
				const tType = Date.now();
				await pw.keyboard.type(TEXT, {
					delay: 15,
				});
				R.typeWallMs = Date.now() - tType;
				await new Promise((r) => setTimeout(r, 300));
				const lat = (await ev<number[]>(
					"window.__lat.res.slice()"
				)) as number[];
				const sorted = [...lat].sort((a, b) => a - b);
				R.latAvgMs = lat.length
					? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(2)
					: null;
				R.latP90Ms = lat.length
					? +sorted[Math.floor(sorted.length * 0.9)].toFixed(2)
					: null;
				R.latSamples = lat.length;
				const norm = (s: string) =>
					String(s).replace(/ /g, " ").replace(/\s+/g, " ").trim();
				const text1 = norm(await ev<string>("window.__ed.text()"));
				R.textOk = text1 === norm(TEXT);
				if (!R.textOk) R.text = text1.slice(0, 260);
				// burst typing (no delay) wall time: CDP waits for each key to be handled
				const tb = Date.now();
				await pw.keyboard.type(
					" burst " + "typing without any delay ".repeat(5) + "abcdefghijklmn",
					{
						delay: 0,
					}
				);
				R.burstWallMs = Date.now() - tb;
				// 2. selection: shift+left x5
				for (let i = 0; i < 5; i++) await pw.keyboard.press("Shift+ArrowLeft");
				await new Promise((r) => setTimeout(r, 100));
				R.selLen = await ev(
					ed.kind === "code"
						? "window.__ed.sel()"
						: "(() => { const s = (document.activeElement && document.activeElement.tagName === 'IFRAME') ? document.activeElement.contentWindow.getSelection() : getSelection(); return s.toString().length; })()"
				);
				if (ed.kind === "rich") {
					await pw.keyboard.press(ed.boldKeys ?? "Control+b");
					await new Promise((r) => setTimeout(r, 200));
					const h = String(await ev("window.__ed.html()"));
					R.bold =
						/<strong|<b[ >]|font-weight: ?(bold|700)|\*\*|class="b"/.test(h);
					await pw.keyboard.press("Control+z");
					await new Promise((r) => setTimeout(r, 200));
					const h2 = String(await ev("window.__ed.html()"));
					R.undoBold =
						!/<strong|<b[ >]|font-weight: ?(bold|700)|\*\*|class="b"/.test(h2);
					R.textAfterUndo = norm(
						await ev<string>("window.__ed.text()")
					).endsWith("abcdefghijklmn");
				} else {
					await pw.keyboard.press("End");
					await pw.keyboard.type("XYZ");
					await new Promise((r) => setTimeout(r, 100));
					await pw.keyboard.press("Control+z");
					await new Promise((r) => setTimeout(r, 300));
					R.undo = !norm(await ev<string>("window.__ed.text()")).includes(
						"XYZ"
					);
				}
				// 3. caret: Home, type '#'
				await pw.keyboard.press("Control+Home");
				await pw.keyboard.type("#");
				await new Promise((r) => setTimeout(r, 200));
				const t3 = norm(await ev<string>("window.__ed.text()"));
				R.caretHome = t3.startsWith("#The");
				if (!R.caretHome) R.caretText = t3.slice(0, 80);
				// 4. paste
				await pw.keyboard.press("Control+End");
				R.paste = await ev(`(() => {
					let el = document.activeElement;
					let doc = document;
					if (el && el.tagName === "IFRAME") { doc = el.contentDocument; el = doc.activeElement; }
					const dt = new DataTransfer();
					dt.setData("text/plain", "PASTEDPLAIN");
					dt.setData("text/html", "<b>PASTEDHTML</b> <a href='/pl'>lnk</a><img src='/pi.png'>");
					const e = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
					el.dispatchEvent(e);
					return e.defaultPrevented;
				})()`);
				await new Promise((r) => setTimeout(r, 400));
				const t4 = norm(await ev<string>("window.__ed.text()"));
				R.pasted = t4.includes("PASTEDHTML")
					? "html"
					: t4.includes("PASTEDPLAIN")
						? "plain"
						: "none";
				const h4 = String(await ev("window.__ed.html()"));
				R.pastedLeak = /\/~\/sj\/|scramjet/.test(h4);
			} catch (e) {
				R.error = String(e).slice(0, 300);
			} finally {
				server.close();
				if (np) await np.close();
			}
			R.errors = [...new Set(errors)].slice(0, 15);
			throw new Error("EDREPORT " + JSON.stringify(R));
		},
	}),
	timeoutMs: 150000,
});

export default [
	...eds.map((ed) => mk(ed, false)),
	...eds.map((ed) => mk(ed, true)),
];
