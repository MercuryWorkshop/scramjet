import { htmlTest } from "../../../testcommon.ts";

const markup = `<img id="i" src="/r.png" crossorigin="use-credentials" integrity="sha256-x" referrerpolicy="origin" loading="lazy" decoding="sync" fetchpriority="low" sizes="10px" width="1">
<link id="l" rel="preload" as="image" href="/p.png" imagesrcset="/p1.png 1x, /p2.png 2x" imagesizes="10px" crossorigin integrity="sha384-y" media="(min-width:1px)" type="image/png" referrerpolicy="no-referrer" fetchpriority="high">
<script id="s" src="/nope.js" integrity="sha512-z" crossorigin="anonymous" nonce="abc" referrerpolicy="origin" async defer type="text/javascript" fetchpriority="low"></script>
<video id="v" src="/v.webm" poster="/po.png" crossorigin preload="none"><source id="so" src="/s.webm" type="video/webm" media="all"><track id="t" src="/t.vtt"></video>
<object id="o" data="/o.svg" codebase="/cb/" type="image/svg+xml"></object><embed id="e" src="/e.svg" type="image/svg+xml">
<a id="a" href="/h" ping="/p1 /p2" download="f.txt" referrerpolicy="no-referrer" rel="noopener" target="_blank" hreflang="en" type="text/html">a</a>
<table id="tb" background="/tbg.png"><tr><td id="td" background="/tdbg.png">x</td></tr></table><body-ish></body-ish>
<svg><image id="si" href="/si.png" crossorigin="anonymous"/><a id="sa" href="/sa"><text>t</text></a><use id="su" href="/sp.svg#i"/></svg>
<iframe id="f" src="/f.html" loading="lazy" referrerpolicy="origin" allow="camera" sandbox="allow-scripts" credentialless></iframe>
<form id="fm" action="/act"><button id="btn" formaction="/fa">b</button><input id="in" type="image" src="/in.png"></form>
<audio id="au" src="/a.webm" crossorigin="anonymous"></audio>`;

const ids = [
	"i",
	"l",
	"s",
	"v",
	"so",
	"t",
	"o",
	"e",
	"a",
	"tb",
	"td",
	"si",
	"sa",
	"su",
	"f",
	"fm",
	"btn",
	"in",
	"au",
];

export default [
	htmlTest({
		name: "rv7-media-attrs",
		html: `<!doctype html><html><head></head><body>${markup}
<script>
runTest(async () => {
	const R = {__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'};
	const O = location.origin;
	for (const id of ${JSON.stringify(ids)}) {
		const el = document.getElementById(id);
		const attrs = [...el.attributes].map(a => a.name + '=' + a.value).join(' | ');
		R['attrs_' + id] = JSON.stringify([attrs, el.getAttributeNames().join(','), el.outerHTML.replaceAll(O, 'O').slice(0, 400)]);
	}
	const i = document.getElementById('i');
	R.props_img = JSON.stringify([i.crossOrigin, i.referrerPolicy, i.loading, i.decoding, i.fetchPriority, i.sizes, i.src.replace(O,'')]);
	const l = document.getElementById('l');
	R.props_link = JSON.stringify([l.as, l.crossOrigin, l.integrity, l.imageSrcset.replaceAll(O,''), l.imageSizes, l.media, l.type, l.referrerPolicy, l.href.replace(O,'')]);
	const s = document.getElementById('s');
	R.props_script = JSON.stringify([s.integrity, s.crossOrigin, s.nonce, s.getAttribute('nonce'), s.referrerPolicy, s.async, s.defer, s.src.replace(O,'')]);
	const v = document.getElementById('v');
	R.props_video = JSON.stringify([v.crossOrigin, v.preload, v.poster.replace(O,''), v.src.replace(O,''), document.getElementById('so').src.replace(O,''), document.getElementById('t').src.replace(O,'')]);
	const o = document.getElementById('o');
	R.props_object = JSON.stringify([o.data.replace(O,''), o.codeBase, document.getElementById('e').src.replace(O,'')]);
	const a = document.getElementById('a');
	R.props_a = JSON.stringify([a.ping, a.download, a.referrerPolicy, a.rel, a.target, a.href.replace(O,'')]);
	R.props_svg = JSON.stringify([document.getElementById('si').href.baseVal, document.getElementById('sa').href.baseVal, document.getElementById('su').href.animVal]);
	const f = document.getElementById('f');
	R.props_iframe = JSON.stringify([f.loading, f.referrerPolicy, f.allow, String(f.sandbox), f.credentialless, f.src.replace(O,'')]);
	R.props_form = JSON.stringify([document.getElementById('fm').action.replace(O,''), document.getElementById('btn').formAction.replace(O,''), document.getElementById('in').src.replace(O,'')]);
	// set via JS then read back
	const j = document.createElement('img'); j.crossOrigin = 'anonymous'; j.referrerPolicy = 'no-referrer'; j.loading = 'lazy'; j.integrity = 'x'; j.setAttribute('integrity','sha256-q');
	R.js_img = JSON.stringify([j.outerHTML, j.getAttributeNames().join(',')]);
	const js = document.createElement('script'); js.integrity = 'sha256-w'; js.nonce = 'n1'; js.crossOrigin = 'use-credentials';
	R.js_script = JSON.stringify([js.outerHTML, js.integrity, js.nonce, js.getAttribute('nonce')]);
	const jl = document.createElement('link'); jl.rel = 'preload'; jl.as = 'font'; jl.crossOrigin = ''; jl.integrity = 'sha256-v'; jl.imageSrcset = '/a.png 1x';
	R.js_link = JSON.stringify([jl.outerHTML.replaceAll(O,'O'), jl.integrity, jl.imageSrcset.replaceAll(O,'')]);
	R.qs = JSON.stringify([document.querySelectorAll('[integrity]').length, document.querySelectorAll('[crossorigin]').length, document.querySelectorAll('[nonce]').length, document.querySelectorAll('[loading=lazy]').length, document.querySelectorAll('[ping]').length, document.querySelectorAll('[background]').length, document.querySelectorAll('[poster]').length, document.querySelectorAll('script[integrity^="sha512"]').length]);
	console.log('RV7PROBE ' + JSON.stringify(R));
	fail('done');
}, false);
</script></body></html>`,
	}),
];
