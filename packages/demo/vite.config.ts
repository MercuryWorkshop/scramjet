import { viteStaticCopy } from "vite-plugin-static-copy";

const WISP_PORT = process.env.WISP_PORT || "4142";

export default {
	server: {
		host: "0.0.0.0",
		allowedHosts: true,
		proxy: {
			"/wisp": {
				target: `ws://127.0.0.1:${WISP_PORT}`,
				changeOrigin: true,
				ws: true,
			},
		},
	},
	plugins: [
		viteStaticCopy({
			structured: false,
			targets: [
				{
					src: "node_modules/@mercuryworkshop/scramjet/dist/*",
					dest: "scramjet",
				},
				{
					src: "node_modules/@mercuryworkshop/scramjet-controller/dist/*",
					dest: "controller",
				},
			],
			watch: {
				reloadPageOnChange: true,
			},
		}),
	],
};
