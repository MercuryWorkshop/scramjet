import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
    client.Proxy("MouseEvent.prototype.initMouseEvent", {
        apply(ctx) {
            // Proxy(Window) instanceof Window SHOULD return true. But uhh, it doesn't.
            ctx.args[3] = self;
            
            ctx.call();
        },
    })
}