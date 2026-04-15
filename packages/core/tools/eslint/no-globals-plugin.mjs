const DEFAULT_ALLOWLIST = ["undefined"];

function isValueReference(reference) {
	if (typeof reference.isValueReference === "boolean") {
		return reference.isValueReference;
	}

	return true;
}

/** TS lib globals (e.g. DataView) are ImplicitLibVariable with own isValueVariable; ordinary Variable uses getters. */
function isImplicitLibVariable(variable) {
	return Object.hasOwn(variable, "isValueVariable");
}

function getGlobalScope(scope) {
	let s = scope;
	while (s.upper) s = s.upper;
	return s;
}

const noGlobalsPlugin = {
	rules: {
		"no-globals": {
			meta: {
				type: "problem",
				docs: {
					description: "disallow runtime global access",
				},
				schema: [
					{
						type: "object",
						properties: {
							allow: {
								type: "array",
								items: {
									type: "string",
								},
								uniqueItems: true,
							},
						},
						additionalProperties: false,
					},
				],
				messages: {
					unexpectedGlobal:
						"Do not use runtime global '{{name}}'. Access it through scramjet wrappers instead.",
				},
			},
			create(context) {
				const sourceCode = context.sourceCode;
				const allowlist = new Set([
					...DEFAULT_ALLOWLIST,
					...(context.options[0]?.allow ?? []),
				]);

				return {
					"Program:exit"(node) {
						const programScope = sourceCode.getScope(node);
						const globalScope = getGlobalScope(programScope);
						const reported = new Set();

						function reportGlobal(identifier) {
							if (!identifier || allowlist.has(identifier.name)) {
								return;
							}
							if (reported.has(identifier)) {
								return;
							}
							reported.add(identifier);
							context.report({
								node: identifier,
								messageId: "unexpectedGlobal",
								data: {
									name: identifier.name,
								},
							});
						}

						for (const reference of programScope.through) {
							if (reference.resolved || !isValueReference(reference)) {
								continue;
							}

							reportGlobal(reference.identifier);
						}

						for (const variable of globalScope.variables) {
							if (!isImplicitLibVariable(variable)) {
								continue;
							}

							// TS lib can mark names as type-only (isValueVariable false) after later lib
							// layers override; value uses still resolve here and must be flagged.
							for (const reference of variable.references) {
								if (!isValueReference(reference)) {
									continue;
								}

								reportGlobal(reference.identifier);
							}
						}

						// `globalThis` resolves as a normal env global, not a TS ImplicitLibVariable,
						// so it is not covered by the loops above.
						const globalThisVar =
							globalScope.set?.get("globalThis") ??
							globalScope.variables.find((v) => v.name === "globalThis");
						if (globalThisVar) {
							for (const reference of globalThisVar.references) {
								if (!isValueReference(reference)) {
									continue;
								}

								reportGlobal(reference.identifier);
							}
						}
					},
				};
			},
		},
	},
};

export default noGlobalsPlugin;
