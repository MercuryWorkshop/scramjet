import { viteStaticCopy } from "vite-plugin-static-copy";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { controllerPath } from "@mercuryworkshop/scramjet-controller/path"

export default {
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: scramjetPath,
					dest: "scramjet",
				},
				{
					src: controllerPath,
					dest: "controller",
				},
			],
			watch: {
				reloadPageOnChange: true,
			},
		}),
	],
};
