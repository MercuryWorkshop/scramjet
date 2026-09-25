import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-table-context",
		js: `
			const R = {};
			const rec = (k, f) => { try { R[k] = f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message.slice(0, 120); } };
			const t = document.createElement("table");
			document.body.appendChild(t);
			rec("table", () => { t.innerHTML = "<tr><td>1</td></tr>"; return t.innerHTML; });
			const tb = t.createTBody();
			rec("tbody", () => { tb.innerHTML = "<tr><td><a href='/r'>1</a></td><td>2</td></tr><tr><td>3</td></tr>"; return [tb.rows.length, tb.innerHTML]; });
			const tr = tb.insertRow();
			rec("tr", () => { tr.innerHTML = "<td>x</td><th>y</th>"; return [tr.cells.length, tr.innerHTML]; });
			rec("thead iah", () => { const th = t.createTHead(); th.insertAdjacentHTML("beforeend", "<tr><th>h</th></tr>"); return th.innerHTML; });
			rec("tr outer", () => { const r = tb.rows[0]; r.outerHTML = "<tr><td>replaced</td></tr>"; return tb.rows[0].innerHTML; });
			rec("td iah afterend", () => { const c = tb.rows[0].cells[0]; c.insertAdjacentHTML("afterend", "<td>after</td>"); return tb.rows[0].innerHTML; });
			const sel = document.createElement("select");
			rec("select", () => { sel.innerHTML = "<option value=1>a</option><optgroup label=g><option>b</option></optgroup>"; return [sel.options.length, sel.innerHTML]; });
			const cg = document.createElement("colgroup");
			t.appendChild(cg);
			rec("colgroup", () => { cg.innerHTML = "<col span=2><col>"; return cg.innerHTML; });
			rec("range tr", () => { const r = document.createRange(); r.selectNodeContents(tb); const f = r.createContextualFragment("<tr><td>rng</td></tr>"); return f.childNodes.length + ":" + (f.firstChild && f.firstChild.nodeName); });
			rec("unsafe tbody", () => { tb.setHTMLUnsafe("<tr><td>u</td></tr>"); return tb.innerHTML; });
			const ta = document.createElement("template");
			rec("template tr", () => { ta.innerHTML = "<tr><td>t</td></tr>"; return ta.content.firstChild && ta.content.firstChild.nodeName; });
			const frameset = document.createElement("frameset");
			rec("frameset", () => { frameset.innerHTML = "<frame src='/f'>"; return frameset.innerHTML; });
			const html = document.createElement("html");
			rec("html el", () => { html.innerHTML = "<head><title>x</title></head><body><p>b</p></body>"; return html.innerHTML; });
			const head = document.createElement("head");
			rec("head", () => { head.innerHTML = "<title>t</title><meta charset=utf-8><link rel=x href=/l>"; return head.innerHTML; });
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" ? R[k] : JSON.stringify(R[k]));
		`,
	}),
];
