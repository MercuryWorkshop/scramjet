import { basicTest, type Test } from "../testcommon.ts";

// `return(0,fn)()`: no space between the keyword and the callee, so
// nothing the rewriter puts in front of the callee may join onto it
export default (["pst", "stamp", "lazystamp"] as const).map((mode) => {
	const test: Test = basicTest({
		name: `incumbency-return-paren-call-${mode}`,
		js: `
			const getValue = () => 7;
			const obj = { m() { return 8; } };
			function read() {return(0,getValue)()}
			function read2() {return(0,obj.m)()}
			function read3() {return(obj.m)()}
			assertConsistent("values", [read(), read2(), read3()].join(","));
		`,
	});
	test.incumbencyMode = mode;
	test.timeoutMs = 10000;
	return test;
});
