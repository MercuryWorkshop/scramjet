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

function getTSExpressionContainer(node) {
	let current = node;
	while (current.parent) {
		const parent = current.parent;
		if (
			(parent.type === "TSAsExpression" ||
				parent.type === "TSNonNullExpression" ||
				parent.type === "TSSatisfiesExpression" ||
				parent.type === "TSTypeAssertion") &&
			parent.expression === current
		) {
			current = parent;
			continue;
		}
		break;
	}
	return current;
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

function isDirectCtxArgElement(node, contextParamNames) {
	const n = unwrapTS(node);
	if (n.type !== "MemberExpression" || n.optional) return false;
	const object = unwrapTS(n.object);
	return isDirectCtxRealmMember(object, contextParamNames);
}

function isSafeCtxArgsLength(node, contextParamNames) {
	const n = unwrapTS(node);
	if (n.type !== "MemberExpression" || n.optional || n.computed) return false;
	if (n.property.type !== "Identifier" || n.property.name !== "length") {
		return false;
	}
	return isDirectCtxRealmMember(n.object, contextParamNames);
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

function isSnapshotStringCallCallee(node, snapshotStringNames) {
	const callee = unwrapTS(node);
	return callee.type === "Identifier" && snapshotStringNames.has(callee.name);
}

function isRawProxyCallCallee(node) {
	const callee = unwrapTS(node);
	if (
		callee.type !== "MemberExpression" ||
		callee.optional ||
		callee.computed
	) {
		return false;
	}
	if (
		callee.property.type !== "Identifier" ||
		callee.property.name !== "RawProxy"
	) {
		return false;
	}
	const object = unwrapTS(callee.object);
	return (
		object.type === "ThisExpression" ||
		(object.type === "Identifier" && object.name === "client")
	);
}

function isClientBoxInstanceofCallCallee(node) {
	const callee = unwrapTS(node);
	if (
		callee.type !== "MemberExpression" ||
		callee.optional ||
		callee.computed
	) {
		return false;
	}
	if (
		callee.property.type !== "Identifier" ||
		callee.property.name !== "instanceof"
	) {
		return false;
	}
	const object = unwrapTS(callee.object);
	if (
		object.type !== "MemberExpression" ||
		object.optional ||
		object.computed
	) {
		return false;
	}
	if (object.property.type !== "Identifier" || object.property.name !== "box") {
		return false;
	}
	const base = unwrapTS(object.object);
	return base.type === "Identifier" && base.name === "client";
}

function isAllowedMapConstructor(node, mapConstructorNames) {
	const callee = unwrapTS(node);
	return callee.type === "Identifier" && mapConstructorNames.has(callee.name);
}

function isMapMethodName(name) {
	return (
		name === "get" || name === "has" || name === "delete" || name === "set"
	);
}

function isAllowedMapMethodArgumentIndex(name, index) {
	if (name === "set") return index === 0 || index === 1;
	return index === 0;
}

function isAllowedPoisonSink(
	node,
	contextParamNames,
	snapshotStringNames,
	isMapLikeObject
) {
	const candidate = getTSExpressionContainer(node);
	const parent = candidate.parent;
	if (!parent) return false;

	if (
		parent.type === "TemplateLiteral" &&
		parent.expressions.includes(candidate)
	) {
		return true;
	}

	if (parent.type !== "CallExpression" && parent.type !== "NewExpression") {
		return false;
	}

	const argumentIndex = parent.arguments.indexOf(candidate);
	if (argumentIndex === -1) return false;

	if (
		parent.type === "CallExpression" &&
		isSnapshotStringCallCallee(parent.callee, snapshotStringNames) &&
		(isDirectCtxRealmMember(node, contextParamNames) ||
			isDirectCtxArgElement(node, contextParamNames))
	) {
		return true;
	}

	if (parent.type === "CallExpression" && isRawProxyCallCallee(parent.callee)) {
		return true;
	}

	if (parent.type === "CallExpression") {
		const callee = unwrapTS(parent.callee);
		if (
			callee.type === "MemberExpression" &&
			!callee.optional &&
			!callee.computed &&
			callee.property.type === "Identifier" &&
			isMapMethodName(callee.property.name) &&
			isAllowedMapMethodArgumentIndex(callee.property.name, argumentIndex) &&
			isMapLikeObject(callee.object)
		) {
			return true;
		}
	}

	return (
		parent.type === "CallExpression" &&
		argumentIndex === 0 &&
		isClientBoxInstanceofCallCallee(parent.callee) &&
		(isDirectCtxRealmMember(node, contextParamNames) ||
			isDirectCtxArgElement(node, contextParamNames))
	);
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
				const snapshotStringNames = new Set();
				const mapConstructorNames = new Set(["Map", "WeakMap"]);
				const mapLikePropertyNames = new Set();
				for (const node of sourceCode.ast.body) {
					if (node.type === "ImportDeclaration") {
						if (
							typeof node.source.value !== "string" ||
							!/(^|\/)snapshot$/.test(node.source.value)
						) {
							continue;
						}
						for (const specifier of node.specifiers) {
							if (
								specifier.type === "ImportSpecifier" &&
								specifier.imported.type === "Identifier" &&
								specifier.imported.name === "String"
							) {
								snapshotStringNames.add(specifier.local.name);
							}
							if (
								specifier.type === "ImportSpecifier" &&
								specifier.imported.type === "Identifier" &&
								(specifier.imported.name === "_Map" ||
									specifier.imported.name === "_WeakMap")
							) {
								mapConstructorNames.add(specifier.local.name);
							}
						}
						continue;
					}

					if (node.type !== "ClassDeclaration") continue;
					for (const member of node.body.body) {
						if (
							member.type !== "PropertyDefinition" ||
							member.computed ||
							member.key.type !== "Identifier" ||
							!member.value
						) {
							continue;
						}
						const value = unwrapTS(member.value);
						if (
							value.type === "NewExpression" &&
							isAllowedMapConstructor(value.callee, mapConstructorNames)
						) {
							mapLikePropertyNames.add(member.key.name);
						}
					}
				}
				const contextParamNames = new Set(
					context.options[0]?.contextParamNames ?? ["ctx"]
				);
				const reported = new WeakSet();

				/** @type {Array<Map<string, boolean>>} */
				const scopeStack = [];
				/** @type {Array<Map<string, boolean>>} */
				const mapLikeStack = [];
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

				function lookupMapLike(name) {
					for (let i = mapLikeStack.length - 1; i >= 0; i--) {
						const m = mapLikeStack[i];
						if (m.has(name)) return m.get(name);
					}
					return false;
				}

				function declareMapLike(name, mapLike) {
					if (!mapLikeStack.length) return;
					mapLikeStack[mapLikeStack.length - 1].set(name, mapLike);
				}

				function exprIsMapLikeObject(node) {
					const n = unwrapTS(node);
					if (!n) return false;
					if (n.type === "Identifier") return lookupMapLike(n.name);
					if (
						n.type === "MemberExpression" &&
						!n.optional &&
						!n.computed &&
						n.property.type === "Identifier"
					) {
						return mapLikePropertyNames.has(n.property.name);
					}
					if (n.type === "NewExpression") {
						return isAllowedMapConstructor(n.callee, mapConstructorNames);
					}
					return false;
				}

				function exprIsPoisonValue(node) {
					const n = unwrapTS(node);
					if (!n) return false;
					if (n.type === "Identifier") return lookupPoison(n.name);
					if (n.type === "MemberExpression") {
						if (isSafeCtxArgsLength(n, contextParamNames)) return false;
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
					const mapLike = exprIsMapLikeObject(right);
					const u = unwrapTS(left);
					if (u.type === "Identifier") {
						declarePoison(u.name, poisoned);
						declareMapLike(u.name, mapLike);
					} else if (u.type === "ObjectPattern" || u.type === "ArrayPattern") {
						if (poisoned) addPatternBindings(u, true);
					} else if (
						u.type === "MemberExpression" &&
						!u.optional &&
						!u.computed &&
						u.property.type === "Identifier" &&
						mapLike
					) {
						mapLikePropertyNames.add(u.property.name);
					}
				}

				function enterFunction(node) {
					scopeStack.push(new Map());
					mapLikeStack.push(new Map());
					if (isInterceptorFunction(node, contextParamNames)) {
						interceptorDepth++;
					}
				}

				function exitFunction(node) {
					if (isInterceptorFunction(node, contextParamNames)) {
						interceptorDepth--;
					}
					scopeStack.pop();
					mapLikeStack.pop();
				}

				return {
					FunctionDeclaration: enterFunction,
					"FunctionDeclaration:exit": exitFunction,
					FunctionExpression: enterFunction,
					"FunctionExpression:exit": exitFunction,
					ArrowFunctionExpression: enterFunction,
					"ArrowFunctionExpression:exit": exitFunction,

					VariableDeclarator(node) {
						if (!node.init) return;
						const poisoned = exprIsPoisonValue(node.init);
						const mapLike = exprIsMapLikeObject(node.init);
						if (interceptorDepth !== 0) {
							addPatternBindings(node.id, poisoned);
						}
						const id = unwrapTS(node.id);
						if (id.type === "Identifier") {
							declareMapLike(id.name, mapLike);
						}
					},

					AssignmentExpression(node) {
						if (node.operator !== "=") {
							const u = unwrapTS(node.left);
							if (interceptorDepth !== 0 && u.type === "Identifier") {
								declarePoison(u.name, exprIsPoisonValue(node.right));
							}
							if (u.type === "Identifier") {
								declareMapLike(u.name, exprIsMapLikeObject(node.right));
							}
							return;
						}
						processAssignmentLike(node.left, node.right);
					},

					MemberExpression(node) {
						if (interceptorDepth === 0) return;
						if (isDirectAssignmentTarget(node)) return;
						if (isSafeCtxArgsLength(node, contextParamNames)) return;
						if (isBenignPoisonRead(node)) return;
						if (isBenignNullishCompare(node)) return;
						if (
							isAllowedPoisonSink(
								node,
								contextParamNames,
								snapshotStringNames,
								exprIsMapLikeObject
							)
						) {
							return;
						}
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
