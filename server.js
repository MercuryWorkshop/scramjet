// Dev server imports
import { createBareServer } from "@tomphttp/bare-server-node";
import { createServer } from "http"; 
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import fs from "node:fs"
import { fileURLToPath } from "node:url";
import { watch } from "rollup"
import { loadConfigFile } from "rollup/loadConfigFile"

//transports
import { baremuxPath } from "@mercuryworkshop/bare-mux/node"
import { epoxyPath } from "@mercuryworkshop/epoxy-transport"
import { libcurlPath } from "@mercuryworkshop/libcurl-transport"
import { bareModulePath } from "@mercuryworkshop/bare-as-module3"

let watcher = watch()

const bare = createBareServer("/bare/", {
    logErrors: true
});

const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                if (bare.shouldRoute(req)) {
                    bare.routeRequest(req, res);
                } else {
                    handler(req, res);
                }
            }).on("upgrade", (req, socket, head) => {
                if (bare.shouldRoute(req)) {
                    bare.routeUpgrade(req, socket, head);
                } else {
                    socket.end();
                }
            })
    }
});

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
    decorateReply: false
});
fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./dist"),
    prefix: "/dist/",
    decorateReply: false
})
fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false
})
fastify.register(fastifyStatic, {
    root: epoxyPath,
    prefix: "/epoxy/",
    decorateReply: false
})
fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false
})
fastify.register(fastifyStatic, {
    root: bareModulePath,
    prefix: "/baremod/",
    decorateReply: false
})
fastify.listen({
    port: process.env.PORT || 1337
});