import { basicTest } from "../../../testcommon.ts";
const ctor = (label: string, get: string, call: string, expect: string) =>
	basicTest({
		name: `rv0-fnctor-${label}`,
		js: `
			const C = ${get};
			const f = new C("a", "b", ${JSON.stringify(call)});
			assertEqual(typeof f, "function", "constructor returns a function, got " + typeof f + " " + String(f).slice(0, 120));
			const r = await (${expect});
			assertEqual(r, 3, "result");
			const g = C("a", "b", ${JSON.stringify(call)});
			assertEqual(typeof g, "function", "call without new");
		`,
	});
export default [
	ctor("function", "Function", "return a + b", "f(1, 2)"),
	ctor(
		"async",
		"Object.getPrototypeOf(async function(){}).constructor",
		"return a + b",
		"f(1, 2)"
	),
	ctor(
		"generator",
		"Object.getPrototypeOf(function*(){}).constructor",
		"yield a + b",
		"f(1, 2).next().value"
	),
	ctor(
		"asyncgenerator",
		"Object.getPrototypeOf(async function*(){}).constructor",
		"yield a + b",
		"f(1, 2).next().then((r) => r.value)"
	),
	basicTest({
		name: "rv0-fnctor-async-rewrites-globals",
		js: `
			const AF = Object.getPrototypeOf(async function(){}).constructor;
			const f = new AF("return location.href");
			assertEqual(await f(), location.href, "location inside AsyncFunction body is the site's");
		`,
	}),
];
