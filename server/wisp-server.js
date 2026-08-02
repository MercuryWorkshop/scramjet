// server/wisp-server.js
// Simple dev Wisp server: WebSocket -> TCP/TLS relay.
// Usage: node server/wisp-server.js
//
// Security: Development scaffold. Add auth and access controls before exposing.

const WebSocket = require('ws');
const net = require('net');
const tls = require('tls');

const PORT = process.env.WISP_PORT ? parseInt(process.env.WISP_PORT, 10) : 9001;

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[Andromeda Wisp] Listening on ws://0.0.0.0:${PORT}`);
});

wss.on('connection', (ws) => {
  console.info('[Andromeda Wisp] client connected');

  let remoteSocket = null;
  let connected = false;

  ws.once('message', (msg) => {
    try {
      const text = msg.toString('utf8');
      const initial = JSON.parse(text);
      const target = initial.target;
      if (!target || !target.host || !target.port) {
        ws.send(JSON.stringify({ error: 'invalid target' }));
        ws.close();
        return;
      }

      const useTls = !!target.tls;
      console.info(`[Andromeda Wisp] connecting to ${target.host}:${target.port} tls=${useTls}`);

      const onConnect = () => {
        connected = true;
        ws.send(JSON.stringify({ status: 'connected' }));
      };

      if (useTls) {
        remoteSocket = tls.connect({
          host: target.host,
          port: target.port,
          servername: target.host,
          rejectUnauthorized: false
        }, onConnect);
      } else {
        remoteSocket = net.connect({ host: target.host, port: target.port }, onConnect);
      }

      remoteSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      remoteSocket.on('close', () => {
        ws.close();
      });

      remoteSocket.on('error', (err) => {
        console.warn('[Andromeda Wisp] remote socket error', err);
        try { ws.close(); } catch {}
      });

      ws.on('message', (m) => {
        if (!connected) return;
        if (!remoteSocket) return;
        if (typeof m === 'string') {
          return;
        }
        remoteSocket.write(m);
      });

      ws.on('close', () => {
        try { remoteSocket && remoteSocket.end(); } catch {}
      });

      ws.on('error', (err) => {
        console.warn('[Andromeda Wisp] ws error', err);
      });

    } catch (err) {
      console.warn('[Andromeda Wisp] initial handshake error', err);
      ws.send(JSON.stringify({ error: 'handshake_failed' }));
      ws.close();
    }
  });

});

wss.on('error', (err) => {
  console.error('[Andromeda Wisp] server error', err);
});
