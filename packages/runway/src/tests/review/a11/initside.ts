import { probeTest } from "./lib.ts";

export default [
	probeTest({
		name: "rv11-init-side-effects",
		head: `<script>
			window.__reports = [];
			try { new ReportingObserver((rs) => { for (const r of rs) window.__reports.push(r.type + ':' + (r.body && (r.body.id || r.body.message || '')).slice(0, 80)); }, { buffered: true }).observe(); } catch (e) { window.__reports.push('RO ' + e); }
			window.__early = { ss: typeof speechSynthesis, perfEntries: performance.getEntriesByType('resource').length };
		</script>`,
		probes: {
			reports: `await new Promise(r => setTimeout(r, 500)); return window.__reports;`,
			iframe_reports: `const f = document.createElement('iframe'); document.body.appendChild(f); const w = f.contentWindow; const out = []; try { new w.ReportingObserver((rs) => { for (const r of rs) out.push(r.type + ':' + (r.body && (r.body.id || r.body.message || '')).slice(0, 80)); }, { buffered: true }).observe(); } catch (e) { out.push('RO ' + e); } await new Promise(r => setTimeout(r, 500)); return out;`,
			voices: `return speechSynthesis.getVoices().length >= 0;`,
			layout_forced: `return performance.getEntriesByType('layout-shift').length;`,
		},
	}),
];
