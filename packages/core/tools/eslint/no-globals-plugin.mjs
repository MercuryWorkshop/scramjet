const DEFAULT_ALLOWLIST = ["undefined"];

function isValueReference(reference) {
	if (typeof reference.isValueReference === "boolean") {
		return reference.isValueReference;
	}

	return true;
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
				const allowlist = new Set(
					context.options[0]?.allow ?? DEFAULT_ALLOWLIST
				);

				return {
					"Program:exit"(node) {
						const scope = sourceCode.getScope(node);

						for (const reference of scope.through) {
							if (reference.resolved || !isValueReference(reference)) {
								continue;
							}

							const identifier = reference.identifier;
							if (!identifier || allowlist.has(identifier.name)) {
								continue;
							}

							context.report({
								node: identifier,
								messageId: "unexpectedGlobal",
								data: {
									name: identifier.name,
								},
							});
						}
					},
				};
			},
		},
	},
};

export default noGlobalsPlugin;
