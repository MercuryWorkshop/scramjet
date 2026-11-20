import { htmlTest } from "../../testcommon.ts";

function srcdoc(name: string, markup: string, js: string) {
	return htmlTest({
		name,
		html: `<!doctype html><body><script>runTest(async () => {
      const frame = document.createElement("iframe");
      const loaded = new Promise(resolve => { frame.onload = resolve; });
      frame.srcdoc = (${markup})(location);
      document.body.appendChild(frame);
      await loaded;
      const child = frame.contentWindow;
      await new Promise(r => setTimeout(r, 300));
      ${js}
    }, true);</script>`,
	});
}

export default [
	// a branded TrustedScriptURL is taken as it is, with no default policy
	srcdoc(
		"trusted-types-script-src-takes-trusted-url",
		`(l) => "<meta http-equiv='Content-Security-Policy' content=\\"require-trusted-types-for 'script'\\"><script>const p = trustedTypes.createPolicy('x', { createScriptURL: (s) => s }); const s = document.createElement('script'); try { s.src = p.createScriptURL('/a.js'); window.r = 'ok'; } catch (e) { window.r = e.name; }<\\/script>"`,
		`assertEqual(child.r, "ok");`
	),
	// writing a policy meta's content keeps it off the real attribute: the
	// browser would enforce it against the proxy's URLs
	srcdoc(
		"csp-meta-content-rewritten-stays-emulated",
		`(l) => "<meta http-equiv='Content-Security-Policy' content='connect-src " + l.origin + "'><script>const m = document.querySelector('meta'); m.content = m.content; fetch(parent.location.href).then(() => window.r = 'ok', (e) => window.r = e.name);<\\/script>"`,
		`assertEqual(child.r, "ok");`
	),
];
