/**
 * Flags member access and calls on values from ctx.this / ctx.args / ctx.get()
 * inside Proxy apply/construct-style handlers (first parameter name configurable).
 */

function unwrapTS(node) {
	if (!node) return node;
	const t = node.type;
	if (
		t === "TSAsExpression" ||
		t === "TSNonNullExpression" ||
		t === "TSSatisfiesExpression" ||
		t === "TSTypeAssertion"
	) {
		return unwrapTS(node.expression);
	}
	return node;
}

function isCtxIdentifier(node, contextParamNames) {
	const u = unwrapTS(node);
	return u.type === "Identifier" && contextParamNames.has(u.name);
}

/** ctx.this or ctx.args (the expression itself is a foreign-realm handle). */
function isDirectCtxRealmMember(node, contextParamNames) {
	const n = unwrapTS(node);
	if (n.type !== "MemberExpression" || n.optional) return false;
	if (!isCtxIdentifier(n.object, contextParamNames)) return false;
	if (n.computed) return false;
	if (n.property.type !== "Identifier") return false;
	const name = n.property.name;
	return name === "this" || name === "args";
}

function isCtxGetCallExpression(node, contextParamNames) {
	const n = unwrapTS(node);
	if (n.type !== "CallExpression") return false;
	const c = unwrapTS(n.callee);
	if (c.type !== "MemberExpression" || c.optional || c.computed) return false;
	if (!isCtxIdentifier(c.object, contextParamNames)) return false;
	if (c.property.type !== "Identifier" || c.property.name !== "get") {
		return false;
	}
	return true;
}

function isInterceptorFunction(node, contextParamNames) {
	const p0 = node.params[0];
	if (!p0) return false;
	const id = unwrapTS(p0);
	return id.type === "Identifier" && contextParamNames.has(id.name);
}

function isDirectAssignmentTarget(node) {
	const parent = node.parent;
	if (!parent) return false;
	if (parent.type === "AssignmentExpression" && parent.left === node) {
		return true;
	}
	if (parent.type === "UpdateExpression" && parent.argument === node) {
		return true;
	}
	if (parent.type === "UnaryExpression" && parent.operator === "delete") {
		return parent.argument === node;
	}
	return false;
}

/**
 * Reads that only branch on truthiness or typeof (no arbitrary property access).
 */
function isBenignPoisonRead(node) {
	const parent = node.parent;
	if (!parent) return false;
	if (
		parent.type === "UnaryExpression" &&
		parent.operator === "typeof" &&
		parent.argument === node
	) {
		return true;
	}
	if (parent.type === "IfStatement" && parent.test === node) {
		return true;
	}
	if (parent.type === "WhileStatement" && parent.test === node) {
		return true;
	}
	if (parent.type === "DoWhileStatement" && parent.test === node) {
		return true;
	}
	if (parent.type === "ConditionalExpression" && parent.test === node) {
		return true;
	}
	if (parent.type === "ForStatement" && parent.test === node) {
		return true;
	}
	if (
		parent.type === "UnaryExpression" &&
		parent.operator === "!" &&
		parent.argument === node
	) {
		const gp = parent.parent;
		if (!gp) return false;
		if (gp.type === "IfStatement" && gp.test === parent) return true;
		if (gp.type === "WhileStatement" && gp.test === parent) return true;
		if (gp.type === "DoWhileStatement" && gp.test === parent) return true;
		if (gp.type === "ConditionalExpression" && gp.test === parent) return true;
		if (gp.type === "ForStatement" && gp.test === parent) return true;
	}
	return false;
}

/** `x === null`, `x !== undefined`, etc. (no property reads on the compared value). */
function isBenignNullishCompare(node) {
	const p = node.parent;
	if (!p || p.type !== "BinaryExpression") return false;
	if (!["===", "!==", "==", "!="].includes(p.operator)) return false;
	const other = p.left === node ? p.right : p.right === node ? p.left : null;
	if (!other) return false;
	const u = unwrapTS(other);
	if (u.type === "Literal" && u.value === null) return true;
	if (u.type === "Identifier" && u.name === "undefined") return true;
	return false;
}

const poisonedCtxPlugin = {
	rules: {
		"no-poisoned-ctx-value": {
			meta: {
				type: "problem",
				docs: {
					description:
						"disallow reading or calling values from ctx.this, ctx.args, and ctx.get() in interceptors",
				},
				schema: [
					{
						type: "object",
						properties: {
							contextParamNames: {
								type: "array",
								items: { type: "string" },
								uniqueItems: true,
							},
						},
						additionalProperties: false,
					},
				],
				messages: {
					noMemberOfPoison:
						"Do not access properties on values from another realm (from ctx.this, ctx.args, or ctx.get()). Assign through ctx.* only when required, or use client APIs that accept the raw reference.",
					noCallPoison:
						"Do not call values from another realm as functions. Values from ctx.this, ctx.args, or ctx.get() are attacker-controlled.",
					noSpreadPoison:
						"Do not spread values from ctx.this, ctx.args, or ctx.get(); they are attacker-controlled.",
				},
			},
			create(context) {
				const sourceCode = context.sourceCode;
				const contextParamNames = new Set(
					context.options[0]?.contextParamNames ?? ["ctx"]
				);
				const reported = new WeakSet();

				/** @type {Array<Map<string, boolean>>} */
				const scopeStack = [];
				let interceptorDepth = 0;

				function reportOnce(node, messageId) {
					if (reported.has(node)) return;
					reported.add(node);
					context.report({ node, messageId });
				}

				function currentPoisonMap() {
					return scopeStack[scopeStack.length - 1];
				}

				function lookupPoison(name) {
					for (let i = scopeStack.length - 1; i >= 0; i--) {
						const m = scopeStack[i];
						if (m.has(name)) return m.get(name);
					}
					return false;
				}

				function declarePoison(name, poisoned) {
					if (!scopeStack.length) return;
					scopeStack[scopeStack.length - 1].set(name, poisoned);
				}

				function exprIsPoisonValue(node) {
					const n = unwrapTS(node);
					if (!n) return false;
					if (n.type === "Identifier") return lookupPoison(n.name);
					if (n.type === "MemberExpression") {
						if (isDirectCtxRealmMember(n, contextParamNames)) return true;
						return exprIsPoisonValue(n.object);
					}
					if (n.type === "CallExpression") {
						if (isCtxGetCallExpression(n, contextParamNames)) return true;
						return exprIsPoisonValue(n.callee);
					}
					if (n.type === "ChainExpression") {
						return exprIsPoisonValue(n.expression);
					}
					return false;
				}

				function addPatternBindings(pattern, poisoned) {
					if (!pattern) return;
					if (pattern.type === "Identifier") {
						declarePoison(pattern.name, poisoned);
						return;
					}
					if (pattern.type === "ObjectPattern") {
						for (const prop of pattern.properties) {
							if (prop.type === "Property") {
								addPatternBindings(prop.value, poisoned);
							} else if (prop.type === "RestElement") {
								addPatternBindings(prop.argument, poisoned);
							}
						}
						return;
					}
					if (pattern.type === "ArrayPattern") {
						for (const el of pattern.elements) {
							if (el) addPatternBindings(el, poisoned);
						}
					}
				}

				function processAssignmentLike(left, right) {
					const poisoned = exprIsPoisonValue(right);
					const u = unwrapTS(left);
					if (u.type === "Identifier") {
						declarePoison(u.name, poisoned);
					} else if (u.type === "ObjectPattern" || u.type === "ArrayPattern") {
						if (poisoned) addPatternBindings(u, true);
					}
				}

				function enterFunction(node) {
					scopeStack.push(new Map());
					if (isInterceptorFunction(node, contextParamNames)) {
						interceptorDepth++;
					}
				}

				function exitFunction(node) {
					if (isInterceptorFunction(node, contextParamNames)) {
						interceptorDepth--;
					}
					scopeStack.pop();
				}

				return {
					FunctionDeclaration: enterFunction,
					"FunctionDeclaration:exit": exitFunction,
					FunctionExpression: enterFunction,
					"FunctionExpression:exit": exitFunction,
					ArrowFunctionExpression: enterFunction,
					"ArrowFunctionExpression:exit": exitFunction,

					VariableDeclarator(node) {
						if (interceptorDepth === 0 || !node.init) return;
						const poisoned = exprIsPoisonValue(node.init);
						addPatternBindings(node.id, poisoned);
					},

					AssignmentExpression(node) {
						if (interceptorDepth === 0) return;
						if (node.operator !== "=") {
							const u = unwrapTS(node.left);
							if (u.type === "Identifier") {
								declarePoison(u.name, exprIsPoisonValue(node.right));
							}
							return;
						}
						processAssignmentLike(node.left, node.right);
					},

					MemberExpression(node) {
						if (interceptorDepth === 0) return;
						if (isDirectAssignmentTarget(node)) return;
						if (isBenignPoisonRead(node)) return;
						if (isBenignNullishCompare(node)) return;
						if (
							node.parent?.type === "MemberExpression" &&
							node.parent.object === node
						) {
							return;
						}
						const subOfPoison = exprIsPoisonValue(node.object);
						const realmHandle = isDirectCtxRealmMember(node, contextParamNames);
						if (!subOfPoison && !realmHandle) return;
						reportOnce(node, "noMemberOfPoison");
					},

					CallExpression(node) {
						if (interceptorDepth === 0) return;
						if (isCtxGetCallExpression(node, contextParamNames)) {
							return;
						}
						const callee = unwrapTS(node.callee);
						if (!exprIsPoisonValue(callee)) return;
						reportOnce(node, "noCallPoison");
					},

					SpreadElement(node) {
						if (interceptorDepth === 0) return;
						if (!exprIsPoisonValue(node.argument)) return;
						reportOnce(node, "noSpreadPoison");
					},

					ForOfStatement(node) {
						if (interceptorDepth === 0) return;
						if (!exprIsPoisonValue(node.right)) return;
						reportOnce(node.right, "noMemberOfPoison");
					},
				};
			},
		},
	},
};

export default poisonedCtxPlugin;
