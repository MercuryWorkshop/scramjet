import { basicTest } from "../../../testcommon.ts";

// rv19: cost of hot storage paths.

export default [
	basicTest({
		name: "rv19-perf-storage-hot",
		js: `
			localStorage.clear();
			for (let i = 0; i < 50; i++) localStorage.setItem("k" + i, "v" + i);
			const time = (f, n) => { const t = performance.now(); for (let i = 0; i < n; i++) f(i); return +((performance.now() - t) / n * 1000).toFixed(2); };
			const out = {
				getItem_us: time((i) => localStorage.getItem("k" + (i % 50)), 20000),
				named_us: time((i) => localStorage["k" + (i % 50)], 20000),
				setItem_us: time((i) => localStorage.setItem("k" + (i % 50), "x"), 5000),
				ssGet_us: time((i) => sessionStorage.getItem("x"), 20000),
				keys_us: time(() => Object.keys(localStorage), 500),
				json_us: time(() => JSON.stringify(localStorage), 500),
				cookieRead_us: time(() => document.cookie, 5000),
				bcNew_us: time(() => new BroadcastChannel("c").close(), 2000),
			};
			localStorage.clear();
			fail("PERF " + JSON.stringify(out));
		`,
	}),
];
