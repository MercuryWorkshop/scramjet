import { htmlTest, type Test } from "../../../testcommon.ts";

export default [
	htmlTest({
		name: "rv6-col-oneline",
		html: `<!doctype html><body><script>addEventListener("error", (e) => { window.__ev = e.lineno + ":" + e.colno; e.preventDefault(); });</script>
<script>var a = 1; window.__st = (new Error("s")).stack.split("\\n")[1]; function f() { throw new Error("x"); } f();</script>
<script>"use strict"; window.__st2 = (new Error("s")).stack.split("\\n")[1];</script>
<script>
runTest(async () => {
  const pos = (s) => (s.match(/:(\\d+:\\d+)\\)?$/) || [])[1];
  throw new Error("RESULT ev=" + window.__ev + " st=" + pos(window.__st) + " st2=" + pos(window.__st2) + " raw=" + window.__st);
});
</script></body>`,
	}),
] as Test[];
