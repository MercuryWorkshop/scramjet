import { basicTest } from "../../../testcommon.ts";

// An attribute observer that re-applies an inline style (same value) on every
// record. Natively an unchanged CSSOM write queues no mutation, so this settles.
export default [
	basicTest({
		name: "rv7-mo-style-feedback-loop",
		js: `
		const results = {};
		for (const mode of ['prop-same', 'setprop-same', 'prop-filter-style']) {
			const d = document.createElement('div');
			document.body.appendChild(d);
			d.style.color = 'red';
			let n = 0;
			const mo = new MutationObserver(() => {
				n++;
				if (n > 500) { mo.disconnect(); return; }
				if (mode === 'setprop-same') d.style.setProperty('color', 'red');
				else d.style.color = 'red';
			});
			mo.observe(d, mode === 'prop-filter-style' ? { attributes: true, attributeFilter: ['style'] } : { attributes: true });
			d.style.width = '10px';
			await new Promise((r) => setTimeout(r, 50));
			mo.disconnect();
			results[mode] = n;
		}
		console.log('RV7MOLOOP ' + JSON.stringify(results));
		assertConsistent('loop', JSON.stringify(results));
		assert(results['prop-same'] < 10 && results['setprop-same'] < 10, 'observer settles: ' + JSON.stringify(results));
		`,
	}),
];
