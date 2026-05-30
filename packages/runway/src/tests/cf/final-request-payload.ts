import { basicTest } from "../../testcommon.ts";

// Ported from data4 deobfuscated final attestation request payload:
// internal-cf-reverse/data4/inner.js_translated.js:4287-4333
//
// After the time-check gate and lifted VM entry run, Turnstile schedules the
// final request with a large payload object. This mirrors the individual field
// mapping and constants so runway catches regressions in the payload-shaping
// behavior, including fields populated by the lifted VM probes (BPOu4, GGBX7,
// apgEV8, xHzMd3) and timing deltas.

export default basicTest({
	name: "cf-final-request-payload",
	js: `
		const cfOpt = {
			vKOHo9: "vKOHo9-value",
			eYAhL6: "eYAhL6-value",
			jylK3: 1700,
			pXJhn0: 1250,
			jruHQ2: 2600,
			KzXIP8: 2000,
			CjLF6: "CjLF6-value",
			yiuuz4: "yiuuz4-value",
			nwyQB9: "nwyQB9-value",
			ArxN5: "ArxN5-value",
			iUFw3: "iUFw3-value",
			mJFtX5: { lang: navigator.language },
			yqTs7: "yqTs7-value",
			IThaC9: "IThaC9-value",
			IaLa3: "IaLa3-value",
			VoOn0: "VoOn0-value",
			dfppG1: "dfppG1-value",
			YyXhA9: "YyXhA9-value",
			TNXB9: "TNXB9-value",
			MIHUr2: "MIHUr2-value",
			UPWX8: "UPWX8-value",
			PqZJ2: "PqZJ2-value",
			Lgky2: "Lgky2-value",
			QALJ4: "QALJ4-value",
			ATpc7: "ATpc7-value",
			InJL2: "InJL2-value",
			kAtRR1: "kAtRR1-value",
			mUTV7: "mUTV7-value",
			NokC2: "NokC2-value",
			wWPia3: "wWPia3-value",
			DlSI3: "DlSI3-value",
			HGlVr6: "HGlVr6-value",
			vCBB5: "vCBB5-value",
			QVzL3: 900,
			jqEN9: 333,
			Xmve5: "Xmve5-value",
			lrZhP0: "lrZhP0-value",
		};

		const b = {
			_cf_chl_opt: cfOpt,
			xdoj0: "xdoj0-value",
			BPOu4: ["body", "div[data-cf]"],
			GGBX7: "WdHvL7",
		};

		function xUzqp(value, amount) {
			return value + ":" + amount;
		}

		const payload = {
			cYQj9: b._cf_chl_opt.vKOHo9,
			eYAhL6: b._cf_chl_opt.eYAhL6,
			ufKG9: 0,
			nMsn8: 0,
			TCaE4: b._cf_chl_opt.jylK3 - b._cf_chl_opt.pXJhn0,
			ZMBdA4: b._cf_chl_opt.jruHQ2 - b._cf_chl_opt.KzXIP8,
			UWEaD6: b._cf_chl_opt.jruHQ2 - b._cf_chl_opt.KzXIP8,
			nFiGr8: 1,
			CjLF6: b._cf_chl_opt.CjLF6,
			yiuuz4: b._cf_chl_opt.yiuuz4,
			SCdEB1: xUzqp(b._cf_chl_opt.nwyQB9, 1),
			xdoj0: b.xdoj0,
			ArxN5: b._cf_chl_opt.ArxN5,
			iUFw3: b._cf_chl_opt.iUFw3,
			jwadD3: "EDXD9",
			gNTwy6: "",
			BPOu4: JSON.stringify(b.BPOu4),
			GGBX7: b.GGBX7,
			apgEV8: 0,
			xHzMd3: "LlXf4",
			eRXJU4: b._cf_chl_opt.mJFtX5.lang,
			yqTs7: b._cf_chl_opt.yqTs7,
			IThaC9: b._cf_chl_opt.IThaC9,
			IaLa3: b._cf_chl_opt.IaLa3,
			VoOn0: b._cf_chl_opt.VoOn0,
			dfppG1: b._cf_chl_opt.dfppG1,
			YyXhA9: b._cf_chl_opt.YyXhA9,
			TNXB9: b._cf_chl_opt.TNXB9,
			MIHUr2: b._cf_chl_opt.MIHUr2,
			UPWX8: b._cf_chl_opt.UPWX8,
			PqZJ2: b._cf_chl_opt.PqZJ2,
			Lgky2: b._cf_chl_opt.Lgky2,
			QALJ4: b._cf_chl_opt.QALJ4,
			ATpc7: b._cf_chl_opt.ATpc7,
			InJL2: b._cf_chl_opt.InJL2,
			kAtRR1: b._cf_chl_opt.kAtRR1,
			mUTV7: b._cf_chl_opt.mUTV7,
			NokC2: b._cf_chl_opt.NokC2,
			wWPia3: b._cf_chl_opt.wWPia3,
			DlSI3: b._cf_chl_opt.DlSI3,
			HGlVr6: b._cf_chl_opt.HGlVr6,
			vCBB5: b._cf_chl_opt.vCBB5,
			AbIbl8: b._cf_chl_opt.QVzL3 - b._cf_chl_opt.jqEN9,
			Xmve5: b._cf_chl_opt.Xmve5,
			lrZhP0: b._cf_chl_opt.lrZhP0,
		};

		const expectedKeys = [
			"cYQj9", "eYAhL6", "ufKG9", "nMsn8", "TCaE4", "ZMBdA4", "UWEaD6", "nFiGr8",
			"CjLF6", "yiuuz4", "SCdEB1", "xdoj0", "ArxN5", "iUFw3", "jwadD3", "gNTwy6",
			"BPOu4", "GGBX7", "apgEV8", "xHzMd3", "eRXJU4", "yqTs7", "IThaC9", "IaLa3",
			"VoOn0", "dfppG1", "YyXhA9", "TNXB9", "MIHUr2", "UPWX8", "PqZJ2", "Lgky2",
			"QALJ4", "ATpc7", "InJL2", "kAtRR1", "mUTV7", "NokC2", "wWPia3", "DlSI3",
			"HGlVr6", "vCBB5", "AbIbl8", "Xmve5", "lrZhP0",
		];

		assertConsistent("final-request-payload-keys", Object.keys(payload));
		assert(JSON.stringify(Object.keys(payload)) === JSON.stringify(expectedKeys),
			"final payload keys should match data4 translated payload order");
		assert(payload.TCaE4 === 450, "TCaE4 should be jylK3 - pXJhn0");
		assert(payload.ZMBdA4 === 600 && payload.UWEaD6 === 600,
			"ZMBdA4 and UWEaD6 should mirror jruHQ2 - KzXIP8");
		assert(payload.AbIbl8 === 567, "AbIbl8 should be QVzL3 - jqEN9");
		assert(payload.BPOu4 === JSON.stringify(b.BPOu4), "BPOu4 should be JSON encoded");
		assert(payload.jwadD3 === "EDXD9", "jwadD3 constant should match data4");
		assert(payload.gNTwy6 === "", "gNTwy6 constant should be an empty string");
		assert(payload.apgEV8 === 0, "apgEV8 final payload default should be 0");
		assert(payload.xHzMd3 === "LlXf4", "xHzMd3 final payload default should match data4");
	`,
});
