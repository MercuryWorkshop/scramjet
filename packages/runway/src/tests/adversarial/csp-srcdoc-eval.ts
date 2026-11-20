import { htmlTest } from "../../testcommon.ts";

function test(name: string, markup: string, js: string) {
	return htmlTest({
		name: `csp-srcdoc-eval-${name}`,
		html: `<!doctype html><body><script>runTest(async () => {
      const frame = document.createElement("iframe");
      const loaded = new Promise(resolve => { frame.onload = resolve; });
      frame.srcdoc = ${JSON.stringify(markup).replaceAll("</script", "<\\/script")};
      document.body.appendChild(frame);
      await loaded;
      const child = frame.contentWindow;
      function rejects(fn) {
        let error;
        try { fn(); } catch (e) { error = e; }
        assert(error instanceof child.EvalError, "CSP rejects with EvalError");
      }
      ${js}
      frame.remove();
    }, true);</script>`,
	});
}

const meta = (policy: string) =>
	`<meta http-equiv="Content-Security-Policy" content="${policy}">`;
const script = (source: string) => `<script nonce="test">${source}</script>`;
const nonceOnly = meta("script-src 'nonce-test'");

export default [
	test(
		"nonce",
		nonceOnly + script("window.nonceScriptRan = true"),
		`
    assertEqual(child.nonceScriptRan, true, "nonce script ran");
    rejects(() => child.eval("window.evalRan = true"));
    rejects(() => child.Function("return 42"));
    rejects(() => child.Function("}"));
    const coercions = [];
    rejects(() => child.Function({ toString() { coercions.push("parameter"); return "a"; } }, { toString() { coercions.push("body"); return "}"; } }));
    assertDeepEqual(coercions, ["parameter", "body"], "conversion precedes policy and syntax checks");
    assertEqual(child.evalRan, undefined, "blocked code never ran");
    assertEqual(child.eval(42), 42, "non-string eval is unaffected");
  `
	),
	test(
		"unsafe-eval",
		meta("script-src 'nonce-test' 'unsafe-eval'"),
		`
    assertEqual(child.eval("21 * 2"), 42, "unsafe-eval allows eval");
    assertEqual(child.Function("return 42")(), 42, "unsafe-eval allows Function");
  `
	),
	test(
		"default-src",
		meta("default-src 'none'"),
		`rejects(() => child.eval("0"));`
	),
	test(
		"script-overrides-default",
		meta("default-src 'none'; script-src 'unsafe-eval'"),
		`
    assertEqual(child.eval("42"), 42, "script-src takes precedence over default-src");
  `
	),
	test(
		"first-directive",
		meta("script-src 'unsafe-eval'; script-src 'none'"),
		`
    assertEqual(child.eval("42"), 42, "first occurrence wins");
  `
	),
	test(
		"multiple-policies",
		meta("script-src 'unsafe-eval'") + nonceOnly,
		`rejects(() => child.eval("0"));`
	),
	test(
		"body-meta",
		"<body>" + nonceOnly,
		`
    assertEqual(child.eval("42"), 42, "meta outside head is ignored");
  `
	),
	// known failure: the policy metas are read when a policy is asked about,
	// not watched for, so one removed before that is missed
	test(
		"removed-meta",
		nonceOnly +
			script(`
    const meta = document.querySelector("meta");
    meta.remove();
    meta.content = "script-src 'unsafe-eval'";
    try { eval("window.evalRan = true"); } catch (e) { window.evalBlocked = e instanceof EvalError; }
  `),
		`
    assertEqual(child.evalBlocked, true, "policy survives synchronous removal and edit");
    assertEqual(child.evalRan, undefined, "removed meta cannot relax the policy");
    rejects(() => child.eval("0"));
  `
	),
	test(
		"blank-inherits-meta",
		nonceOnly,
		`
    const nested = child.document.createElement("iframe");
    child.document.body.appendChild(nested);
    let error;
    try { nested.contentWindow.eval("0"); } catch (e) { error = e; }
    assert(error instanceof nested.contentWindow.EvalError, "blank document inherits meta policy");
  `
	),
	test(
		"meta-trusted-types",
		meta("require-trusted-types-for 'script'"),
		`
    const calls = [];
    child.trustedTypes.createPolicy("default", { createScript(value, type, sink) { calls.push([value, type, sink]); return value; } });
    assertEqual(child.eval("42"), 42, "meta default policy accepts eval");
    assertDeepEqual(calls, [["42", "TrustedScript", "eval"]], "meta policy invokes original callback");
  `
	),
];
