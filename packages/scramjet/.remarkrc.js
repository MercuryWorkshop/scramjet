export default {
	plugins: [
		"remark-frontmatter",
		"remark-mdx",
		[
			"remark-stringify",
			{
				bullet: "-",
				listItemIndent: "one",
				emphasis: "*",
				strong: "*",
				fences: true,
				fence: "`",
				rule: "-",
				incrementListMarker: true,
			},
		],
	],
};
