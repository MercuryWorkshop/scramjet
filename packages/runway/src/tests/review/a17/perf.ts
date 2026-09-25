import { basicTest } from "../../../testcommon.ts";

// Per-call cost of union / interface brand checks as realms accumulate.
// box.ctors[name] gains one constructor per realm ever registered and never
// shrinks, and box.instanceof walks the whole list. Always "fails" so the
// timings print; compare the numbers between builds.

export default [
	basicTest({
		name: "rv17-perf-realm-growth",
		autoPass: false,
		js: `
			const holder = document.createElement("div");
			document.body.append(holder);
			const N = 20000;
			const bench = () => {
				const out = {};
				let t = performance.now();
				for (let i = 0; i < N; i++) { holder.append("x"); if (holder.childNodes.length > 50) holder.textContent = ""; }
				out.appendStr = +(performance.now() - t).toFixed(1);
				holder.textContent = "";
				const b = document.createElement("b");
				t = performance.now();
				for (let i = 0; i < N; i++) holder.append(b);
				out.appendNode = +(performance.now() - t).toFixed(1);
				const span = document.createElement("span");
				t = performance.now();
				for (let i = 0; i < N; i++) span.innerHTML = "y";
				out.innerHTML = +(performance.now() - t).toFixed(1);
				t = performance.now();
				for (let i = 0; i < N; i++) holder.replaceChildren({ toString() { return "o"; } });
				out.replaceObj = +(performance.now() - t).toFixed(1);
				t = performance.now();
				for (let i = 0; i < N / 4; i++) new Request("/x");
				out.newRequestStr = +(performance.now() - t).toFixed(1);
				return out;
			};
			bench();
			const before = bench();
			const frames = [];
			const t0 = performance.now();
			const F = 300;
			for (let i = 0; i < F; i++) {
				const f = document.createElement("iframe");
				document.body.append(f);
				f.contentWindow;
				f.remove();
			}
			const hookMs = +(performance.now() - t0).toFixed(0);
			const after = bench();
			fail(JSON.stringify({ frames: F, hookMs, before, after }));
		`,
	}),
];
