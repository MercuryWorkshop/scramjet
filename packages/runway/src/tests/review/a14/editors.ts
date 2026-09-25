import http from "node:http";
import { playwrightTest } from "../../../testcommon.ts";

// Iframe-based rich-text editors (TinyMCE 5 classic mode, CKEditor 4 classic):
// they build an about:blank iframe from the parent and write/drive it from
// the parent's realm. Does the editor boot, take input, and round-trip content?
const PAGES: Record<string, string> = {
	tinymce: `<!DOCTYPE html><body><textarea id=ed><p>hello <a href="/rel">link</a> <img src="/i.gif"></p></textarea>
<script src="https://cdnjs.cloudflare.com/ajax/libs/tinymce/5.10.9/tinymce.min.js"></script>
<script>
window.__r = {};
tinymce.init({ selector: "#ed", menubar: false, plugins: [], setup(ed) {
  ed.on("init", () => {
    try {
      const r = window.__r;
      const f = document.querySelector("iframe");
      r.iframeSrc = f && f.getAttribute("src");
      const doc = ed.getDoc();
      r.bodyEditable = doc.body.isContentEditable;
      r.initial = ed.getContent();
      ed.setContent('<p>set <a href="/x">x</a></p>');
      r.afterSet = ed.getContent();
      ed.selection.select(doc.body, true); ed.selection.collapse(false);
      ed.insertContent("<b>ins</b>");
      r.afterInsert = ed.getContent();
      ed.execCommand("Bold");
      r.imgSrc = (doc.querySelector("img") || {}).src;
      r.aHref = doc.querySelector("a").href;
      r.done = true;
    } catch (e) { window.__r.err = String(e && e.stack || e); }
  });
}});
</script></body>`,
	ckeditor: `<!DOCTYPE html><body><textarea id=ed name=ed><p>hello <a href="/rel">link</a></p></textarea>
<script src="https://cdn.ckeditor.com/4.22.1/standard/ckeditor.js"></script>
<script>
window.__r = {};
const ed = CKEDITOR.replace("ed", { versionCheck: false });
ed.on("instanceReady", () => {
  try {
    const r = window.__r;
    const f = document.querySelector("iframe.cke_wysiwyg_frame");
    r.iframeSrc = f && f.getAttribute("src");
    r.bodyEditable = ed.document.getBody().$.isContentEditable;
    r.initial = ed.getData();
    ed.setData('<p>set <a href="/x">x</a></p>', { callback() {
      try {
        r.afterSet = ed.getData();
        ed.insertHtml("<b>ins</b>");
        r.afterInsert = ed.getData();
        r.aHref = ed.document.$.querySelector("a").href;
        r.done = true;
      } catch (e) { r.err = String(e && e.stack || e); }
    } });
  } catch (e) { window.__r.err = String(e && e.stack || e); }
});
</script></body>`,
};
export function makeServer(which: string = process.env.RV14_ED || "tinymce") {
	return http.createServer((req, res) => {
		const p = req.url!.split("?")[0];
		if (p === "/") {
			res.writeHead(200, {
				"Content-Type": "text/html",
			});
			res.end(PAGES[which]);
			return;
		}
		res.writeHead(404);
		res.end();
	});
}
export default Object.keys(PAGES).map((which) =>
	playwrightTest({
		name: "rv14-editor-" + which,
		fn: async ({ page, navigate }) => {
			const server = makeServer(which);
			await new Promise<void>((r) => server.listen(0, r));
			const port = (server.address() as any).port;
			const errs: string[] = [];
			page.on("pageerror", (e: Error) => errs.push(e.message));
			page.on("console", (m: any) => {
				if (m.type() === "error" || m.type() === "warning")
					errs.push("console: " + m.text().slice(0, 300));
			});
			page.on("requestfailed", (q: any) =>
				errs.push("reqfail " + decodeURIComponent(q.url()).slice(0, 200))
			);
			page.on("response", (q: any) => {
				if (q.status() >= 400)
					errs.push(
						"resp " +
							q.status() +
							" " +
							decodeURIComponent(q.url()).slice(0, 200)
					);
			});
			try {
				await navigate(`http://localhost:${port}/`);
				const fr = () =>
					page
						.frames()
						.find((f: any) => f.url().includes("localhost%3A" + port));
				let r: any = null;
				for (let i = 0; i < 40; i++) {
					r = await fr()
						?.evaluate("JSON.stringify(window.__r)")
						.catch(() => null);
					if (r && (JSON.parse(r).done || JSON.parse(r).err)) break;
					await new Promise((x) => setTimeout(x, 500));
				}
				console.log(
					"RV14EDITOR " +
						which +
						" " +
						String(r).replace(/localhost:\d+/g, "H") +
						"\nERRS " +
						JSON.stringify(errs)
				);
			} finally {
				server.closeAllConnections();
				server.close();
			}
		},
	})
);
export async function collect(evalFn: (s: string) => Promise<any>) {
	let r: any = null;
	for (let i = 0; i < 30; i++) {
		r = await evalFn("JSON.stringify(window.__r)").catch(() => null);
		if (r && (JSON.parse(r).done || JSON.parse(r).err)) break;
		await new Promise((x) => setTimeout(x, 500));
	}
	return JSON.stringify([r]);
}
