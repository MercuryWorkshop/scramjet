import { viteStaticCopy } from "vite-plugin-static-copy";

export default {
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: "node_modules/@mercuryworkshop/scramjet/dist/*",
					dest: "assets",
					rename: (fileName, fileExtension) =>
						`${fileExtension ? `${fileName}.${fileExtension}` : fileName}`.replace(
							/scramjet/g,
							"app"
						),
				},
				{
					src: "node_modules/@mercuryworkshop/scramjet-controller/dist/*",
					dest: "assets",
					rename: (fileName, fileExtension) =>
						`${fileExtension ? `${fileName}.${fileExtension}` : fileName}`.replace(
							/controller/g,
							"core"
						),
				},
			],
			watch: {
				reloadPageOnChange: true,
			},
		}),
	],
};
