import { build } from "esbuild";
import time from "esbuild-plugin-time";
// import { writeFileSync } from "fs"

const scramjetBuild = await build({
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
    plugins: [
        time()
    ],
    logLevel: "info",
    // metafile: true,
    treeShaking: true,
    minify: true
});

// writeFileSync("./meta.json", JSON.stringify(scramjetBuild.metafile));
