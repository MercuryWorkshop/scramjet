const noInstanceofPlugin = {
	rules: {
		"no-instanceof": {
			meta: {
				type: "problem",
				docs: {
					description: "disallow the `instanceof` operator",
				},
				schema: [],
				messages: {
					noInstanceof:
						"Do not use `instanceof`; it breaks across realms. Use `box.instanceof` instead",
				},
			},
			create(context) {
				return {
					BinaryExpression(node) {
						if (node.operator !== "instanceof") {
							return;
						}

						context.report({
							node,
							messageId: "noInstanceof",
						});
					},
				};
			},
		},
	},
};

export default noInstanceofPlugin;
