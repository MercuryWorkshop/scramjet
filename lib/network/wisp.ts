// lib/network/wisp.ts
export type RawFrame = Uint8Array;

export class WispClient {
  private ws: WebSocket | null = null;
  private onMessageCb: ((data: RawFrame) => void) | null = null;
  private onOpenCb: (() => void) | null = null;
  private onCloseCb: ((ev?: CloseEvent) => void) | null = null;
  private onErrorCb: ((err: any) => void) | null = null;

  constructor(private endpoint = '/api/wisp') {}

  connect() {
    return new Promise<void>((resolve, reject) => {
      const wsUrl = (typeof window !== 'undefined' && window.location.protocol === 'https:') ?
        `wss://${window.location.host}${this.endpoint}` :
        `ws://${window.location.host}${this.endpoint}`;

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.onOpenCb && this.onOpenCb();
        resolve();
      };
      this.ws.onmessage = (evt) => {
        const data = new Uint8Array(evt.data as ArrayBuffer);
        this.onMessageCb && this.onMessageCb(data);
      };
      this.ws.onclose = (ev) => {
        this.onCloseCb && this.onCloseCb(ev);
      };
      this.ws.onerror = (err) => {
        this.onErrorCb && this.onErrorCb(err);
        reject(err);
      };
    });
  }

  sendRaw(buf: ArrayBuffer | Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Wisp socket is not open');
    }
    this.ws.send(buf);
  }

  onMessage(cb: (data: RawFrame) => void) { this.onMessageCb = cb; }
  onOpen(cb: () => void) { this.onOpenCb = cb; }
  onClose(cb: (ev?: CloseEvent) => void) { this.onCloseCb = cb; }
  onError(cb: (err: any) => void) { this.onErrorCb = cb; }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export async function loadRustlsWasm(wasmUrl: string) {
  try {
    const resp = await fetch(wasmUrl);
    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const exports = instance.exports as any;
    return {
      handshake: async (socket: WispClient, serverName: string) => {
        return {
          send: (data: Uint8Array) => socket.sendRaw(data),
          close: () => socket.close()
        };
      },
      _rawExports: exports
    };
  } catch (err) {
    console.warn('[Andromeda] failed to load rustls wasm', err);
    return {
      handshake: async () => {
        throw new Error('rustls WASM not available');
      }
    };
  }
}
