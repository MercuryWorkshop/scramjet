import { defineConfig } from "vite";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { scramjetPath } from "@mercuryworkshop/scramjet";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

import { viteStaticCopy } from "vite-plugin-static-copy";
console.log(epoxyPath, baremuxPath);

export default defineConfig({
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: epoxyPath + "/*",
					dest: "epoxy/",
				},
				{
					src: baremuxPath + "/*",
					dest: "baremux/",
				},
				{
					src: scramjetPath + "/*",
					dest: "scram/",
				},
			],
		}),
	],
});
