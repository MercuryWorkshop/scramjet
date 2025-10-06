import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	...compat
		.extends("eslint:recommended", "plugin:@typescript-eslint/recommended")
		.map((config) => ({
			...config,
			files: ["**/*.ts"],
		})),
	{
		ignores: ["dist", "rewriter"],
	},
	{
		files: ["**/*.ts"],
		plugins: {
			"@typescript-eslint": typescriptEslint,
		},

		languageOptions: {
			parser: tsParser,
		},

		rules: {
			"no-await-in-loop": "warn",
			"no-unused-labels": "warn",
			quotes: ["error", "double"],
			"getter-return": "error",
			"newline-before-return": "error",
			"no-multiple-empty-lines": "error",
			"no-var": "error",
			"no-this-before-super": "warn",
			"no-useless-return": "error",
			"no-shadow": "error",
			"prefer-const": "warn",
			"no-unreachable": "warn",
			"no-undef": "off",
			"no-empty": "off",
			"no-debugger": "off",
			"no-shadow": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/ban-types": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
];
