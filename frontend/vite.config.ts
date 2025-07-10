import { defineConfig } from "vite";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
console.log(epoxyPath, baremuxPath);

export default defineConfig({
	plugins: [
		{
			name: "static-files",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (req.url.startsWith("/epoxy/")) {
						req.url = req.url.replace("/epoxy/", epoxyPath + "/");
					} else if (req.url.startsWith("/baremux/")) {
						req.url = req.url.replace("/baremux/", baremuxPath + "/");
					}
					next();
				});
			},
		},
	],
});
