import { probeTest } from "./lib.ts";

const load = (setup: string) =>
	`const f=document.createElement('iframe'); ${setup}; document.body.appendChild(f); await new Promise(r=>{f.onload=r; setTimeout(r,2000)});`;
const probes: Record<string, string> = {
	named_frame_window_name: `${load("f.name='myframe'; f.src='/deep/dir/child.html'")} return [f.contentWindow.name, window.frames['myframe']===f.contentWindow, f.name, f.getAttribute('name')];`,
	frame_location: `${load("f.src='/deep/dir/child.html?q=1#h'")} return [f.contentWindow.location.href.replace(/localhost:\\d+/,'L'), f.contentDocument.URL.replace(/localhost:\\d+/,'L'), f.contentDocument.referrer.replace(/localhost:\\d+/,'L')];`,
	frame_parent_access: `${load("f.src='/deep/dir/child.html'")} return [f.contentWindow.parent===window, f.contentWindow.top===window.top, f.contentWindow.frameElement===f, f.contentWindow.opener];`,
	target_link_into_frame: `${load("f.name='tgt'; f.src='/deep/dir/child.html'")} const a=document.createElement('a'); a.href='/deep/dir/child2.html'; a.target='tgt'; document.body.appendChild(a); const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); a.click(); await p; return f.contentWindow.location.pathname;`,
	form_target_frame: `${load("f.name='ft'; f.src='/deep/dir/child.html'")} const fm=document.createElement('form'); fm.action='/deep/dir/formdest'; fm.target='ft'; fm.method='GET'; const i=document.createElement('input'); i.name='k'; i.value='v'; fm.appendChild(i); document.body.appendChild(fm); const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); fm.submit(); await p; return f.contentWindow.location.pathname + f.contentWindow.location.search;`,
	window_open_named_frame: `${load("f.name='wo'; f.src='/deep/dir/child.html'")} const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); const w=window.open('/deep/dir/child3.html','wo'); await p; return [w===f.contentWindow, f.contentWindow.location.pathname];`,
	frame_loc_assign_from_parent: `${load("f.src='/deep/dir/child.html'")} const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); f.contentWindow.location.href='/deep/dir/c4.html'; await p; return f.contentWindow.location.pathname;`,
	frame_loc_replace_from_parent: `${load("f.src='/deep/dir/child.html'")} const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); f.contentWindow.location.replace('c5.html'); await p; return f.contentWindow.location.pathname;`,
	srcdoc_then_src: `${load("f.srcdoc='<p>sd</p>'")} const t1=f.contentDocument.body.innerHTML; const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); f.removeAttribute('srcdoc'); f.src='/deep/dir/child.html'; await p; return [t1, f.contentWindow.location.pathname];`,
	about_blank_write: `const f=document.createElement('iframe'); document.body.appendChild(f); const d=f.contentDocument; d.open(); d.write('<!doctype html><body><a href="rel">x</a><img src="/w.png"><script>window.__cw=location.href<\\/script></body>'); d.close(); return [d.querySelector('a').href.replace(/localhost:\\d+/,'L'), f.contentWindow.__cw.replace(/localhost:\\d+/,'L'), d.querySelector('img').getAttribute('src')];`,
	about_blank_location: `const f=document.createElement('iframe'); document.body.appendChild(f); return [f.contentWindow.location.href, f.contentDocument.URL, f.contentWindow.origin===window.origin, f.contentDocument.baseURI.replace(/localhost:\\d+/,'L')];`,
	child_postmessage_origin: `${load("f.src='/deep/dir/child.html'")} const p=new Promise(r=>{ addEventListener('message', function h(e){ if(e.data==='pong'){ removeEventListener('message',h); r([e.origin===location.origin, e.source===f.contentWindow]); } }); }); f.contentWindow.eval("parent.postMessage('pong', parent.location.origin)"); return await p;`,
	child_eval_location: `${load("f.src='/deep/dir/child.html'")} return f.contentWindow.eval('location.pathname');`,
	child_Function_location: `${load("f.src='/deep/dir/child.html'")} return new f.contentWindow.Function('return location.pathname')();`,
	child_setTimeout_string: `${load("f.src='/deep/dir/child.html'")} f.contentWindow.setTimeout('window.__st=location.pathname', 0); await new Promise(r=>setTimeout(r,50)); return f.contentWindow.__st;`,
	frames_length: `for (let i=0;i<3;i++){ document.body.appendChild(document.createElement('iframe')); } return [window.length>=3, frames.length===window.length, frames[0]===document.querySelector('iframe').contentWindow];`,
	remove_readd_iframe: `${load("f.src='/deep/dir/child.html'")} const p=new Promise(r=>{f.onload=r; setTimeout(r,2000)}); f.remove(); document.body.appendChild(f); await p; return [f.contentWindow.location.pathname, typeof f.contentWindow.eval('location.host')];`,
	iframe_lazy: `const f=document.createElement('iframe'); f.loading='lazy'; f.src='/deep/dir/child.html'; document.body.appendChild(f); await new Promise(r=>{f.onload=r; setTimeout(r,1500)}); return [f.loading, f.getAttribute('loading')];`,
	iframe_allow: `const f=document.createElement('iframe'); f.allow='autoplay; fullscreen'; f.allowFullscreen=true; f.referrerPolicy='no-referrer'; return [f.allow, f.allowFullscreen, f.referrerPolicy, f.getAttribute('referrerpolicy')];`,
	iframe_sandbox_rw: `const f=document.createElement('iframe'); f.sandbox='allow-scripts allow-same-origin'; f.sandbox.add('allow-forms'); return [f.sandbox.value, f.getAttribute('sandbox'), f.sandbox.length, f.sandbox.contains('allow-forms'), f.sandbox.supports ? f.sandbox.supports('allow-popups') : 'n/a'];`,
	iframe_sandbox_setattr: `const f=document.createElement('iframe'); f.setAttribute('sandbox','allow-scripts'); return [f.sandbox.value, f.sandbox.length, [...f.sandbox]];`,
	sandboxed_frame_msg: `const f=document.createElement('iframe'); f.setAttribute('sandbox','allow-scripts'); f.srcdoc='<script>parent.postMessage({o:self.origin}, "*")<\\/script>'; const p=new Promise(r=>{ addEventListener('message', function h(e){ if(e.data&&e.data.o!==undefined){ removeEventListener('message',h); r([e.origin, e.data.o]); } }); setTimeout(()=>r('none'),2000); }); document.body.appendChild(f); return await p;`,
	sandboxed_frame_send_origin: `const f=document.createElement('iframe'); f.setAttribute('sandbox','allow-scripts'); f.src='/deep/dir/sbx.html'; document.body.appendChild(f); await new Promise(r=>{f.onload=r; setTimeout(r,2000)}); const p=new Promise(r=>{ addEventListener('message', function h(e){ if(e.data==='ack'){ removeEventListener('message',h); r('ack'); } }); setTimeout(()=>r('no-ack'),1500); }); f.contentWindow.postMessage('ping', location.origin); return await p;`,
};

export default [
	probeTest({
		name: "rv10-frames",
		probes,
		timeout: 4000,
		extra: (req, res) => {
			const u = req.url.split("?")[0];
			if (u.startsWith("/deep/dir/") && u !== "/deep/dir/page.html") {
				res.writeHead(200, {
					"Content-Type": "text/html",
				});
				if (u === "/deep/dir/sbx.html") {
					res.end(
						`<!doctype html><body><script>addEventListener('message', e => { if (e.data === 'ping') parent.postMessage('ack', '*'); });</script></body>`
					);
				} else res.end(`<!doctype html><body><p>${u}</p></body>`);
				return true;
			}
			return false;
		},
	}),
];
