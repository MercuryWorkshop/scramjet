// The parser runs in the page's realm, where every builtin prototype and
// global is the page's to rewrite. This poisons all of them - every method on
// every builtin prototype, the static methods, the iterator protocol, and
// accessors for every property name the vendored code mentions (plus array
// indices) on Object.prototype and Array.prototype - and then checks that
// parsing and serializing produce exactly what they did before, without a
// single poisoned member being touched.
import * as fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	DomBuilder,
	Parser,
	type ParserOptions,
	parseDocument,
	render,
} from "../../src/shared/htmlparser/index";

const sourceDir = new URL("../../src/shared/htmlparser/", import.meta.url);
const documentsDir = new URL("__fixtures__/Documents/", import.meta.url);

/** Every property name that appears in the vendored source. */
function sourcePropertyNames(): string[] {
	const names = new Set<string>();
	for (const file of fs.readdirSync(sourceDir)) {
		if (!file.endsWith(".ts") || file.startsWith("decode-data")) continue;
		const source = fs.readFileSync(new URL(file, sourceDir), "utf8");
		for (const match of source.matchAll(/[.?]\s*([A-Za-z_$][\w$]*)/g))
			names.add(match[1]);
		for (const match of source.matchAll(/([A-Za-z_$][\w$]*)\s*[:=(]/g))
			names.add(match[1]);
	}
	for (let index = -1; index <= 64; index++) names.add(String(index));
	return [...names];
}

type Saved = {
	target: object;
	key: PropertyKey;
	descriptor?: PropertyDescriptor;
};

/**
 * Wrap every configurable member of the builtins so that any use of it is
 * recorded, and add recording accessors for the names the vendored code
 * mentions wherever the builtins don't already have them. The wrappers still
 * forward to the originals - node and vitest keep calling builtins behind the
 * test's back, and would fall over if they threw - so it's the record that
 * says whether anything was touched.
 */
function poison(): { restore: () => void; touched: string[] } {
	const {
		apply,
		defineProperty,
		getOwnPropertyDescriptor,
		ownKeys,
		deleteProperty,
		setPrototypeOf,
	} = Reflect;
	// descriptors are read with [[Get]], so they mustn't inherit anything
	const bare = <T extends object>(object: T): T => {
		setPrototypeOf(object, null);
		return object;
	};
	const touched: string[] = Object.setPrototypeOf([], null);
	const saved: Saved[] = Object.setPrototypeOf([], null);
	let recording = false;
	const record = (label: string) => {
		if (recording) touched[touched.length] = label;
	};

	const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
	const ArrayIteratorPrototype = Object.getPrototypeOf([][Symbol.iterator]());
	const StringIteratorPrototype = Object.getPrototypeOf(""[Symbol.iterator]());
	const targets: [string, object][] = [
		["Object.prototype", Object.prototype],
		["Array.prototype", Array.prototype],
		["String.prototype", String.prototype],
		["Number.prototype", Number.prototype],
		["Boolean.prototype", Boolean.prototype],
		["Symbol.prototype", Symbol.prototype],
		["Function.prototype", Function.prototype],
		["RegExp.prototype", RegExp.prototype],
		["Map.prototype", Map.prototype],
		["Set.prototype", Set.prototype],
		["WeakMap.prototype", WeakMap.prototype],
		["WeakSet.prototype", WeakSet.prototype],
		["Error.prototype", Error.prototype],
		["%TypedArray%.prototype", TypedArrayPrototype],
		["Uint8Array.prototype", Uint8Array.prototype],
		["Uint16Array.prototype", Uint16Array.prototype],
		["%ArrayIteratorPrototype%", ArrayIteratorPrototype],
		["%StringIteratorPrototype%", StringIteratorPrototype],
		["Iterator.prototype", Object.getPrototypeOf(ArrayIteratorPrototype)],
		["Object", Object],
		["Array", Array],
		["String", String],
		["Number", Number],
		["Math", Math],
		["JSON", JSON],
		["Reflect", Reflect],
		["Symbol", Symbol],
	];

	const wrap = (label: string, original: (...args: never[]) => unknown) =>
		function (this: unknown, ...args: unknown[]) {
			record(label);
			return apply(original, this, args);
		};

	// Work out every replacement before making any: once the first one is in,
	// the code doing the poisoning would be recording itself.
	const plan: [object, PropertyKey, PropertyDescriptor][] = [];
	for (const [name, target] of targets) {
		for (const key of ownKeys(target)) {
			const descriptor = getOwnPropertyDescriptor(target, key)!;
			if (!descriptor.configurable) continue;
			const label = `${name}.${String(key)}`;
			if ("value" in descriptor) {
				// constructors keep their identity: `x.constructor === Array`
				if (typeof descriptor.value !== "function" || key === "constructor")
					continue;
				plan.push([
					target,
					key,
					bare({ ...descriptor, value: wrap(label, descriptor.value) }),
				]);
			} else {
				plan.push([
					target,
					key,
					bare({
						...descriptor,
						get: descriptor.get && wrap(label, descriptor.get),
						set: descriptor.set && wrap(label, descriptor.set),
					}),
				]);
			}
		}
	}
	const names = sourcePropertyNames();
	const symbols = [
		Symbol.iterator,
		Symbol.toPrimitive,
		Symbol.species,
		Symbol.toStringTag,
		Symbol.replace,
		Symbol.split,
		Symbol.search,
		Symbol.match,
		Symbol.hasInstance,
	];
	for (const [label, target] of [
		["Object.prototype", Object.prototype],
		["Array.prototype", Array.prototype],
	] as const) {
		for (const key of [...names, ...symbols]) {
			if (Object.hasOwn(target, key)) continue;
			const name = `${label}[${String(key)}]`;
			plan.push([
				target,
				key,
				bare({
					configurable: true,
					get() {
						record(name);
						return undefined;
					},
					// behave like the ordinary assignment this shadows
					set(this: object, value: unknown) {
						record(name);
						defineProperty(
							this,
							key,
							bare({
								value,
								writable: true,
								enumerable: true,
								configurable: true,
							})
						);
					},
				}),
			]);
		}
	}

	for (let index = 0; index < plan.length; index++) {
		const target = plan[index][0];
		const key = plan[index][1];
		const original = getOwnPropertyDescriptor(target, key);
		saved[saved.length] = bare({
			target,
			key,
			descriptor: original && bare(original),
		});
		defineProperty(target, key, plan[index][2]);
	}
	recording = true;

	return {
		touched,
		restore() {
			recording = false;
			for (let index = saved.length - 1; index >= 0; index--) {
				const entry = saved[index];
				if (entry.descriptor)
					defineProperty(entry.target, entry.key, entry.descriptor);
				else deleteProperty(entry.target, entry.key);
			}
		},
	};
}

type Case = {
	input: string;
	options: ParserOptions;
	xmlMode: boolean;
	chunks: string[];
};

function corpus(): Case[] {
	const inputs = [
		"<!DOCTYPE html><html><head><title>a &amp; b</title><base href=/x></head><body onload=f()>text</body></html>",
		"<p>a<p>b<table><tr><td>1<td>2</table><ul><li>x<li>y</ul><form><form></form>",
		"<script>var s = '<script></'+'script>'; if (a < b && c) {}</script><style>a{b:url(x)}</style>",
		"<textarea>&lt;b&gt;</textarea><title>&quot;t&quot</title><xmp><b></xmp><plaintext><i>",
		"<noscript><img src=x onerror=y></noscript><noembed><b></noembed><noframes><i></noframes><iframe><u></iframe>",
		"<svg viewBox='0 0 1 1'><clippath/><foreignobject><div>x</div></foreignobject><![CDATA[a<b]]></g></p><b>",
		"<math><mi>x</mi><mrow></br><annotation-xml><svg><desc><p>y</desc></svg></math>",
		"<!-- c --><!--!><!---><!--x--!><?pi><!bogus><![CDATA[y]]></ x><//><a href='&notin;&notit;&amp&#x41;&#65&#;&#x;'>",
		"&timesbar;&timesbar&NotGreaterFullEqual;&ampx&lt&#128;&#0;&#xD800;&#x110000; é 😀  ",
		"<a __proto__=x constructor=y toString=z hasOwnProperty=w valueOf=v 0=a length=l>b</a><__proto__></__proto__>",
		"<div class=\"a 'b'\" title='\"' data-x=`y` =bad a=b=c/><img/src=x/alt=y/ ><br/><hr / >",
		"<h1><h2></h1></h2><dd><dt><rt><rp><option><optgroup><select><input><button><tbody><tfoot><tr><th><td>",
	];
	for (const file of fs.readdirSync(documentsDir))
		inputs.push(fs.readFileSync(new URL(file, documentsDir), "utf8"));

	const optionSets: ParserOptions[] = [
		{},
		{ xmlMode: true },
		{ startingForeignContext: "svg" },
		{ startingForeignContext: "math" },
		{ scriptingEnabled: false },
		{ decodeEntities: false },
		{ lowerCaseTags: false, lowerCaseAttributeNames: false },
		{ recognizeSelfClosing: true, recognizeCDATA: true },
	];

	const cases: Case[] = [];
	for (const input of inputs) {
		for (const options of optionSets) {
			const chunks: string[] = [];
			for (let index = 0; index < input.length; index += 5)
				chunks.push(input.slice(index, index + 5));
			cases.push({ input, options, xmlMode: options.xmlMode === true, chunks });
		}
	}
	return cases;
}

/**
 * Parse and serialize every case, both in one go and streamed through a
 * `DomBuilder` the way `IncrementalHtmlRewriter` drives it. Written against
 * nothing but indexed reads and null-prototype arrays, so that running it
 * while the builtins are poisoned only exercises the vendored code.
 */
const { setPrototypeOf } = Object;

function run(cases: Case[]): string[] {
	const results: string[] = setPrototypeOf([], null);
	for (let index = 0; index < cases.length; index++) {
		const { input, options, xmlMode, chunks } = cases[index];

		let output = render(parseDocument(input, options), xmlMode);

		const builder = new DomBuilder();
		const parser = new Parser(builder, options);
		for (let chunk = 0; chunk < chunks.length; chunk++) {
			parser.write(chunks[chunk]);
			output += `|${builder.openElements}`;
		}
		parser.end();
		const { children } = builder.root;
		for (let child = 0; child < children.length; child++) {
			output += `|${render(children[child], xmlMode)}`;
		}

		results[results.length] = output;
	}
	return results;
}

describe("prototype pollution", () => {
	let restore: (() => void) | undefined;
	afterEach(() => {
		restore?.();
		restore = undefined;
	});

	it("poisoning the builtins actually bites", () => {
		const poisoned = poison();
		restore = poisoned.restore;
		const array: number[] = [];
		array.push(1);
		const missing = ({} as { attribs?: unknown }).attribs;
		poisoned.restore();
		restore = undefined;
		expect(missing).toBeUndefined();
		expect(array).toEqual([1]);
		expect(Array.from(poisoned.touched)).toContain("Array.prototype.push");
		expect(Array.from(poisoned.touched)).toContain("Object.prototype[attribs]");
	});

	it("parses and serializes identically with every builtin poisoned", () => {
		const cases = corpus();
		const expected = run(cases);

		const poisoned = poison();
		restore = poisoned.restore;
		let actual: string[] | undefined;
		let error: unknown;
		try {
			actual = run(cases);
		} catch (caught) {
			error = caught;
		}
		poisoned.restore();
		restore = undefined;

		expect([...new Set(Array.from(poisoned.touched))]).toEqual([]);
		expect(error).toBeUndefined();
		expect(Array.from(actual!)).toEqual(Array.from(expected));
		expect(expected.length).toBeGreaterThan(100);
	});
});
