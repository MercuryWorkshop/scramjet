import assert from "node:assert/strict";
import { test } from "node:test";
import { Linter } from "eslint";
import plugin from "../eslint/brand-check-plugin.mjs";

const linter = new Linter();
function check(body) {
	return linter.verify(
		`client.Intercept(class extends Blob { get size() { ${body} } });`,
		[
			{
				plugins: { local: plugin },
				rules: { "local/intercept-brand-check": "error" },
				languageOptions: { ecmaVersion: 2022, sourceType: "module" },
			},
		]
	);
}
for (const body of [
	"return 1;",
	"void super.slice; return 1;",
	"new client.native.Blob(this); return 1;",
	"void new client.native.Blob(this).slice; return 1;",
	"if (flag) super.slice(); return 1;",
	"const later = () => super.slice(); return 1;",
	"try { super.slice(); } catch {} return 1;",
	"void super.toString(); return 1;",
	"new client.native.Blob(this).size = 1; return 1;",
	"void new client.native.Node(this).ELEMENT_NODE; return 1;",
]) {
	test(`rejects unchecked path: ${body}`, () => {
		const messages = check(body);
		assert.equal(messages.length, 1);
		assert.equal(messages[0].messageId, "missingBrandCheck");
	});
}
for (const body of [
	"return super.size;",
	"void super.size; return 1;",
	"super.slice(); return 1;",
	"new client.native.Blob(this).slice(); return 1;",
	"void new client.native.Blob(this).size; return 1;",
	"if (flag) return super.size; super.slice(); return 1;",
	"try { return super.size; } catch { throw Error(); }",
]) {
	test(`accepts native check: ${body}`, () =>
		assert.deepEqual(check(body), []));
}
