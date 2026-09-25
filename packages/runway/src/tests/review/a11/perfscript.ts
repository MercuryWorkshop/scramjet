import { probeTest } from "./lib.ts";

const small = "window.__n=(window.__n||0)+1;";
const med =
	"(function(){var a=[];for(var i=0;i<10;i++){a.push(i*2)}window.__m=a.join(',');if(location.hash){window.__h=1}})();".repeat(
		20
	);

export default [
	probeTest({
		name: "rv11-perf-script-insert",
		timeout: 60000,
		probes: {
			text_small_x1000: `const t0 = performance.now(); for (let i = 0; i < 1000; i++) { const s = document.createElement('script'); s.text = ${JSON.stringify(small)}; document.head.appendChild(s); s.remove(); } return [+(performance.now() - t0).toFixed(1), window.__n];`,
			textContent_med_x300: `const t0 = performance.now(); for (let i = 0; i < 300; i++) { const s = document.createElement('script'); s.textContent = ${JSON.stringify(med)}; document.head.appendChild(s); s.remove(); } return +(performance.now() - t0).toFixed(1);`,
			ld_json_x1000: `const t0 = performance.now(); for (let i = 0; i < 1000; i++) { const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = '{"@type":"Thing","name":"x' + i + '"}'; document.head.appendChild(s); s.remove(); } return +(performance.now() - t0).toFixed(1);`,
			template_script_x300: `const t0 = performance.now(); for (let i = 0; i < 300; i++) { const s = document.createElement('script'); s.type = 'text/template'; s.innerHTML = '<div class="x"><a href="/y">' + i + '</a></div>'; document.body.appendChild(s); s.innerHTML; s.remove(); } return +(performance.now() - t0).toFixed(1);`,
			src_x300: `const t0 = performance.now(); for (let i = 0; i < 300; i++) { const s = document.createElement('script'); s.src = '/nope' + i + '.js'; s.async = true; document.head.appendChild(s); s.remove(); } return +(performance.now() - t0).toFixed(1);`,
			read_text_x5000: `const s = document.createElement('script'); s.textContent = ${JSON.stringify(med)}; document.head.appendChild(s); const t0 = performance.now(); for (let i = 0; i < 5000; i++) { s.textContent.length; } return +(performance.now() - t0).toFixed(1);`,
		},
	}),
];
