import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real Intercept/IDL code against browser natives without booting
// a proxy server. Network/rewriter modules are unused by this minimal client.
const modules = {
	"@/shared/snapshot": "shared/snapshot.ts",
	"./webidl": "client/webidl.ts",
	"./client": "client/client.ts",
	"./nativeerror": "client/nativeerror.ts",
	"./error": "client/shared/error.ts",
};
let bundle = "const factories = {}; const modules = {};\n";
for (const [id, file] of Object.entries(modules)) {
	const source = readFileSync(
		new URL(`../../src/${file}`, import.meta.url),
		"utf8"
	);
	const output = ts
		.transpileModule(source, {
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.CommonJS,
			},
		})
		.outputText.replaceAll("import.meta", "({})");
	bundle += `factories[${JSON.stringify(id)}] = (require, exports) => {${output}\n};\n`;
}
bundle += `
function require(id) {
	if (id === '@client/nativeerror') id = './nativeerror';
	if (modules[id]) return modules[id];
	const exports = modules[id] = {};
	if (factories[id]) factories[id](require, exports);
	return exports;
}
globalThis.fixture = {
	idl: require('./webidl'),
	installErrorFormatter: require('./error').default,
	makeClient() {
		const client = Object.create(require('./client').ScramjetClient.prototype);
		client.global = globalThis;
		client.patched = new WeakMap();
		client.box = {
			unproxy: new Map(),
			ctors: {},
			realms: new Map(),
			objectPrototypes: new WeakMap(),
			instanceof: () => false,
		};
		client.flagEnabled = () => false;
		client.nativeStore = new Map();
		client.saveNatives();
		return client;
	}
};`;
export default bundle;
