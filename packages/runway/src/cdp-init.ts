export const CDP_INIT_SCRIPT = `
(() => {
	try {
		window.__eval = window.eval;
		window.__topEval = window.eval;
		function getRunwayToken() {
			try {
				const url = new URL(location.href);
				const searchToken = url.searchParams.get("runway_token");
				if (searchToken) return searchToken;
				const hash = url.hash;
				if (!hash) return undefined;
				const params = new URLSearchParams(
					hash.startsWith("#") ? hash.slice(1) : hash
				);
				return params.get("runway_token") || undefined;
			} catch {
				return undefined;
			}
		}
		
		// Test helper functions
		function emitBinding(name, payload) {
			const fn = window[name];
			if (typeof fn === "function") {
				const token = getRunwayToken();
				if (payload && typeof payload === "object") {
					fn(JSON.stringify({ ...payload, __runwayToken: token }));
				} else {
					fn(JSON.stringify({ value: payload, __runwayToken: token }));
				}
			}
		}

		function pass(message, details) {
			emitBinding("__testPass", { message, details });
		}
		
		function fail(message, details) {
			emitBinding("__testFail", { message, details });
		}
		
		function assertConsistent(label, value) {
			if (typeof value === 'undefined') {
				value = label;
				label = 'default';
			}
			emitBinding("__testConsistent", { label, value });
		}
		
		function assert(condition, message) {
			if (!condition) {
				fail(message || 'Assertion failed');
				throw new Error(message || 'Assertion failed');
			}
		}
		
		function assertEqual(actual, expected, message) {
			if (actual !== expected) {
				const msg = message || \`Expected \${JSON.stringify(expected)}, got \${JSON.stringify(actual)}\`;
				fail(msg, { actual, expected });
				throw new Error(msg);
			}
		}
		
		const assertEquals = assertEqual;
		
		function assertDeepEqual(actual, expected, message) {
			if (JSON.stringify(actual) !== JSON.stringify(expected)) {
				const msg = message || \`Deep equality failed\`;
				fail(msg, { actual, expected });
				throw new Error(msg);
			}
		}
		
		function ok(message, details) {
			emitBinding("__testOk", { message, details });
		}
		
		async function runTest(testFn, autoPass) {
			try {
				await testFn();
				if (autoPass) {
					pass();
				}
			} catch (err) {
				fail(err.message, { stack: err.stack });
			}
		}
		
		// Make functions available globally
		window.pass = pass;
		window.fail = fail;
		window.assertConsistent = assertConsistent;
		window.assert = assert;
		window.assertEqual = assertEqual;
		window.assertEquals = assertEquals;
		window.assertDeepEqual = assertDeepEqual;
		window.ok = ok;
		window.runTest = runTest;
		
		function checkglobal(global) {
			const evalFn = window.__eval || window.eval;
			const realtop = evalFn("top");
			const reallocation = evalFn("location");
			const realparent = evalFn("top");
			const realeval = evalFn;
			assert(global !== realtop, "top was leaked");
			assert(global !== reallocation, "location was leaked");
			assert(global !== realparent, "parent was leaked");
			assert(global !== realeval, "eval was leaked");
		}
		window.checkglobal = checkglobal;
	} catch (err) {
		// ignore
	}
})();
`;
