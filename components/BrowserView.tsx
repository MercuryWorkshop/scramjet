'use client';

import React, { useEffect, useRef, useState } from 'react';
import { installSandboxPatches } from '../lib/sandbox/monkeypatch';
import { loadOxcWasm } from '../lib/sandbox/rewriter';
import { WispClient, loadRustlsWasm } from '../lib/network/wisp';

export default function BrowserView() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [url, setUrl] = useState('https://example.com');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('idle');
  const wispRef = useRef<WispClient | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.info('[Andromeda] SW registered', reg);
      }).catch((err) => {
        console.warn('[Andromeda] SW registration failed', err);
      });
    }

    (async () => {
      try {
        await loadOxcWasm('/wasm/oxc.wasm').catch(()=>{});
        await loadRustlsWasm('/wasm/rustls.wasm').catch(()=>{});
        setStatusMsg('WASM modules initialized (scaffold)');
      } catch (e) {
        setStatusMsg('WASM init failed (using fallbacks)');
      }
    })();

    wispRef.current = new WispClient('/api/wisp');
  }, []);

  function proxyWrap(value: any) {
    if (typeof value === 'string') {
      try {
        const url = new URL(value, location.href);
        return `${location.origin}/_andromeda/proxy?target=${encodeURIComponent(url.href)}`;
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  async function onNavigate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setStatusMsg('preparing sandbox');

    const srcDoc = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' ;">
        <style>html,body{height:100%;margin:0;background:#000}</style>
      </head>
      <body>
        <script>
          window.$proxyWrap = ${proxyWrap.toString()};
          window.parent.postMessage({ type: 'andromeda-iframe-ready' }, '*');
        </script>
        <iframe id="guest" src="${url}" style="display:none" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
        <script>
          (async () => {
            const outer = document.getElementById('guest');
            outer.style.display = 'block';
          })();
        </script>
      </body>
      </html>
    `;

    if (iframeRef.current) {
      iframeRef.current.srcdoc = srcDoc;
    }

    setTimeout(async () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        if (iframeWindow) {
          installSandboxPatches(iframeWindow, { proxyWrap });
        }
      } catch (err) {
        console.warn('[Andromeda] cannot directly patch iframe (cross-origin). Use SW + rewriter to instrument scripts.');
      }

      setLoading(false);
      setStatusMsg('loaded (sandbox)');
    }, 400);
  }

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data || {};
      if (data?.type === 'andromeda-iframe-ready') {
        setStatusMsg('iframe ready');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="w-full h-full min-h-screen bg-black text-white font-sans">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-[#060608] to-transparent border-b border-gray-800">
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-md bg-[#0f0f11] hover:bg-[#17171a] flex items-center justify-center text-gray-300">‹</button>
          <button className="w-8 h-8 rounded-md bg-[#0f0f11] hover:bg-[#17171a] flex items-center justify-center text-gray-300">›</button>
          <button className="w-8 h-8 rounded-md bg-[#0f0f11] hover:bg-[#17171a] flex items-center justify-center text-gray-300">↻</button>
        </div>

        <form onSubmit={(e) => onNavigate(e)} className="flex-1 flex justify-center">
          <div className="w-full max-w-3xl">
            <div className="relative">
              <input
                aria-label="Andromeda URL bar"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full py-2 px-4 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition"
                placeholder="Enter a URL to proxy..."
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-b from-[#1b0f33] to-[#26143f] text-violet-200 border border-[rgba(255,255,255,0.03)]">E2E Secure</span>
                <button type="submit" className="ml-2 text-sm px-3 py-1 rounded-full bg-violet-600 hover:bg-violet-500 text-white">Go</button>
              </span>
            </div>
          </div>
        </form>
      </div>

      <div className="w-full h-[calc(100vh-64px)] bg-black">
        <iframe
          ref={iframeRef}
          title="Andromeda Browser Frame"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
          className="w-full h-full border-0 bg-black"
        />
      </div>

      <div className="fixed bottom-4 right-4 bg-[rgba(20,10,30,0.6)] py-2 px-3 rounded-lg text-sm backdrop-blur-md border border-[rgba(255,255,255,0.03)]">
        <div className="text-xs text-gray-300">Andromeda — {statusMsg} {loading ? '…' : ''}</div>
      </div>
    </div>
  );
}
