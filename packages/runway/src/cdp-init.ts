export const CDP_INIT_SCRIPT = `
(() => {
	try {
		window.__eval = window.eval;
		window.__topEval = window.eval;
		
		// Test helper functions
		function emitBinding(name, payload) {
			const fn = window[name];
			if (typeof fn === "function") {
				fn(JSON.stringify(payload));
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
		
		// For checkglobal tests - need to use __eval to get real values
		const realtop = window.__eval ? window.__eval("top") : window.eval("top");
		const reallocation = window.__eval ? window.__eval("location") : window.eval("location");
		const realparent = window.__eval ? window.__eval("parent") : window.eval("parent");
		const realeval = window.__eval || window.eval;
		function checkglobal(global) {
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
