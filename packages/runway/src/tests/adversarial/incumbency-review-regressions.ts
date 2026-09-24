import { incumbenceTest } from "../../incumbence.ts";
import { basicTest, serverTest, type Test } from "../../testcommon.ts";

type Mode = NonNullable<Test["incumbencyMode"]>;
const modes = ["pst", "stamp", "lazystamp"] as const;
const tests: Test[] = [];

// PR #113 review regressions, excluding the per-resource mode override finding.
// Each case runs against bare Chromium too. Explicit modes make the failures
// reproducible independently of the default selected by the capability probe.
function add(mode: Mode, name: string, js: string) {
	const test = basicTest({ name: `incumbency-regression-${mode}-${name}`, js });
	test.incumbencyMode = mode;
	test.timeoutMs = 10000;
	tests.push(test);
}

for (const mode of modes) {
	// Finding 1: empty source must not consume a script's opportunity to run.
	// https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element
	add(
		mode,
		"empty-script-preparation",
		`
		window.__incumbencyRuns = 0;
		const script = document.createElement("script");
		script.appendChild(document.createTextNode(""));
		document.body.appendChild(script);
		try {
			assertEqual(window.__incumbencyRuns, 0, "empty script did not execute author code");
			script.firstChild.data = "window.__incumbencyRuns++";
			assertEqual(window.__incumbencyRuns, 0, "character data alone does not prepare the script");
			script.appendChild(document.createTextNode(""));
			assertEqual(window.__incumbencyRuns, 1, "insertion executes the newly populated script");
			script.appendChild(document.createTextNode(""));
			assertEqual(window.__incumbencyRuns, 1, "the script executes only once");
		} finally {
			script.remove();
			delete window.__incumbencyRuns;
		}
	`
	);
	add(
		mode,
		"empty-script-child-list",
		`
		for (const property of ["textContent", "innerHTML"]) {
			const script = document.createElement("script");
			script[property] = "";
			assertEqual(script.childNodes.length, 0, property + " leaves no text node");
		}
	`
	);

	// Finding 3: a call does not end the surrounding OptionalChain.
	// https://tc39.es/ecma262/#sec-optional-chains
	add(
		mode,
		"optional-chain-property-tail",
		`
		const absent = null;
		assertEqual(absent?.postMessage().value, void 0);
		const present = { postMessage() { return { value: 42 }; } };
		assertEqual(present?.postMessage().value, 42, "non-nullish receiver still calls the method");
	`
	);
	add(
		mode,
		"optional-chain-call-tail",
		`
		const absent = null;
		let argumentsEvaluated = 0;
		assertEqual(absent?.postMessage().next(++argumentsEvaluated), void 0);
		assertEqual(argumentsEvaluated, 0, "the tail's arguments are skipped");
	`
	);
	add(
		mode,
		"optional-call-property-tail",
		`
		const target = { postMessage: null };
		let keysEvaluated = 0;
		assertEqual(target.postMessage?.()[++keysEvaluated], void 0);
		assertEqual(keysEvaluated, 0, "the tail's computed key is skipped");
	`
	);

	// Finding 4: looking up the callee can reenter the rewritten program.
	// https://tc39.es/ecma262/#sec-evaluatecall
	add(
		mode,
		"optional-call-getter-reentrancy",
		`
		let lookups = 0;
		const other = { postMessage() {} };
		const target = {
			get postMessage() {
				lookups++;
				other.postMessage();
				return function () { return this === target; };
			}
		};
		assertEqual(target.postMessage?.(), true, "getter reentry preserves the original receiver");
		assertEqual(lookups, 1, "the method getter runs only once");
	`
	);
	add(
		mode,
		"optional-call-computed-reentrancy",
		`
		const other = { postMessage() { return "postMessage"; } };
		const target = { postMessage() { return this === target; } };
		assertEqual(target[other.postMessage()]?.(), true, "computed lookup preserves the receiver");
	`
	);

	// Finding 5: these callees still produce References with a receiver.
	// https://tc39.es/ecma262/#sec-evaluatecall
	add(
		mode,
		"parenthesized-chain-receiver",
		`
		const target = { postMessage() { return this === target; } };
		assertEqual((target?.postMessage)(), true, "parentheses preserve the member Reference");
	`
	);
	add(
		mode,
		"parenthesized-chain-optional-receiver",
		`
		const target = { postMessage() { return this === target; } };
		assertEqual((target?.postMessage)?.(), true, "optional invocation preserves the member Reference");
	`
	);
	add(
		mode,
		"with-binding-receiver",
		`
		// Function supplies a sloppy body even if the harness itself is strict.
		const result = Function(\`
			const target = { postMessage() { return this === target; } };
			with (target) { return postMessage(); }
		\`)();
		assertEqual(result, true, "WithBaseObject supplies the receiver");
	`
	);

	// Finding 6: undefined is a legal local binding; synthetic values must not
	// resolve it. Test both the short-circuit result and a bare call's receiver.
	// https://tc39.es/ecma262/#sec-optional-chains
	add(
		mode,
		"shadowed-undefined-result",
		`
		function probe(undefined) {
			const absent = null;
			return absent?.postMessage();
		}
		assertEqual(probe(42), void 0, "short-circuit result is the undefined value");
	`
	);
	add(
		mode,
		"shadowed-undefined-receiver",
		`
		function probe(undefined) {
			function postMessage() { "use strict"; return this; }
			return postMessage();
		}
		assertEqual(probe(42), void 0, "bare strict calls receive undefined");
	`
	);

	// Finding 7: compare the browser-generated handler's source with the bare
	// browser instead of depending on its wrapper's formatting or parameter name.
	// https://tc39.es/ecma262/#sec-function.prototype.tostring
	add(
		mode,
		"inline-handler-source",
		`
		const element = document.createElement("button");
		element.setAttribute("onclick", "return 42");
		assertEqual(element.onclick(), 42, "the author handler remains executable");
		await assertConsistent("inline-handler-source", element.onclick.toString());
	`
	);

	// Finding 8: document.all == null, but optional chaining must not treat it
	// as nullish. The optional-call control may skip the missing method.
	// https://tc39.es/ecma262/#sec-optional-chains
	add(
		mode,
		"htmldda-is-not-nullish",
		`
		assertEqual(document.all?.postMessage?.(), void 0);
		let threw = false;
		try { document.all?.postMessage(); }
		catch (error) { threw = error instanceof TypeError; }
		assertEqual(threw, true, "the non-optional missing method call must throw");
	`
	);

	// Finding 9: an HTML-close comment is permitted at the start of a classic
	// script line. A prelude on that line must not turn it into an operator.
	// https://tc39.es/ecma262/#sec-html-like-comments
	add(
		mode,
		"leading-html-close-comment",
		`
		assertEqual(eval("--> legacy comment\\n42"), 42);
	`
	);

	// Remaining compliance gaps from the review: receiver validation must run
	// before getters on the options dictionary, including when they throw.
	// https://webidl.spec.whatwg.org/#dfn-create-operation-function
	add(
		mode,
		"brand-check-before-options",
		`
		let reads = 0;
		const sentinel = {};
		let thrown;
		try {
			window.postMessage.call({}, "message", {
				get targetOrigin() { reads++; throw sentinel; }
			});
		} catch (error) { thrown = error; }
		assertEqual(reads, 0, "an invalid receiver must not read options");
		assertEqual(thrown instanceof TypeError, true, "the receiver check throws TypeError");
	`
	);

	// https://html.spec.whatwg.org/multipage/web-messaging.html#window-post-message-steps
	for (const [name, top, frame] of [
		["computed-postmessage-sender", "", 'parent["postMessage"]("probe", "*");'],
		[
			"stack-limit-sender",
			"Error.stackTraceLimit = 0;",
			'parent.postMessage("probe", "*");',
		],
	] as const) {
		const test = incumbenceTest({
			name: `incumbency-regression-${mode}-${name}`,
			expect: "frame",
			docs: {
				top: `${top}
					addEventListener("message", event => {
						if (event.data !== "probe") return;
						__report(event.source === frames[0] ? "frame" : "top");
					});`,
				frame,
			},
		});
		test.incumbencyMode = mode;
		test.timeoutMs = 10000;
		tests.push(test);
	}

	// A descendant inherits the ancestor's active sandbox restrictions even
	// when its own embedding iframe has no sandbox attribute.
	// https://html.spec.whatwg.org/multipage/browsers.html#sandboxing-flag-set
	const sandbox = serverTest({
		name: `incumbency-regression-${mode}-inherited-sandbox-origin`,
		async start(server) {
			server.on("request", (req, res) => {
				const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
				res.setHeader("Content-Type", "text/html");
				if (pathname === "/") {
					res.end(`<!doctype html>
						<script>
							addEventListener("message", event => {
								if (event.data !== "nested-sandbox") return;
								assertEqual(event.origin, "null", "the descendant has an opaque origin");
								pass();
							});
						</script>
						<iframe sandbox="allow-scripts" src="/outer"></iframe>`);
				} else if (pathname === "/outer") {
					res.end('<!doctype html><iframe src="/inner"></iframe>');
				} else if (pathname === "/inner") {
					res.end(
						'<!doctype html><script>parent.parent.postMessage("nested-sandbox", "*");</script>'
					);
				} else {
					res.statusCode = 404;
					res.end();
				}
			});
		},
	});
	sandbox.incumbencyMode = mode;
	sandbox.timeoutMs = 10000;
	tests.push(sandbox);
}

// Backup incumbent behavior already has dedicated tests for every mode in
// incumbency-review113.ts: review113-*-host-callback-incumbent.
export default tests;
