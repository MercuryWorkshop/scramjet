import { htmlTest } from "../../testcommon.ts";

function policyTest(name: string, js: string, required = true) {
	return htmlTest({
		name: `trusted-types-${name}`,
		headers: required
			? { "Content-Security-Policy": "require-trusted-types-for 'script'" }
			: {},
		html: `<!doctype html><body><script>runTest(async () => {
      const frame = document.createElement("iframe");
      document.body.appendChild(frame);
      const child = frame.contentWindow;
      const div = child.document.createElement("div");
      ${js}
      frame.remove();
    }, true);</script>`,
	});
}

export default [
	policyTest(
		"trusted-value-bypasses-default",
		`
    const trusted = child.trustedTypes.createPolicy("typed", {
      createHTML: value => value,
      createScript: value => value,
      createScriptURL: value => value
    });
    child.trustedTypes.createPolicy("default", {
      createHTML() { throw new Error("unexpected default HTML"); },
      createScript() { throw new Error("unexpected default script"); },
      createScriptURL() { throw new Error("unexpected default URL"); }
    });
    div.innerHTML = trusted.createHTML("<b>trusted</b>");
    assertEqual(div.textContent, "trusted", "TrustedHTML accepted");
    const script = child.document.createElement("script");
    script.src = trusted.createScriptURL("data:,0");
    assertEqual(script.src, "data:,0", "TrustedScriptURL accepted");
    assertEqual(child.eval(trusted.createScript("6 * 7")), 42, "TrustedScript accepted");
  `
	),
	policyTest(
		"default-policy-without-requirement",
		`
    child.trustedTypes.createPolicy("default", {
      createHTML() { throw new Error("unexpected default HTML"); },
      createScript() { throw new Error("unexpected default script"); },
      createScriptURL() { throw new Error("unexpected default URL"); }
    });
    div.innerHTML = "<b>ordinary</b>";
    assertEqual(div.textContent, "ordinary", "plain HTML accepted without a requirement");
    assertEqual(child.eval("6 * 7"), 42, "plain eval accepted without a requirement");
    const script = child.document.createElement("script");
    script.src = "data:,0";
  `,
		false
	),
];
