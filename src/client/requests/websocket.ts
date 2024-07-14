import { BareClient } from "@mercuryworkshop/bare-mux"
const client = new BareClient()
WebSocket = new Proxy(WebSocket, {
    construct(target, args) {
        return client.createWebSocket(
            args[0],
            args[1],
            target,
            {
                "User-Agent": navigator.userAgent
            },
            ArrayBuffer.prototype
        )
    }
});