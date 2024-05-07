import { build } from "esbuild";
import time from "esbuild-plugin-time";

build({
    entryPoints: {
        client: "./src/client/index.ts",
        bundle: "./src/bundle/index.ts",
        worker: "./src/worker/index.ts",
        codecs: "./src/codecs/index.ts",
        config: "./src/scramjet.config.ts",
    },
    entryNames: "scramjet.[name]",
    outdir: "./dist",
    bundle: true,
    plugins: [
        time()
    ],
    logLevel: "info",
});