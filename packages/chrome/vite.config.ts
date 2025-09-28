import { defineConfig } from "vite";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";

import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: scramjetPath + "/*",
					dest: "scram/",
				},
				{
					src: "../inject/dist/inject.js",
					dest: ".",
				},
				// {
				// 	src: "../chii/public/*",
				// 	dest: "chii",
				// },
			],
		}),
	],
});
