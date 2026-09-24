/**
 * The iteration protocol runs through two intrinsics a page can replace:
 *
 *   %IteratorPrototype%[Symbol.iterator]   writable, configurable
 *   Array.prototype[Symbol.iterator]       writable, configurable
 *
 * `for...of` over a *native iterator* - `headers.entries()`, `map.values()` -
 * looks `@@iterator` up on the iterator, which resolves to
 * `%IteratorPrototype%`, so replacing it hijacks the loop. Array destructuring
 * and spread go through `Array.prototype[@@iterator]` the same way, and that
 * holds even for an array scramjet built itself a line earlier.
 *
 * So any of these, running while page script can have executed, hands the page
 * control of what scramjet believes it read. Reaching the object through
 * `client.native` does not help: the *iteration* never touches the native.
 *
 * The sanctioned replacement is `for (const x of drain(xs))`. `drain` hands
 * back a protocol made of own properties on objects it creates, so none of
 * those lookups reach anything the page can write, and this rule accepts it.
 * The alternatives are an indexed `for (let i = 0; ...)` loop, the snapshotted
 * `Array_filter` / `Array_map` / `Array_join`, or a callback enumeration the
 * native drives itself (`Headers.prototype.forEach` through `client.native`).
 *
 * Array destructuring and spread are *not* excused by `drain` - they run the
 * protocol on the element, not on the collection - so `for (const [k, v] of
 * drain(...))` still reports. Destructure an object, or index the entry.
 *
 * Install-time code is not special-cased. It is safe on pristine intrinsics,
 * but `drain` costs nothing that matters at install, and an exemption would
 * have to guess at which functions run before page script - `saveNatives`,
 * `hook` and `Intercept` are class methods, not the module's default export,
 * so the obvious "top-level default export" heuristic would miss most of them.
 */

const PROTOCOL_FORMS = {
	ForOfStatement: "forOf",
	ArrayPattern: "destructuring",
	SpreadElement: "spread",
};

const noUnsafeIterationPlugin = {
	rules: {
		"no-unsafe-iteration": {
			meta: {
				type: "problem",
				docs: {
					description:
						"disallow the iteration protocol on values a page can reach",
				},
				schema: [],
				messages: {
					forOf:
						"`for...of` reads @@iterator off the value, which for a native iterator resolves to the page-replaceable %IteratorPrototype%. Use `for (const x of drain(xs))` from the snapshot, an indexed loop on a hot path, or a native `forEach` through `client.native`.",
					destructuring:
						"Array destructuring reads the page-replaceable `Array.prototype[Symbol.iterator]`. Index the value instead.",
					spread:
						"Spread reads @@iterator off the value, which the page can replace. Pass an argument list with `Reflect_apply(fn, this, args)`, or build the array by index.",
				},
			},
			create(context) {
				// `drain` has to be the one from the snapshot. A file that never
				// imports it cannot be calling it, whatever a local is named
				let drainImported = false;

				function isDrained(node) {
					const right = node.right;

					return (
						drainImported &&
						right?.type === "CallExpression" &&
						right.callee.type === "Identifier" &&
						right.callee.name === "drain"
					);
				}

				function report(node, messageId) {
					context.report({ node, messageId });
				}

				return {
					ImportDeclaration(node) {
						if (node.source.value !== "@/shared/snapshot") return;

						for (const specifier of node.specifiers) {
							if (
								specifier.type === "ImportSpecifier" &&
								specifier.imported.name === "drain"
							) {
								drainImported = true;
							}
						}
					},
					ForOfStatement(node) {
						if (isDrained(node)) return;

						report(node, PROTOCOL_FORMS.ForOfStatement);
					},
					ArrayPattern(node) {
						report(node, PROTOCOL_FORMS.ArrayPattern);
					},
					SpreadElement(node) {
						// `{...obj}` is an object spread, which copies own
						// enumerable properties and never touches @@iterator
						if (node.parent?.type === "ObjectExpression") return;

						report(node, PROTOCOL_FORMS.SpreadElement);
					},
				};
			},
		},
	},
};

export default noUnsafeIterationPlugin;
