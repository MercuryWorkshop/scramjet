import { defineConfig } from "vite";
import { scramjetPath } from "@mercuryworkshop/scramjet";

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
			],
		}),
	],
});
