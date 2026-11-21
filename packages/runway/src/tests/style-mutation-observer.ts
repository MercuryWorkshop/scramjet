import { basicTest } from "../testcommon.ts";

// An attribute observer that re-applies an inline style (same value) on every
// record. Natively an unchanged CSSOM write queues no mutation, so this settles.
const settles = basicTest({
	name: "style-mutation-observer-settles",
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
		assertConsistent('loop', JSON.stringify(results));
		assert(results['prop-same'] < 10 && results['setprop-same'] < 10, 'observer settles: ' + JSON.stringify(results));
		`,
});

// Inline style writes with no URL in them, before and after one that had a
// URL: what the page reads back, and the records it gets, are the browser's.
// (A URL itself still reads back absolute and shows its mirror's records.)
const transitions = basicTest({
	name: "style-mirror-url-transitions",
	js: `
	const d = document.createElement('div');
	document.body.appendChild(d);
	const records = [];
	const mo = new MutationObserver((rs) => { for (const r of rs) records.push(r.attributeName + ':' + r.oldValue); });
	const seen = [];
	const look = () => seen.push([d.getAttribute('style'), d.style.cssText, d.getAttributeNames().join()]);
	mo.observe(d, { attributes: true, attributeOldValue: true });
	d.style.transform = 'translateX(1px)'; look();
	d.style.setProperty('--x', '3px'); look();
	d.style.removeProperty('transform'); look();
	d.style.cssText = 'left: 4px'; look();
	await new Promise((r) => setTimeout(r));
	assertConsistent('before', [seen.splice(0), records.splice(0)]);

	mo.disconnect();
	d.style.backgroundImage = 'url("/a.png")';
	d.style.removeProperty('background-image');
	await new Promise((r) => setTimeout(r));
	mo.observe(d, { attributes: true, attributeOldValue: true });
	d.style.top = '5px'; look();
	d.style.cssText = 'top: 6px'; look();
	await new Promise((r) => setTimeout(r));
	mo.disconnect();
	assertConsistent('after', [seen, records]);
	`,
});

export default [settles, transitions];
