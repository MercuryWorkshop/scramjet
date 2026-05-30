import { basicTest } from "../../testcommon.ts";

// Strictly ported from data4/payload2_lifted.js:27000-27294.
//
// The lifted path discovers script[nonce], builds one srcdoc iframe using either
// script-src 'nonce-<value>' or script-src 'unsafe-inline', then probes
// contentWindow.eval("this"), inner document creation, data: script URL
// assignment, and containment.

export default basicTest({
	name: "cf-script-nonce-srcdoc-csp",
	timeoutMs: 10000,
	js: `
		const previousYZY = window.yZYbk3;
		if (typeof window.yZYbk3 !== "function") window.yZYbk3 = function(s) { return s; };

		const nonceScript = document.querySelector("script[nonce]");
		const nonce = nonceScript ? nonceScript.nonce : "";
		const mode = nonce
			? { label: 'nonce', csp: "script-src 'nonce-" + nonce + "'", attr: ' nonce="' + nonce + '"' }
			: { label: 'unsafe-inline', csp: "script-src 'unsafe-inline'", attr: '' };

		const runMode = (currentMode) => new Promise((resolve) => {
			const iframe = document.createElement("iframe");
			iframe.height = 0;
			iframe.width = 0;
			iframe.style.display = "none";
			const html = '<html><meta http-equiv="content-security-policy" content="' + currentMode.csp + '"><script' + currentMode.attr + '>window.__cfRan=1<\\/script>';
			const timeout = setTimeout(() => {
				const result = collect(iframe, currentMode, "timeout");
				iframe.remove();
				resolve(result);
			}, 2000);
			const collect = (frame, currentMode, status) => {
				let details;
				try {
					const doc = frame.contentDocument || frame.contentWindow.document;
					const cw = frame.contentWindow;
					const div = doc.createElement("div");
					div.innerHTML = "<b>t</b>";
					const script = doc.createElement("script");
					script.src = "data:,0";
					doc.body.appendChild(div);
					doc.body.appendChild(script);
					details = {
						label: currentMode.label,
						status,
						scriptRan: cw.__cfRan === 1,
						evalThisIsWindow: cw.eval("this") === cw,
						queryNonce: !!doc.querySelector("script[nonce]"),
						queryNonceValue: doc.querySelector("script[nonce]")?.nonce || "",
						divFirstTag: div.firstChild ? div.firstChild.tagName : null,
						scriptSrc: script.src,
						bodyContainsDiv: doc.body.contains(div),
					};
				} catch (e) {
					details = { label: currentMode.label, status, errorName: e.name, message: e.message };
				}
				return details;
			};
			iframe.onload = () => {
				clearTimeout(timeout);
				const result = collect(iframe, currentMode, "load");
				iframe.remove();
				resolve(result);
			};
			iframe.onerror = () => {
				clearTimeout(timeout);
				const result = collect(iframe, currentMode, "error");
				iframe.remove();
				resolve(result);
			};
			iframe.srcdoc = window.yZYbk3(html);
			document.body.appendChild(iframe);
		});

		try {
			const snapshot = {
				outerNonceFound: !!nonceScript,
				outerNonce: nonce,
				result: await runMode(mode),
			};
			assertConsistent("script-nonce-srcdoc-csp", snapshot);
		} finally {
			if (previousYZY === undefined) delete window.yZYbk3;
			else window.yZYbk3 = previousYZY;
		}
	`,
});
