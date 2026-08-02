// public/sw.js
// Service Worker (public/sw.js) — intercepts and routes fetch events to the server-side HTTP proxy endpoint.

const PROXY_HTTP_ENDPOINT = '/api/proxy/http';
const PROXY_SIGNAL_HEADER = 'x-andromeda-proxy';

self.addEventListener('install', (evt) => {
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  try {
    const req = event.request;
    const isControlledRequest = req.headers.get(PROXY_SIGNAL_HEADER) === '1' || (event.clientId !== undefined && event.request.mode !== 'navigate');

    if (!isControlledRequest) {
      return;
    }

    event.respondWith((async () => {
      const serializedHeaders = {};
      for (const [k, v] of req.headers.entries()) {
        serializedHeaders[k] = v;
      }

      const body = (req.method === 'GET' || req.method === 'HEAD') ? null : await req.clone().arrayBuffer();

      const proxied = await fetch(PROXY_HTTP_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-andromeda-sw': '1'
        },
        body: JSON.stringify({
          url: req.url,
          method: req.method,
          headers: serializedHeaders,
          body: body ? arrayBufferToBase64(body) : null,
        })
      });

      if (proxied.headers.get('content-type')?.startsWith('application/json')) {
        const payload = await proxied.json();
        const responseHeaders = new Headers(payload.headers || {});
        const buffer = payload.bodyBase64 ? base64ToArrayBuffer(payload.bodyBase64) : new ArrayBuffer(0);
        return new Response(buffer, {
          status: payload.status || 200,
          headers: responseHeaders
        });
      } else {
        return proxied;
      }
    })());
  } catch (err) {
    console.error('[Andromeda SW] fetch handler error', err);
    return;
  }
});

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, i, i + chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
