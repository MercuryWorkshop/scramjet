import { viteStaticCopy } from "vite-plugin-static-copy";

export default {
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: "node_modules/@mercuryworkshop/scramjet/dist/*",
					dest: "scramjet",
				},
				{
					src: "node_modules/@mercuryworkshop/libcurl-transport/dist/*",
					dest: "libcurl-transport",
				},
				{
					src: "node_modules/@mercuryworkshop/scramjet-controller/dist/*",
					dest: "controller",
				},
			],
		}),
	],
};
