import { basicTest } from "../../../testcommon.ts";

const childScript = `<script>const r=[];try{history.replaceState({a:1},'',location.href);r.push('replace-ok')}catch(e){r.push('replace-'+e.name)}try{history.pushState(null,'','#frag');r.push('hash-ok '+location.hash)}catch(e){r.push('hash-'+e.name)}parent.postMessage(JSON.stringify(r),'*');<\/script>`;

export default [
	basicTest({
		name: "rv7-history-srcdoc-blob",
		autoPass: false,
		js: `
		const run = (setup) => new Promise((resolve) => {
			const h = (e) => { removeEventListener('message', h); resolve(e.data); };
			addEventListener('message', h);
			const f = document.createElement('iframe');
			setup(f);
			document.body.appendChild(f);
			setTimeout(() => resolve('TIMEOUT'), 5000);
		});
		const srcdoc = await run((f) => { f.srcdoc = ${JSON.stringify(childScript)}; });
		const blob = await run((f) => { f.src = URL.createObjectURL(new Blob([${JSON.stringify(childScript)}], {type: 'text/html'})); });
		const expect = JSON.stringify(['replace-ok', 'hash-ok #frag']);
		assertEqual(JSON.stringify([srcdoc, blob]), JSON.stringify([expect, expect]), 'srcdoc and blob iframe history');
		pass();
		`,
	}),
];
