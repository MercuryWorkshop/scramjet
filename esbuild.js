import { build } from "esbuild";
import copy from "esbuild-plugin-copy";
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
        copy({
            resolveFrom: "cwd",
            assets: {
                from: ["./dist/*"],
                to: ["./server/static"]
            }
        }),
        time()
    ]
});