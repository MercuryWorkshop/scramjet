import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-perfjs-computed",
		js: `
			const o = { a: 1, b: 2, c: 3, d: 4 };
			const keys = ["a", "b", "c", "d"];
			let t0 = performance.now(), s = 0;
			for (let i = 0; i < 2000000; i++) s += o[keys[i & 3]];
			const computed = performance.now() - t0;
			t0 = performance.now();
			for (let i = 0; i < 2000000; i++) s += o.a;
			const dotted = performance.now() - t0;
			t0 = performance.now();
			for (let i = 0; i < 200000; i++) { for (const k in o) s += o[k]; }
			const forin = performance.now() - t0;
			fail("TIMING js computed=" + computed.toFixed(0) + " dotted=" + dotted.toFixed(0) + " forin=" + forin.toFixed(0) + " " + s);
		`,
	}),
];
