import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { join } from "node:path";
import fs from "node:fs" 
import { fileURLToPath } from "node:url";

// check if its
const production = !process.env.ROLLUP_WATCH;
console.log(production)
fs.rmSync(join(fileURLToPath(new URL(".", import.meta.url)), "./dist"), { recursive: true, force: true })

const commonPlugins = () => [
    typescript(),
    nodeResolve(),
]

export default {
    plugins: commonPlugins(),
    input: {
        client: "./src/client/index.ts",
        bundle: "./src/bundle/index.ts",
        worker: "./src/worker/index.ts",
        codecs: "./src/codecs/index.ts",
        config: "./src/scramjet.config.ts"
    },
    output: {
        entryFileNames: "scramjet.[name].js",
        dir: "./dist",
        format: "esm",
        bundle: true,
        minify: production,
        sourcemap: true,
        treeshake: "recommended",
    },
};
