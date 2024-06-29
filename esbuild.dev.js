import { createServer } from "esbuild-server";
import copy from "esbuild-plugin-copy";
import time from "esbuild-plugin-time";
import "dotenv/config"

const devServer = createServer({
    entryPoints: {
        client: "./src/client/index.ts",
        bundle: "./src/bundle/index.ts",
        worker: "./src/worker/index.ts",
        codecs: "./src/codecs/index.ts",
        bootstrapper: "./src/scramjet.bootstrapper.ts",
    },
    entryNames: "scramjet.[name]",
    outdir: "./dist",
    bundle: true,
    sourcemap: true,
    logLevel: "info",
    plugins: [
        copy({
            resolveFrom: "cwd",
            assets: [
                {
                    from: ["./node_modules/@mercuryworkshop/bare-mux/dist/bare.cjs"],
                    to: ["./static/bare-mux.js"],
                },
                {
                    from: ["./node_modules/@mercuryworkshop/bare-as-module3/dist/bare.cjs"],
                    to: ["./static/bare-client.js"],
                },
                {
                    from: ["./node_modules/@mercuryworkshop/libcurl-transport/dist/index.cjs"],
                    to: ["./static/curl-client.js"],
                },
                {
                    from: ["./node_modules/@mercuryworkshop/epoxy-transport/dist/index.js"],
                    to: ["./static/epoxy-client.js"],
                },
                {
                    from: ["./dist/*"],
                    to: ["./static"]
                },
            ],
        }),
        time()
    ]
}, {
    static: "./static",
    port: process.env.PORT || 1337,
    proxy: (path) => {
        if (path.startsWith("/bare/")) {
            return path.replace("/bare/", "http://127.0.0.1:3000/")
        }
    },
    injectLiveReload: false
});

devServer.start();