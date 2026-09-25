import { basicTest } from "../../../testcommon.ts";

const probes: Record<string, string> = {
	open_rel: `const w=window.open('/popup-a?x=1'); if(!w) return 'null'; await new Promise(r=>setTimeout(r,800)); const res=[w.location.href, w.document.URL, w.opener===window]; w.close(); return res;`,
	open_bare: `const w=open('/popup-b'); if(!w) return 'null'; await new Promise(r=>setTimeout(r,500)); const res=[w.location.pathname]; w.close(); return res;`,
	open_blank_write: `const w=window.open('', 'nm'+Math.random()); if(!w) return 'null'; w.document.write('<a href="/pw">x</a>'); w.document.close(); const res=[w.document.querySelector('a').href, w.location.href]; w.close(); return res;`,
	open_noargs: `const w=window.open(); if(!w) return 'null'; const res=[w.location.href]; w.close(); return res;`,
	open_urlobj: `const w=window.open(new URL('/popup-c', location.href)); if(!w) return 'null'; await new Promise(r=>setTimeout(r,500)); const res=[w.location.pathname]; w.close(); return res;`,
	open_features: `const w=window.open('/popup-d', '_blank', 'noopener'); return w;`,
	open_self_iframe: `const f=document.createElement('iframe'); f.name='tgt'; document.body.appendChild(f); window.open('/in-frame', 'tgt'); await new Promise(r=>setTimeout(r,800)); return f.contentWindow.location.pathname;`,
	open_call_frame_window: `const f=document.createElement('iframe'); document.body.appendChild(f); const w=window.open.call(f.contentWindow, '/pp', '_self'); await new Promise(r=>setTimeout(r,800)); return [w===f.contentWindow, f.contentWindow.location.pathname];`,
	doc_open3: `const f=document.createElement('iframe'); f.name='d3'; document.body.appendChild(f); const w=document.open('/via-doc-open', 'd3', ''); await new Promise(r=>setTimeout(r,800)); return [w===f.contentWindow, f.contentWindow.location.pathname];`,
	location_assign_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); f.contentWindow.location.assign('/assigned'); await new Promise(r=>f.onload=r); return f.contentWindow.location.pathname;`,
	location_href_iframe: `const f=document.createElement('iframe'); document.body.appendChild(f); f.contentWindow.location.href='/hrefset?q=1'; await new Promise(r=>f.onload=r); return [f.contentWindow.location.pathname, f.contentWindow.location.search, f.contentDocument.URL];`,
	anchor_click_iframe: `const f=document.createElement('iframe'); f.name='ac'; document.body.appendChild(f); const a=document.createElement('a'); a.href='/anchor-target'; a.target='ac'; document.body.appendChild(a); a.click(); await new Promise(r=>f.onload=r); return f.contentWindow.location.pathname;`,
	form_submit_iframe: `const f=document.createElement('iframe'); f.name='fs'; document.body.appendChild(f); const fm=document.createElement('form'); fm.action='/formed'; fm.target='fs'; document.body.appendChild(fm); fm.submit(); await new Promise(r=>f.onload=r); return f.contentWindow.location.pathname;`,
	frameElement_from_child: `const f=document.createElement('iframe'); f.src='/child-fe'; document.body.appendChild(f); await new Promise(r=>f.onload=r); return [f.contentWindow.frameElement===f, f.contentWindow.parent===window, f.contentWindow.top===window.top];`,
};

export default [
	basicTest({
		name: "rv7-open-probe",
		autoPass: false,
		js: `
		const probes = {${Object.entries(probes)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {};
		for (const [k, v] of Object.entries(probes)) {
			console.log('RV7STEP ' + k);
			try {
				const res = await Promise.race([v(), new Promise(r=>setTimeout(()=>r('TIMEOUT'), 3000))]);
				out[k] = JSON.stringify(res);
			} catch (e) {
				out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message);
			}
		}
		console.log('RV7PROBE ' + JSON.stringify(out));
		fail('RV7PROBE ' + JSON.stringify(out));
		`,
	}),
];
