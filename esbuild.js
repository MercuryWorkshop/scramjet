import { build } from "esbuild";
import time from "esbuild-plugin-time";
import { writeFileSync } from "fs"

const scramjetBuild = await build({
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
    metafile: true,
    treeShaking: true,
    minify: true,
    format: "esm"
});

writeFileSync("./meta.json", JSON.stringify(scramjetBuild.metafile));
