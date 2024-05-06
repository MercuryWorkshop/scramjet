import { createServer } from "esbuild-server";
import copy from "esbuild-plugin-copy";
import time from "esbuild-plugin-time";

const devServer = createServer({
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
    sourcemap: true,
    plugins: [
        copy({
            resolveFrom: "cwd",
            assets: {
                from: ["./dist/*"],
                to: ["./static"]
            }
        }),
        time()
    ]
}, {
    static: "./static",
    port: 1337,
    proxy: (path) => {
        if (path.startsWith("/bare")) {
            return path.replace("/bare", "http://127.0.0.1:3000")
        }
    },
    injectLiveReload: false
});

devServer.start();