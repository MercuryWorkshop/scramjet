import { basicTest } from "../testcommon.ts";

export default [
	basicTest({
		name: "eval-direct-sanity",
		autoPass: false,
		js: `
    	eval("pass()");
    `,
	}),
	basicTest({
		name: "eval-indirect-sanity",
		autoPass: false,
		js: `
	    (0,eval)("pass()");
	  `,
	}),
	basicTest({
		name: "eval-direct-rewritten",
		js: `
    	eval("checkglobal(top)");
    `,
	}),
	basicTest({
		name: "eval-indirect-rewritten",
		js: `
		  (0,eval)("checkglobal(top)");
		`,
	}),
	basicTest({
		name: "eval-direct-is-direct",
		js: `
			window.local = 231;
		  {
				let local = 514;
				eval("assertEqual(local, 514, 'direct eval should have local scope');");
				(0,eval)("assertEqual(local, 231, 'indirect eval should have global scope');");
			}
		`,
	}),
	basicTest({
		name: "eval-strict",
		js: `
			  function testStrictEval() {
					"use strict";
					eval("assert((function(){return !this;})() === true, 'strict function should be strict')")
				}
				function testSloppyEval() {
					eval("assert((function(){return !this;})() === false, 'sloppy function should be sloppy')")
				}
				function testIndirectEval() {
					"use strict";
					(0,eval)("assert((function(){return !this;})() === false, 'indirect eval should be sloppy even in strict context')")
				}
				testStrictEval();
				testSloppyEval();
				testIndirectEval();
			`,
	}),
];
