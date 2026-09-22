import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import bundle from "./intercept-fixture.mjs";

const requireRunway = createRequire(
	new URL("../../../runway/package.json", import.meta.url)
);
const { chromium } = requireRunway("playwright");
let browser;
before(async () => {
	browser = await chromium.launch({ headless: true });
});
after(async () => {
	await browser?.close();
});
async function evaluate(fn) {
	const page = await browser.newPage();
	try {
		await page.route("http://intercept.test/**", (route) =>
			route.fulfill({ contentType: "text/html", body: "<!doctype html>" })
		);
		await page.goto("http://intercept.test/");
		await page.evaluate(bundle);
		return await page.evaluate(fn);
	} finally {
		await page.close();
	}
}

test("nested sequence/record rejection never retries input or calls the interceptor", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const client = fixture.makeClient();
			let handled = 0;
			class Handler extends Headers {
				static make(input) {
					handled++;
					return new this(input);
				}
			}
			fixture.idl.Constructor("sequence<sequence<ByteString>>")(Handler.make);
			client.Intercept(Handler);
			let iterations = 0;
			let sequenceError;
			try {
				new Headers({
					*[Symbol.iterator]() {
						iterations++;
						yield ["x", iterations === 1 ? "\u0100" : "bypass"];
					},
				});
			} catch (e) {
				sequenceError = e.name;
			}
			let gets = 0;
			const validate = fixture.idl.compileIDLValidator(client.box, [
				"record<ByteString, ByteString>",
			]);
			let recordError;
			try {
				validate([
					{
						get x() {
							return ++gets === 1 ? "\u0100" : "bypass";
						},
					},
				]);
			} catch (e) {
				recordError = e.name;
			}
			return { iterations, handled, gets, sequenceError, recordError };
		}),
		{
			iterations: 1,
			handled: 0,
			gets: 1,
			sequenceError: "TypeError",
			recordError: "TypeError",
		}
	);
});

test("iterator acquisition and step failures are not retried; page exceptions keep identity", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const validate = fixture.idl.compileIDLValidator(
				fixture.makeClient().box,
				["sequence<ByteString>"]
			);
			const counts = [];
			for (const phase of ["method", "iterator", "next", "step"]) {
				let count = 0;
				const input = {
					get [Symbol.iterator]() {
						count++;
						if (phase === "method") return 0;
						return () =>
							phase === "iterator"
								? 0
								: { next: phase === "next" ? 0 : () => 0 };
					},
				};
				try {
					validate([input]);
				} catch (e) {
					counts.push([count, e.name]);
				}
			}
			const error = {};
			let same = false;
			try {
				validate([
					{
						[Symbol.iterator]() {
							throw error;
						},
					},
				]);
			} catch (e) {
				same = e === error;
			}
			return { counts, same };
		}),
		{ counts: Array(4).fill([1, "TypeError"]), same: true }
	);
});

test("receiver checks precede coercion, including forged prototypes and setters", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const client = fixture.makeClient();
			const has = Headers.prototype.has;
			class Handler extends Headers {
				set(name, value) {
					return super.set(name, value);
				}
			}
			fixture.idl.Arguments("ByteString", "ByteString")(Handler.prototype.set);
			client.Intercept(Handler, (receiver) =>
				Reflect.apply(has, receiver, ["x"])
			);
			let conversions = 0;
			const input = {
				toString() {
					conversions++;
					return "x";
				},
			};
			const errors = [];
			for (const receiver of [{}, Object.create(Headers.prototype)]) {
				try {
					Headers.prototype.set.call(receiver, input, "value");
				} catch (e) {
					errors.push(e.name);
				}
			}
			const headers = new Headers();
			headers.set(input, "value");
			const alpha = Object.getOwnPropertyDescriptor(
				CanvasRenderingContext2D.prototype,
				"globalAlpha"
			);
			class CanvasHandler extends CanvasRenderingContext2D {
				set globalAlpha(value) {
					super.globalAlpha = value;
				}
			}
			fixture.idl.Type("unrestricted double")(
				Object.getOwnPropertyDescriptor(CanvasHandler.prototype, "globalAlpha")
					.set
			);
			client.Intercept(CanvasHandler, (receiver) =>
				Reflect.apply(alpha.get, receiver, [])
			);
			let numbers = 0;
			try {
				Object.getOwnPropertyDescriptor(
					CanvasRenderingContext2D.prototype,
					"globalAlpha"
				).set.call(
					{},
					{
						valueOf() {
							numbers++;
							return 1;
						},
					}
				);
			} catch (e) {
				errors.push(e.name);
			}
			return { conversions, numbers, errors, value: headers.get("x") };
		}),
		{
			conversions: 1,
			numbers: 0,
			errors: ["TypeError", "TypeError", "TypeError"],
			value: "value",
		}
	);
});

test("unsafe coercing instance declarations are rejected before installation", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const client = fixture.makeClient();
			const original = Headers.prototype.set;
			class Handler extends Headers {
				set(a, b) {
					return super.set(a, b);
				}
			}
			fixture.idl.Arguments("ByteString", "ByteString")(Handler.prototype.set);
			let refused = false;
			try {
				client.Intercept(Handler);
			} catch {
				refused = true;
			}
			return [refused, Headers.prototype.set === original];
		}),
		[true, true]
	);
});

test("Promise IDL rejects conversion, receiver, and arity errors without synchronous throws", async () => {
	assert.deepEqual(
		await evaluate(async () => {
			const client = fixture.makeClient();
			const getter = Object.getOwnPropertyDescriptor(
				CSSStyleSheet.prototype,
				"cssRules"
			).get;
			// Intentionally not async: the IDL return type also controls rejection.
			class Handler extends CSSStyleSheet {
				replace(text) {
					return super.replace(text);
				}
			}
			fixture.idl.Arguments("USVString")(Handler.prototype.replace);
			fixture.idl.Returns("Promise<CSSStyleSheet>")(Handler.prototype.replace);
			client.Intercept(Handler, (receiver) =>
				Reflect.apply(getter, receiver, [])
			);
			const error = {};
			const results = [];
			for (const [receiver, args] of [
				[
					new CSSStyleSheet(),
					[
						{
							toString() {
								throw error;
							},
						},
					],
				],
				[{}, ["x"]],
				[new CSSStyleSheet(), []],
			]) {
				try {
					const promise = CSSStyleSheet.prototype.replace.apply(receiver, args);
					results.push(
						await promise.then(
							() => "resolved",
							(e) => (e === error ? "same error" : e.name)
						)
					);
				} catch {
					results.push("synchronous throw");
				}
			}
			return results;
		}),
		["same error", "TypeError", "TypeError"]
	);
});

test("bridged promises bypass replaced Promise.prototype.then", async () => {
	assert.deepEqual(
		await evaluate(async () => {
			const client = fixture.makeClient();
			class Handler extends Blob {
				async text() {
					return await super.text();
				}
			}
			client.Intercept(Handler);
			const then = Promise.prototype.then;
			let calls = 0;
			Promise.prototype.then = function () {
				calls++;
				return this;
			};
			let promise;
			try {
				promise = new Blob(["ok"]).text();
			} finally {
				Promise.prototype.then = then;
			}
			return {
				calls,
				value: await Promise.race([
					promise,
					new Promise((resolve) => setTimeout(() => resolve("pending"), 100)),
				]),
			};
		}),
		{ calls: 0, value: "ok" }
	);
});

test("record conversion checks each descriptor immediately before its value and rejects enumerable symbols", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const validate = fixture.idl.compileIDLValidator(
				fixture.makeClient().box,
				["record<ByteString, ByteString>"]
			);
			const log = [];
			const target = {
				get a() {
					delete this.b;
					Object.defineProperty(this, "c", { enumerable: true });
					return "a";
				},
				b: "b",
			};
			Object.defineProperty(target, "c", { configurable: true, value: "c" });
			const input = new Proxy(target, {
				ownKeys(t) {
					log.push("keys");
					return Reflect.ownKeys(t);
				},
				getOwnPropertyDescriptor(t, k) {
					log.push("desc " + k);
					return Reflect.getOwnPropertyDescriptor(t, k);
				},
				get(t, k) {
					log.push("get " + k);
					return Reflect.get(t, k);
				},
			});
			const args = [input];
			validate(args);
			let symbolError;
			try {
				validate([{ [Symbol()]: "x" }]);
			} catch (e) {
				symbolError = e.name;
			}
			return { log, value: args[0], symbolError };
		}),
		{
			log: ["keys", "desc a", "get a", "desc b", "desc c", "get c"],
			value: { a: "a", c: "c" },
			symbolError: "TypeError",
		}
	);
});

test("all Number-based IDL coercers reject BigInt primitives and object results", async () => {
	assert.equal(
		await evaluate(() => {
			const box = fixture.makeClient().box;
			let failures = 0;
			for (const type of [
				"float",
				"unrestricted float",
				"double",
				"unrestricted double",
				"long long",
				"unsigned long long",
				"[Clamp] unsigned short",
				"DOMHighResTimeStamp",
			]) {
				for (const value of [
					1n,
					{
						valueOf() {
							return 1n;
						},
					},
				]) {
					try {
						fixture.idl.compileIDLValidator(box, [type])([value]);
					} catch (e) {
						if (e.name === "TypeError") failures++;
					}
				}
			}
			try {
				fixture.idl.idlDouble(1n);
			} catch (e) {
				if (e.name === "TypeError") failures++;
			}
			return failures;
		}),
		17
	);
});

test("about:blank and srcdoc retain their inherited origin after fragment navigation", async () => {
	assert.deepEqual(
		await evaluate(async () => {
			const results = [];
			for (const srcdoc of [false, true]) {
				const frame = document.createElement("iframe");
				if (srcdoc) frame.srcdoc = "<!doctype html>";
				const loaded = new Promise((resolve) => (frame.onload = resolve));
				document.body.append(frame);
				await loaded;
				const client = fixture.makeClient();
				client.global = frame.contentWindow;
				client.unrewriteUrl = (value) => value;
				client.creatorOrigin = location.origin;
				client.opaqueScope = "opaque-test";
				const before = client.siteOrigin;
				frame.contentWindow.location.hash = "hello?query#fragment";
				results.push({
					before,
					after: client.siteOrigin,
					scope: client.scopeOrigin,
					native: frame.contentWindow.origin,
				});
				frame.remove();
			}
			return results;
		}),
		Array(2).fill({
			before: "http://intercept.test",
			after: "http://intercept.test",
			scope: "http://intercept.test",
			native: "http://intercept.test",
		})
	);
});

test("origin inheritance matches about URLs precisely and preserves opaque scope", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const client = fixture.makeClient();
			client.creatorOrigin = "https://creator.test";
			client.opaqueScope = "opaque-test";
			const results = [];
			for (const href of [
				"about:blank?query#fragment",
				"about:blank?#",
				"about:srcdoc#?query",
				"about:srcdoc?",
				"about:srcdoc?query#fragment",
				"about:blank-other#fragment",
				"about://host/blank#fragment",
				"https://site.test/about:blank#fragment",
				"data:text/html,hello#fragment",
			]) {
				Object.defineProperty(client, "url", {
					configurable: true,
					value: new URL(href),
				});
				results.push(client.siteOrigin);
			}
			client.creatorOrigin = null;
			Object.defineProperty(client, "url", {
				value: new URL("about:blank#fragment"),
			});
			return { results, origin: client.siteOrigin, scope: client.scopeOrigin };
		}),
		{
			results: [
				"https://creator.test",
				"https://creator.test",
				"https://creator.test",
				"null",
				"null",
				"null",
				"null",
				"https://site.test",
				"null",
			],
			origin: null,
			scope: "opaque-test",
		}
	);
});

test("stack formatting matches native fallback headers when error getters throw", async () => {
	assert.deepEqual(
		await evaluate(() => {
			function samples() {
				const results = [];
				for (const thrown of [
					new Error("name getter"),
					"primitive",
					{
						get name() {
							throw new Error("nested");
						},
					},
				]) {
					const error = new Error("original");
					Object.defineProperty(error, "name", {
						get() {
							throw thrown;
						},
					});
					const stack = error.stack;
					results.push({
						header: stack.split("\n")[0],
						frames: stack.includes("\n    at "),
					});
				}
				results.push({
					header: new Error("ordinary").stack.split("\n")[0],
					frames: true,
				});
				return results;
			}
			const native = samples();
			fixture.installErrorFormatter({
				global: globalThis,
				config: { maskedfiles: [] },
				context: {},
			});
			return { native, patched: samples() };
		}),
		{
			native: [
				{ header: "<error: Error: name getter>", frames: true },
				{ header: "<error>", frames: true },
				{ header: "<error>", frames: true },
				{ header: "Error: ordinary", frames: true },
			],
			patched: [
				{ header: "<error: Error: name getter>", frames: true },
				{ header: "<error>", frames: true },
				{ header: "<error>", frames: true },
				{ header: "Error: ordinary", frames: true },
			],
		}
	);
});

test("Intercept warns about added native accessor halves and still installs them", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const warnings = [];
			globalThis.dbg = { warn: (message) => warnings.push(message) };
			const client = fixture.makeClient();
			let written;
			class Handler extends Blob {
				get size() {
					return super.size;
				}
				set size(value) {
					written = value;
				}
			}
			client.Intercept(Handler);
			const blob = new Blob(["abc"]);
			blob.size = 7;
			return {
				warnings,
				size: blob.size,
				written,
				setter: typeof Object.getOwnPropertyDescriptor(Blob.prototype, "size")
					.set,
			};
		}),
		{
			warnings: [
				"Intercept(Blob.size) adds a setter absent from the native attribute",
			],
			size: 3,
			written: 7,
			setter: "function",
		}
	);
});

test("record conversion preserves __proto__ headers and object-valued entries", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const box = fixture.makeClient().box;
			const input = JSON.parse('{"__proto__":"x"}');
			const args = [input];
			fixture.idl.compileIDLValidator(box, ["record<ByteString, ByteString>"])(
				args
			);
			const value = { marker: true };
			const objects = [{ ["__proto__"]: value }];
			fixture.idl.compileIDLValidator(box, ["record<DOMString, any>"])(objects);
			return {
				nativeHeader: new Headers(input).get("__proto__"),
				convertedHeader: new Headers(args[0]).get("__proto__"),
				descriptor: Object.getOwnPropertyDescriptor(args[0], "__proto__"),
				ordinaryPrototype:
					Object.getPrototypeOf(objects[0]) === Object.prototype,
				ownValue:
					Object.hasOwn(objects[0], "__proto__") &&
					objects[0].__proto__ === value,
			};
		}),
		{
			nativeHeader: "x",
			convertedHeader: "x",
			descriptor: {
				value: "x",
				writable: true,
				enumerable: true,
				configurable: true,
			},
			ordinaryPrototype: true,
			ownValue: true,
		}
	);
});

test("record output bypasses inherited setters, readonly properties, and descriptor getters", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const validate = fixture.idl.compileIDLValidator(
				fixture.makeClient().box,
				["record<DOMString, DOMString>"]
			);
			const input = { "x-demo": "hello", locked: "own" };
			let setterCalls = 0;
			Object.defineProperty(Object.prototype, "x-demo", {
				configurable: true,
				set() {
					setterCalls++;
				},
			});
			Object.defineProperty(Object.prototype, "locked", {
				configurable: true,
				value: "inherited",
				writable: false,
			});
			Object.defineProperty(Object.prototype, "get", {
				configurable: true,
				get() {
					throw new Error("inherited descriptor getter");
				},
			});
			const args = [input];
			try {
				validate(args);
			} finally {
				delete Object.prototype["x-demo"];
				delete Object.prototype.locked;
				delete Object.prototype.get;
			}
			return { setterCalls, entries: Object.entries(args[0]) };
		}),
		{
			setterCalls: 0,
			entries: [
				["x-demo", "hello"],
				["locked", "own"],
			],
		}
	);
});

test("record keys that normalize to the same USVString retain the last value", async () => {
	assert.deepEqual(
		await evaluate(() => {
			const args = [{ "\ud800": "first", "\ud801": "last" }];
			fixture.idl.compileIDLValidator(fixture.makeClient().box, [
				"record<USVString, DOMString>",
			])(args);
			return Object.entries(args[0]);
		}),
		[["\ufffd", "last"]]
	);
});
