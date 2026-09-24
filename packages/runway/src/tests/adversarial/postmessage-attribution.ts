import { incumbenceTest } from "../../incumbence.ts";
import { basicTest, type Test } from "../../testcommon.ts";

const tests: Test[] = [];
for (const mode of ["pst", "lazystamp"] as const) {
	for (const debugTrampolines of [false, true]) {
		const test = incumbenceTest({
			name: `pmattribution-${mode}-getter-debug-${debugTrampolines}`,
			expect: "frame",
			docs: {
				top: `
					addEventListener("message", e => __report(e.source === frames[0] ? "frame" : "top"));
					addEventListener("load", () => { frames[0].object.value; });
				`,
				frame: `window.object = { get value() { parent.postMessage("getter", "*"); return 42; } };`,
			},
		});
		test.incumbencyMode = mode;
		test.debugTrampolines = debugTrampolines;
		tests.push(test);
	}

	const reentrant = incumbenceTest({
		name: `pmattribution-${mode}-reentrant-options`,
		expect: "top",
		docs: {
			top: `
				let inner = false;
				addEventListener("message", e => {
					if (e.data === "inner") {
						assertEqual(e.source, frames[0]); inner = true;
					} else if (e.data === "outer") {
						assertEqual(inner, true);
						__report(e.source === window ? "top" : "frame");
					}
				});
				addEventListener("load", () => window.postMessage("outer", {
					get targetOrigin() { frames[0].fire(); return "*"; }
				}));
			`,
			frame: `window.fire = () => parent.postMessage("inner", "*");`,
		},
	});
	reentrant.incumbencyMode = mode;
	tests.push(reentrant);

	const directives = basicTest({
		name: `pmattribution-${mode}-directive-string-boundaries`,
		js: `
			const heads = ["/*" + "é".repeat(400) + "*/", "\\ufeff// comment\\n", "#!/bin/js\\r\\n"];
			for (const head of heads) {
				const directives = head + "'custom'\\n'use strict'\\n";
				assertEqual(eval(directives), "use strict");
				assertEqual(eval(directives + ";(function(){return this;})()"), undefined);
			}
			assertEqual(eval("#!/bin/js"), undefined);
		`,
	});
	directives.incumbencyMode = mode;
	tests.push(directives);
}

const alias = incumbenceTest({
	name: "pmattribution-pst-alias",
	expect: "frame",
	docs: {
		top: `addEventListener("message", e => __report(e.source === frames[0] ? "frame" : "top"));`,
		frame: `const send = parent.postMessage.bind(parent, "alias", "*"); send();`,
	},
});
alias.incumbencyMode = "pst";
tests.push(alias);

export default tests;
