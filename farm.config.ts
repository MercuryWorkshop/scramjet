import { defineConfig } from "@farmfe/core";
// import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { join } from "path";

import sj from "scramjet-farm-plugin";

export default defineConfig({
	plugins: [sj()],
	compilation: {
		presetEnv: false,
		mode: "development",
		sourcemap: false,
		input: {
			worker: "src/worker/index.ts",
			thread: "src/thread/thread.ts",
			client: "src/client/index.ts",
			config: "src/scramjet.config.ts",
		},
		output: {
			path: "dist",
			format: "cjs",
			targetEnv: "browser-esnext",
			entryFilename: "scramjet.[entryName].js",
			filename: "scramjet.split.[name].js",
		},
	},
});
