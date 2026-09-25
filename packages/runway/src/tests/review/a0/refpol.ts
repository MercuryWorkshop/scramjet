import { htmlTest } from "../../../testcommon.ts";
const pols = [
	"",
	"no-referrer",
	"origin",
	"strict-origin-when-cross-origin",
	"unsafe-url",
	"same-origin",
];
export default [
	htmlTest({
		name: "rv0-refpol-cdn-script",
		html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
runTest(async () => {
	const out = {};
	for (const p of ${JSON.stringify(pols)}) {
		out[p || "none"] = await new Promise((res) => {
			const s = document.createElement("script");
			if (p) s.referrerPolicy = p;
			s.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js?rp=" + (p || "none");
			s.onload = () => res("load"); s.onerror = () => res("error");
			document.head.append(s);
			setTimeout(() => res("timeout"), 8000);
		});
	}
	const m = document.createElement("meta"); m.name = "referrer"; m.content = "no-referrer"; document.head.append(m);
	out.meta_no_referrer = await new Promise((res) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js?rp=meta"; s.onload = () => res("load"); s.onerror = () => res("error"); document.head.append(s); setTimeout(() => res("timeout"), 8000); });
	assertConsistent("refpol", out);
	fail("REFPOL " + JSON.stringify(out));
}, false);
</script></body></html>`,
	}),
];
