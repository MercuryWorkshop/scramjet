/**
 * Rewrites the heritage of every `client.Intercept(class extends X { ... })`
 * in `src/client/**` to `class extends $sjIface("X")`, so evaluating the class
 * reads no global. See `src/client/iface.ts` for why.
 *
 * Runs on the TypeScript source, before swc: the 2022-03 decorator lowering
 * reshapes these class expressions and can hoist the heritage into
 * temporaries. Edits are identifier-for-call splices on the same line and the
 * import goes at the end of the file, so line numbers - and with them
 * sourcemaps and stack traces - are unchanged.
 *
 * A heritage that is bound in the file (`GlobalScope`, which `Intercept`
 * matches by identity) is left alone. Anything else it can't rewrite - an
 * `Intercept` argument that isn't an inline class, or a heritage that isn't a
 * bare identifier - fails the build: silently leaving it would reintroduce the
 * bug for that interface.
 */
import { sep } from "node:path";
import ts from "typescript";

const CLIENT_DIR = `${sep}packages${sep}core${sep}src${sep}client${sep}`;
const HELPER = "$sjIface";

export default function interceptHeritageLoader(source) {
	const file = this.resourcePath;
	if (!file.includes(CLIENT_DIR) || file.endsWith(`${sep}iface.ts`))
		return source;
	if (!source.includes("Intercept(")) return source;

	const sf = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);

	// every name declared anywhere in the file. coarser than real scoping, but
	// the only question is "is this heritage a global", and a false "bound"
	// leaves the heritage as it was on main rather than breaking anything
	const bound = new Set();
	const calls = [];
	const visit = (node) => {
		if (
			(ts.isVariableDeclaration(node) ||
				ts.isParameter(node) ||
				ts.isFunctionDeclaration(node) ||
				ts.isClassDeclaration(node) ||
				ts.isEnumDeclaration(node) ||
				ts.isImportClause(node) ||
				ts.isImportSpecifier(node) ||
				ts.isNamespaceImport(node) ||
				ts.isBindingElement(node)) &&
			node.name &&
			ts.isIdentifier(node.name)
		) {
			bound.add(node.name.text);
		}
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === "Intercept"
		) {
			calls.push(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);

	const fail = (node, why) => {
		const { line, character } = sf.getLineAndCharacterOfPosition(
			node.getStart(sf)
		);
		throw new Error(
			`${file}:${line + 1}:${character + 1}: ${why} (see tools/intercept-heritage-loader.mjs)`
		);
	};

	const edits = [];
	for (const call of calls) {
		const cls = call.arguments[0];
		if (!cls || !ts.isClassExpression(cls))
			fail(call, "Intercept() must be passed an inline class expression");
		const heritage = cls.heritageClauses?.find(
			(h) => h.token === ts.SyntaxKind.ExtendsKeyword
		)?.types[0]?.expression;
		if (!heritage || !ts.isIdentifier(heritage))
			fail(cls, "an Intercept() class must extend a bare interface name");
		if (bound.has(heritage.text)) continue;
		edits.push({
			start: heritage.getStart(sf),
			end: heritage.getEnd(),
			text: `${HELPER}(${JSON.stringify(heritage.text)})`,
		});
	}
	if (!edits.length) return source;

	let out = source;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
	}
	// imports hoist, so the end of the file is as good as the top and keeps
	// every line where it was
	out += `\nimport { iface as ${HELPER} } from "@client/iface";\n`;

	return out;
}
