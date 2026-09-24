import assert from "node:assert/strict";
import { test } from "node:test";
import { Linter } from "eslint";
import plugin from "../eslint/no-unsafe-iteration-plugin.mjs";

const linter = new Linter();
function check(code) {
	return linter.verify(code, [
		{
			plugins: { local: plugin },
			rules: { "local/no-unsafe-iteration": "error" },
			languageOptions: { ecmaVersion: 2022, sourceType: "module" },
		},
	]);
}
const DRAIN = 'import { drain } from "@/shared/snapshot";\n';

for (const code of [
	"for (const x of xs) f(x);",
	"const [a, b] = pair;",
	"f(...args);",
	"const copy = [...xs];",
	// a local called drain is not the snapshot's
	"const drain = (x) => x; for (const x of drain(xs)) f(x);",
	// drain covers the collection, not destructuring of each element
	DRAIN + "for (const [k, v] of drain(entries)) f(k, v);",
]) {
	test(`rejects: ${code}`, () => assert.ok(check(code).length > 0));
}
for (const code of [
	DRAIN + "for (const x of drain(xs)) f(x);",
	"for (let i = 0; i < xs.length; i++) f(xs[i]);",
	"const copy = { ...obj };",
	"const { a, b } = obj;",
]) {
	test(`accepts: ${code}`, () => assert.deepEqual(check(code), []));
}
