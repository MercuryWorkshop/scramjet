export const CDP_INIT_SCRIPT = `
(() => {
	try {
		if (!window || !window.parent || window.parent === window) return;
		const pending = [];
		const recordCall = (name, args) => {
			pending.push({ name, args });
		};
		const makeProxy = (name) => {
			return function(...args) {
				recordCall(name, args);
				tryConnect();
			};
		};

		function tryConnect() {
			try {
				const parent = window.parent;
				if (!parent) return;
				if (typeof parent.__testPass === "function") {
					window.__testPass = (message, details) =>
						parent.__testPass(message, details);
				}
				if (typeof parent.__testFail === "function") {
					window.__testFail = (message, details) =>
						parent.__testFail(message, details);
				}
				if (typeof parent.__testConsistent === "function") {
					window.__testConsistent = (label, value) =>
						parent.__testConsistent(label, value);
				}
				if (parent.eval) {
					window.__topEval = parent.eval;
				}

				if (
					typeof parent.__testPass === "function" &&
					typeof parent.__testFail === "function"
				) {
					const queued = pending.splice(0, pending.length);
					for (const entry of queued) {
						if (typeof window[entry.name] === "function") {
							window[entry.name](...entry.args);
						}
					}
					clearInterval(retryId);
				}
			} catch (err) {
				// retry
			}
		}

		window.__eval = window.eval;
		window.__topEval = window.eval;
		window.__testPass = makeProxy("__testPass");
		window.__testFail = makeProxy("__testFail");
		window.__testConsistent = makeProxy("__testConsistent");

		const retryId = setInterval(tryConnect, 10);
		if (document.readyState === "complete") {
			setTimeout(tryConnect, 0);
		} else {
			window.addEventListener("load", () => setTimeout(tryConnect, 0));
		}
	} catch (err) {
		// ignore
	}
})();
`;
