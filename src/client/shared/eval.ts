import { ScramjetClient, ProxyCtx } from "../client";
import { rewriteJs } from "../shared";

function rewriteFunction(ctx: ProxyCtx) {
    for (const i in ctx.args) {
        ctx.args[i] = rewriteJs(ctx.args[i]);
    }

    ctx.return(ctx.fn(...ctx.args));
}

export default function (client: ScramjetClient, self: Self) {
    client.Proxy("Function", {
        apply(ctx) {
            rewriteFunction(ctx);
        },

        construct(ctx) {
            rewriteFunction(ctx);
        },
    });

    Function.prototype.constructor = Function;
}