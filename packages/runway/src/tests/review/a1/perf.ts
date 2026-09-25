import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv1-perf-iframe-client-install",
		js: `
			// every about:blank iframe the page touches gets a full client install.
			// main: ~9ms median; develop: ~60-70ms (saveNatives walks every
			// interface's prototype chain, and every GlobalScope Intercept copies
			// all ~1200 window descriptors twice)
			const times = [];
			for (let i = 0; i < 12; i++) {
				const f = document.createElement("iframe");
				document.body.appendChild(f);
				const t = performance.now();
				f.contentWindow.document;
				times.push(performance.now() - t);
			}
			times.sort((a, b) => a - b);
			const median = times[6];
			assert(median < 30, "median per-iframe client install " + median.toFixed(1) + "ms (threshold 30ms)");
		`,
	}),
	basicTest({
		name: "rv1-perf-dom-insertion-hot-path",
		js: `
			// µs per op. main (Chrome): append(text) ~0.4, appendChild+remove ~0.4,
			// textContent get ~0.3. develop: ~4.5 / ~2.1 / ~1.6
			const bench = (fn, n) => { fn(0); const t = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - t) * 1000 / n; };
			const d = document.createElement("div");
			document.body.appendChild(d);
			const append = bench(() => { d.append("x"); d.firstChild.remove(); }, 20000);
			const appendChild = bench(() => { const s = document.createElement("span"); d.appendChild(s); s.remove(); }, 20000);
			const text = bench(() => d.textContent, 20000);
			const msg = "append(text) " + append.toFixed(2) + "us, appendChild+remove " + appendChild.toFixed(2) + "us, textContent " + text.toFixed(2) + "us";
			assert(append < 1.5 && appendChild < 1.2 && text < 1, msg);
		`,
	}),
];
