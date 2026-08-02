// app/api/proxy/http/route.ts
// Next.js App Router Route Handler - HTTP relay for service-worker forwarded requests.
// Receives a JSON body:
// { url: string, method: string, headers: Record<string,string>, body: base64 | null }
// Returns JSON: { status: number, headers: Record<string,string>, bodyBase64: string | null }

import type { NextRequest } from 'next/server';

function sanitizeOutgoingHeaders(headers: Headers) {
  const banned = new Set([
    'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade'
  ]);
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    if (!banned.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const targetUrl = payload.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'missing target url' }), { status: 400 });
    }

    const method = payload.method || 'GET';
    const incomingHeaders = payload.headers || {};
    const headers = new Headers();

    for (const [k, v] of Object.entries(incomingHeaders as Record<string, string>)) {
      if (k.toLowerCase() === 'authorization') continue;
      headers.set(k, v as string);
    }

    headers.set('x-andromeda-proxy', '1');

    let body: BodyInit | undefined = undefined;
    if (payload.body) {
      const bytes = Uint8Array.from(atob(payload.body), c => c.charCodeAt(0));
      body = bytes.buffer;
    }

    const resp = await fetch(targetUrl, { method, headers, body, redirect: 'manual' });

    const arrayBuf = await resp.arrayBuffer();
    const u8 = new Uint8Array(arrayBuf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.prototype.slice.call(u8, i, i + chunk));
    }
    const bodyBase64 = u8.length ? btoa(bin) : null;

    const responseHeaders = sanitizeOutgoingHeaders(resp.headers);

    return new Response(JSON.stringify({
      status: resp.status,
      headers: responseHeaders,
      bodyBase64
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[Andromeda] proxy route error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    ok: true,
    message: 'Andromeda HTTP proxy endpoint - POST JSON to proxy requests.'
  }), { headers: { 'Content-Type': 'application/json' } });
}

export default async function handler(req: NextRequest) {
  if (req.method === 'POST') return POST(req);
  return GET();
}
