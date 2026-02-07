import { serverTest } from "../testcommon.ts";

// Inline test helpers — same as COMMON_JS in testcommon.ts but inlined since it's not exported.
const TEST_HELPERS = `
function pass(message, details) {
	if (typeof __testPass === 'function') __testPass(message, details);
}
function fail(message, details) {
	if (typeof __testFail === 'function') __testFail(message, details);
}
function assert(condition, message) {
	if (!condition) { fail(message || 'Assertion failed'); throw new Error(message || 'Assertion failed'); }
}
function assertEqual(actual, expected, message) {
	if (actual !== expected) {
		var msg = message || ('Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
		fail(msg, { actual: actual, expected: expected });
		throw new Error(msg);
	}
}
function waitForTestFunctions(timeout) {
	timeout = timeout || 5000;
	return new Promise(function(resolve, reject) {
		var start = Date.now();
		function check() {
			if (typeof __testPass === 'function' && typeof __testFail === 'function') resolve();
			else if (Date.now() - start > timeout) reject(new Error('Timed out'));
			else setTimeout(check, 10);
		}
		check();
	});
}
async function runTest(testFn) {
	try { await waitForTestFunctions(); await testFn(); pass(); } catch (err) { fail(err.message); }
}
`;

// Helper: create a serverTest that serves custom-encoded HTML with an inline assertion.
function encodingTest(opts: {
	name: string;
	/** Raw bytes for the HTML page body (<head> + <body> content) */
	html: Buffer;
	/** Content-Type header value for the page */
	contentType: string;
	/** JS assertion to run in the browser (has access to assertEqual, assert, pass, fail, runTest) */
	assertion: string;
}) {
	return serverTest({
		name: opts.name,
		// Don't set `js` — we handle all routes ourselves so we can control Content-Type and encoding of `/`
		start: async (server, _port) => {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, { "Content-Type": opts.contentType });
					res.end(opts.html);
				} else if (req.url === "/common.js") {
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(TEST_HELPERS);
				} else if (req.url === "/script.js") {
					res.writeHead(200, { "Content-Type": "application/javascript" });
					res.end(`runTest(async () => {\n${opts.assertion}\n});`);
				} else {
					res.writeHead(404);
					res.end("Not found");
				}
			});
		},
	});
}

// Build HTML bytes with script includes baked in
function htmlPage(bodyContent: string): string {
	return `<!DOCTYPE html><html><head><script src="/common.js"></script></head><body>${bodyContent}<script src="/script.js"></script></body></html>`;
}

export default [
	// =========================================================================
	// 1. Content-Type header charset — basic UTF-8
	// =========================================================================
	encodingTest({
		name: "encoding-content-type-header-charset",
		contentType: "text/html; charset=utf-8",
		html: Buffer.from(htmlPage('<span id="test">café</span>'), "utf-8"),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "café", "Content-Type charset=utf-8 should decode correctly");
		`,
	}),

	// =========================================================================
	// 2. Content-Type charset with quotes: charset="utf-8"
	// =========================================================================
	encodingTest({
		name: "encoding-content-type-quoted-charset",
		contentType: 'text/html; charset="utf-8"',
		html: Buffer.from(htmlPage('<span id="test">naïve</span>'), "utf-8"),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "naïve", "Quoted charset should work");
		`,
	}),

	// =========================================================================
	// 3. UTF-8 BOM takes priority over Content-Type header
	// =========================================================================
	encodingTest({
		name: "encoding-utf8-bom-priority",
		// Lie in the header — say latin1, but the BOM says UTF-8
		contentType: "text/html; charset=iso-8859-1",
		html: Buffer.concat([
			Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
			Buffer.from(htmlPage('<span id="test">Ünïcödé</span>'), "utf-8"),
		]),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "Ünïcödé", "UTF-8 BOM should override Content-Type");
		`,
	}),

	// =========================================================================
	// 4. <meta charset="utf-8"> when no Content-Type charset
	// =========================================================================
	encodingTest({
		name: "encoding-meta-charset-tag",
		contentType: "text/html",
		html: Buffer.from(
			'<!DOCTYPE html><html><head><meta charset="utf-8"><script src="/common.js"></script></head><body><span id="test">café</span><script src="/script.js"></script></body></html>',
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "café", "meta charset should be used when no header charset");
		`,
	}),

	// =========================================================================
	// 5. <meta http-equiv="content-type" content="text/html; charset=utf-8">
	// =========================================================================
	encodingTest({
		name: "encoding-meta-http-equiv-content-type",
		contentType: "text/html",
		html: Buffer.from(
			'<!DOCTYPE html><html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"><script src="/common.js"></script></head><body><span id="test">café</span><script src="/script.js"></script></body></html>',
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "café", "meta http-equiv content-type charset should work");
		`,
	}),

	// =========================================================================
	// 6. No charset anywhere — defaults to UTF-8
	// =========================================================================
	encodingTest({
		name: "encoding-default-utf8",
		contentType: "text/html",
		html: Buffer.from(htmlPage('<span id="test">hello</span>'), "utf-8"),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "hello", "Default UTF-8 should work for ASCII content");
		`,
	}),

	// =========================================================================
	// 7. ISO-8859-1 (→ windows-1252) via Content-Type header
	//    Note: script tags use ASCII so they work regardless of encoding
	// =========================================================================
	encodingTest({
		name: "encoding-latin1-content-type",
		contentType: "text/html; charset=iso-8859-1",
		// 0xe9 = é in windows-1252 / ISO-8859-1
		html: Buffer.from(
			'<!DOCTYPE html><html><head><script src="/common.js"></script></head><body><span id="test">caf\xe9</span><script src="/script.js"></script></body></html>',
			"latin1"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "caf\\u00e9", "latin1 charset should decode correctly");
		`,
	}),

	// =========================================================================
	// 8. Content-Type with extra params before charset
	// =========================================================================
	encodingTest({
		name: "encoding-content-type-extra-params",
		contentType: "text/html; boundary=something; charset=utf-8",
		html: Buffer.from(htmlPage('<span id="test">résumé</span>'), "utf-8"),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "résumé", "charset after other params should work");
		`,
	}),

	// =========================================================================
	// 9. Meta charset with weird casing: <META CHARSET="UTF-8">
	// =========================================================================
	encodingTest({
		name: "encoding-meta-charset-case-insensitive",
		contentType: "text/html",
		html: Buffer.from(
			'<!DOCTYPE html><html><head><META CHARSET="UTF-8"><script src="/common.js"></script></head><body><span id="test">tëst</span><script src="/script.js"></script></body></html>',
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "tëst", "meta charset should be case-insensitive");
		`,
	}),

	// =========================================================================
	// 10. UTF-16 label in <meta charset> should be treated as UTF-8
	//     (per spec: prescan step 14 remaps UTF-16BE/LE → UTF-8)
	// =========================================================================
	encodingTest({
		name: "encoding-meta-charset-utf16-becomes-utf8",
		contentType: "text/html",
		html: Buffer.from(
			'<!DOCTYPE html><html><head><meta charset="utf-16"><script src="/common.js"></script></head><body><span id="test">hello</span><script src="/script.js"></script></body></html>',
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "hello", "meta charset=utf-16 in prescan should be treated as utf-8");
		`,
	}),

	// =========================================================================
	// 11. UTF-16LE BOM with actual UTF-16LE content
	// =========================================================================
	encodingTest({
		name: "encoding-utf16le-bom",
		contentType: "text/html",
		html: Buffer.concat([
			Buffer.from([0xff, 0xfe]), // UTF-16LE BOM
			Buffer.from(htmlPage('<span id="test">hi</span>'), "utf16le"),
		]),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "hi", "UTF-16LE BOM should decode UTF-16LE content");
		`,
	}),

	// =========================================================================
	// 12. "ascii" label → windows-1252 (WHATWG Encoding spec mapping)
	// =========================================================================
	encodingTest({
		name: "encoding-ascii-label-maps-to-windows-1252",
		contentType: "text/html; charset=ascii",
		// 0x93 = \u201c (left double quote), 0x94 = \u201d (right double quote) in windows-1252
		html: Buffer.from(
			'<!DOCTYPE html><html><head><script src="/common.js"></script></head><body><span id="test">\x93hi\x94</span><script src="/script.js"></script></body></html>',
			"latin1"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "\\u201chi\\u201d", "ascii label should map to windows-1252");
		`,
	}),

	// =========================================================================
	// 13. Whitespace around charset value: charset= utf-8
	// =========================================================================
	encodingTest({
		name: "encoding-content-type-whitespace-label",
		contentType: "text/html; charset= utf-8 ",
		html: Buffer.from(htmlPage('<span id="test">café</span>'), "utf-8"),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "café", "whitespace-padded charset label should still work");
		`,
	}),

	// =========================================================================
	// 14. Meta charset after >1024 bytes — prescan should NOT find it
	//     (defaults to UTF-8 since no other charset info)
	// =========================================================================
	encodingTest({
		name: "encoding-meta-charset-after-1024-bytes-ignored",
		contentType: "text/html",
		html: Buffer.from(
			`<!DOCTYPE html><html><head><!-- ${"x".repeat(1100)} --><meta charset="windows-1251"><script src="/common.js"></script></head><body><span id="test">ok</span><script src="/script.js"></script></body></html>`,
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "ok", "late meta charset should be ignored by prescan");
		`,
	}),

	// =========================================================================
	// 15. UTF-16BE BOM with actual UTF-16BE content
	// =========================================================================
	encodingTest({
		name: "encoding-utf16be-bom",
		contentType: "text/html",
		html: Buffer.concat([
			Buffer.from([0xfe, 0xff]), // UTF-16BE BOM
			// Manually encode a simple ASCII-only HTML string as UTF-16BE
			(() => {
				const str = htmlPage('<span id="test">be</span>');
				const buf = Buffer.alloc(str.length * 2);
				for (let i = 0; i < str.length; i++) {
					buf[i * 2] = 0;
					buf[i * 2 + 1] = str.charCodeAt(i);
				}
				return buf;
			})(),
		]),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "be", "UTF-16BE BOM should decode UTF-16BE content");
		`,
	}),

	// =========================================================================
	// 16. windows-1252 smart quotes via Content-Type
	//     (more thorough test of windows-1252 specific byte range 0x80–0x9F)
	// =========================================================================
	encodingTest({
		name: "encoding-windows-1252-smart-quotes",
		contentType: "text/html; charset=windows-1252",
		// 0x91 = ', 0x92 = ', 0x96 = –
		html: Buffer.from(
			'<!DOCTYPE html><html><head><script src="/common.js"></script></head><body><span id="test">\x91hello\x92 \x96 world</span><script src="/script.js"></script></body></html>',
			"latin1"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "\\u2018hello\\u2019 \\u2013 world", "windows-1252 smart quotes and dash should decode correctly");
		`,
	}),

	// =========================================================================
	// 17. Content-Type header takes priority over meta charset
	// =========================================================================
	encodingTest({
		name: "encoding-header-overrides-meta",
		contentType: "text/html; charset=utf-8",
		// The meta says windows-1251, but the header says utf-8
		// The content is valid UTF-8, so if header wins, it decodes correctly
		html: Buffer.from(
			'<!DOCTYPE html><html><head><meta charset="windows-1251"><script src="/common.js"></script></head><body><span id="test">héllo</span><script src="/script.js"></script></body></html>',
			"utf-8"
		),
		assertion: `
			const el = document.getElementById("test");
			assertEqual(el.textContent, "héllo", "Content-Type header should override meta charset");
		`,
	}),
];
