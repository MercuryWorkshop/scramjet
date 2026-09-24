/**
 * Every path out of an interceptor's instance member must touch the receiver.
 *
 * A member installed by `client.Intercept` replaces a native one, and the
 * native brand-checks its receiver: `Object.getOwnPropertyDescriptor(
 * Document.prototype, "domain").get.call({})` is a TypeError, not an answer.
 * A member whose body invokes a native method or reads a native getter
 * through `super` or `client.native.Iface(this)` inherits that check, because it is
 * Blink doing the checking. A member that answers purely out of client state
 * never consults the receiver, so it happily answers any object at all.
 *
 * That is why this is a path analysis rather than a search. Both of these
 * contain `super`, and only the first is safe:
 *
 *   get url()  { return tagged ? unrewrite(super.url) : super.url; }   // ok
 *   get name() { if (mine.has(this)) return ""; return super.name; }   // not
 *
 * The second answers `""` for a receiver that is not a FileSystemHandle at all.
 * So: mark the code-path segments that reach the native, then require every
 * segment a `return` can exit from to be dominated by a marked one.
 *
 * Statics are exempt. A static has no receiver to brand-check - `fetch.call(
 * null, url)` is legal - and `Intercept` installs them on the interface object.
 *
 * Thrown paths are not checked. A member that validates its arguments and
 * throws before reaching the native does report the wrong error for a bad
 * receiver, but flagging that as well buries the case this rule is for.
 */

import ts from "typescript";
import path from "node:path";

// lib.dom distinguishes attributes from operations. A property read alone
// only invokes a native for an attribute; constants are data properties too.
// Worker-only interfaces (SharedWorkerGlobalScope and friends) live in
// lib.webworker, so both are loaded. Unknown interfaces/members are
// conservatively left unmarked.
const interfaces = new Map();
const libDir = path.dirname(ts.getDefaultLibFilePath({}));
for (const name of ["lib.dom.d.ts", "lib.webworker.d.ts"]) {
	const file = path.join(libDir, name);
	const source = ts.createSourceFile(
		file,
		ts.sys.readFile(file),
		ts.ScriptTarget.Latest
	);
	for (const node of source.statements) {
		if (!ts.isInterfaceDeclaration(node)) continue;
		const declarations = interfaces.get(node.name.text) ?? [];
		declarations.push({ node, source });
		interfaces.set(node.name.text, declarations);
	}
}

/**
 * How a native interface exposes `property`: "method" for an operation, and for
 * an attribute which halves of the accessor exist - "getter" (readonly),
 * "setter" or "accessor" (both). lib.dom spells most attributes as property
 * signatures, but the ones whose setter takes a different type than the getter
 * returns (`style`, `location`, ...) as a `get`/`set` pair.
 */
function nativeMember(iface, property, seen = new Set()) {
	if (seen.has(iface)) return undefined;
	seen.add(iface);
	for (const { node: declaration, source } of interfaces.get(iface) ?? []) {
		let get = false;
		let set = false;
		for (const member of declaration.members) {
			if (member.name?.getText(source) !== property) continue;
			if (ts.isMethodSignature(member)) return "method";
			if (ts.isGetAccessorDeclaration(member)) get = true;
			else if (ts.isSetAccessorDeclaration(member)) set = true;
			else if (
				ts.isPropertySignature(member) &&
				member.type &&
				!ts.isLiteralTypeNode(member.type)
			) {
				const readonly = member.modifiers?.some(
					(m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
				);

				return readonly ? "getter" : "accessor";
			} else return undefined;
		}
		if (get || set) return get && set ? "accessor" : get ? "getter" : "setter";
		for (const heritage of declaration.heritageClauses ?? []) {
			for (const parent of heritage.types) {
				const kind = nativeMember(
					parent.expression.getText(source),
					property,
					seen
				);
				if (kind) return kind;
			}
		}
	}
	return undefined;
}

/** `<anything>.Intercept(class …, optionalReceiverCheck)`. */
function isInterceptHandler(node) {
	const call = node.parent;

	return (
		!!call &&
		call.type === "CallExpression" &&
		call.arguments.length >= 1 &&
		call.arguments[0] === node &&
		call.callee.type === "MemberExpression" &&
		!call.callee.computed &&
		call.callee.property.type === "Identifier" &&
		call.callee.property.name === "Intercept"
	);
}

/**
 * The `MethodDefinition` this function body belongs to, when it is an instance
 * member of an interceptor class. Null for anything else - a nested function, a
 * static, a constructor, a class that is not an `Intercept` argument.
 */
function interceptMember(node) {
	const member = node.parent;
	if (!member || member.type !== "MethodDefinition") return null;
	if (member.static || member.kind === "constructor") return null;

	const body = member.parent;
	if (!body || body.type !== "ClassBody") return null;

	const cls = body.parent;
	if (
		!cls ||
		(cls.type !== "ClassExpression" && cls.type !== "ClassDeclaration") ||
		!isInterceptHandler(cls)
	) {
		return null;
	}

	return member;
}

function memberName(member) {
	const key = member.key;
	if (key.type === "Identifier") return key.name;
	if (key.type === "Literal") return String(key.value);

	return "<computed>";
}

/** `new client.native.Iface(this)` creates a wrapper, without calling native. */
function isNativeReceiverCall(node) {
	if (node.arguments.length === 0) return false;
	if (node.arguments[0].type !== "ThisExpression") return false;

	// callee is `<...>.native.<Iface>`
	const callee = node.callee;
	if (callee.type !== "MemberExpression" || callee.computed) return false;

	const object = callee.object;

	return (
		object.type === "MemberExpression" &&
		!object.computed &&
		object.property.type === "Identifier" &&
		object.property.name === "native"
	);
}

/**
 * Which segments are dominated by a marked one.
 *
 * A forward must-analysis: `out[s] = marked[s] || (s has predecessors and every
 * one of them is out)`. Initialised optimistically so a loop's back edge
 * settles instead of pinning the header to false, then iterated down to a
 * fixpoint.
 */
function reachedSegments(codePath, marked, catchEntries) {
	const entry = codePath.initialSegment;
	const all = [];
	const seen = new Set();
	const stack = [entry];

	while (stack.length > 0) {
		const segment = stack.pop();
		if (!segment || seen.has(segment.id)) continue;
		seen.add(segment.id);
		all.push(segment);
		for (const next of segment.nextSegments) stack.push(next);
	}

	const out = new Map();
	for (const segment of all) out.set(segment.id, segment !== entry);
	out.set(entry.id, marked.has(entry.id));

	let changed = true;
	while (changed) {
		changed = false;
		for (const segment of all) {
			if (segment === entry) continue;

			// a catch handler inherits nothing: control can enter it from any
			// point in the try, including before the access that would have done
			// the checking, so `try { super.x } catch { return "" }` swallows the
			// very error this rule is about
			const prev = catchEntries.has(segment.id)
				? []
				: segment.prevSegments.filter((p) => seen.has(p.id));
			const dominated =
				prev.length > 0 && prev.every((p) => out.get(p.id) === true);
			const value = marked.has(segment.id) || dominated;

			if (value !== out.get(segment.id)) {
				out.set(segment.id, value);
				changed = true;
			}
		}
	}

	return out;
}

const brandCheckPlugin = {
	rules: {
		"intercept-brand-check": {
			meta: {
				type: "problem",
				docs: {
					description:
						"require every path out of an interceptor member to reach the native receiver",
				},
				schema: [],
				messages: {
					missingBrandCheck:
						"'{{name}}' can return without checking the receiver, so it answers objects that are not {{iface}}s where the browser throws 'Illegal invocation'. Invoke a native method or read a native getter on every path; a method reference or native wrapper alone does not check the receiver. Otherwise disable this rule with a reason.",
				},
			},
			create(context) {
				// one frame per code path, so a nested function's `super` (which
				// runs later, if at all) never marks the enclosing member
				const frames = [];

				function mark() {
					const frame = frames[frames.length - 1];
					if (!frame || !frame.member) return;
					for (const segment of frame.current) frame.marked.add(segment.id);
				}

				return {
					onCodePathStart(codePath, node) {
						frames.push({
							codePath,
							member: interceptMember(node),
							marked: new Set(),
							current: new Set(),
							catchEntries: new Set(),
						});
					},

					onCodePathSegmentStart(segment, node) {
						const frame = frames[frames.length - 1];
						if (!frame) return;
						frame.current.add(segment);

						const isCatchEntry =
							node.type === "CatchClause" ||
							(node.parent &&
								node.parent.type === "CatchClause" &&
								node.parent.body === node);
						if (isCatchEntry) frame.catchEntries.add(segment.id);
					},

					onCodePathSegmentEnd(segment) {
						const frame = frames[frames.length - 1];
						if (frame) frame.current.delete(segment);
					},

					"MemberExpression:exit"(node) {
						const frame = frames[frames.length - 1];
						if (!frame?.member || node.computed) return;
						const object = node.object;
						let iface;
						if (object.type === "Super") {
							iface = frame.member.parent.parent.superClass?.name;
						} else if (
							object.type === "NewExpression" &&
							isNativeReceiverCall(object)
						) {
							iface = object.callee.property.name;
						} else return;
						// A direct call retains the receiver; `void super.method`
						// and `(0, super.method)()` do not invoke it on `this`.
						if (
							node.parent.type === "CallExpression" &&
							node.parent.callee === node
						)
							return;
						const kind = nativeMember(iface, node.property.name);
						// a plain assignment runs only the setter, with `this` as the
						// receiver; a readonly attribute throws whatever the receiver
						if (
							node.parent.type === "AssignmentExpression" &&
							node.parent.left === node &&
							node.parent.operator === "="
						) {
							if (kind === "setter" || kind === "accessor") mark();

							return;
						}
						if (kind === "getter" || kind === "accessor") mark();
					},

					"CallExpression:exit"(node) {
						const frame = frames[frames.length - 1];
						if (!frame?.member) return;
						// `Reflect_apply(super.m, this, args)` is `super.m(...args)`
						// without the spread, which runs the page-replaceable
						// iteration protocol - see `no-unsafe-iteration`
						const applied =
							node.callee.type === "Identifier" &&
							node.callee.name === "Reflect_apply" &&
							node.arguments.length >= 2 &&
							node.arguments[1].type === "ThisExpression" &&
							node.arguments[0].type === "MemberExpression";
						const callee = applied ? node.arguments[0] : node.callee;
						if (
							(!applied && node.optional) ||
							callee.type !== "MemberExpression" ||
							callee.optional ||
							callee.computed
						)
							return;
						let iface;
						if (callee.object.type === "Super")
							iface = frame.member.parent.parent.superClass?.name;
						else if (
							callee.object.type === "NewExpression" &&
							isNativeReceiverCall(callee.object)
						)
							iface = callee.object.callee.property.name;
						else return;
						if (nativeMember(iface, callee.property.name)) mark();
					},

					onCodePathEnd(codePath) {
						const frame = frames.pop();
						if (!frame || !frame.member) return;

						const out = reachedSegments(
							codePath,
							frame.marked,
							frame.catchEntries
						);
						const escapes = codePath.returnedSegments.filter(
							(segment) => segment.reachable && out.get(segment.id) !== true
						);
						if (escapes.length === 0) return;

						const cls = frame.member.parent.parent;
						const iface =
							cls.superClass && cls.superClass.type === "Identifier"
								? cls.superClass.name
								: "instance";

						context.report({
							node: frame.member.key,
							messageId: "missingBrandCheck",
							data: { name: memberName(frame.member), iface },
						});
					},
				};
			},
		},
	},
};

export default brandCheckPlugin;
