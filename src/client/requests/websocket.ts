import { BareClient } from "@mercuryworkshop/bare-mux"
const client = new BareClient()
const RealWebSocket = WebSocket
WebSocket = new Proxy(WebSocket, {
    construct(_target, args) {
        return client.createWebSocket(
            args[0],
            args[1],
            RealWebSocket,
            {
                "User-Agent": navigator.userAgent
            },
            ArrayBuffer.prototype
        )
    }
})