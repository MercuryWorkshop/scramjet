// lib/sandbox/rewriter.ts
type OxcWasmModule = {
  parse_and_rewrite: (ptr: number, len: number) => number;
  memory: WebAssembly.Memory;
  alloc: (size: number) => number;
  dealloc: (ptr: number, size: number) => void;
};

let oxcWasm: OxcWasmModule | null = null;

export async function loadOxcWasm(wasmUrl: string): Promise<void> {
  if (oxcWasm) return;
  try {
    const resp = await fetch(wasmUrl);
    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    oxcWasm = (instance.exports as unknown) as OxcWasmModule;
    console.info('[Andromeda] oxc wasm loaded');
  } catch (err) {
    console.warn('[Andromeda] failed to load oxc wasm, will use JS fallback', err);
    oxcWasm = null;
  }
}

export async function rewriteScript(source: string): Promise<string> {
  if (oxcWasm) {
    try {
      const enc = new TextEncoder();
      const input = enc.encode(source);
      const ptr = (oxcWasm as any).alloc(input.length);
      const mem = new Uint8Array((oxcWasm as any).memory.buffer, ptr, input.length);
      mem.set(input);
      const outPtr = (oxcWasm as any).parse_and_rewrite(ptr, input.length);
      const view = new DataView((oxcWasm as any).memory.buffer, outPtr);
      const outLen = view.getUint32(0, true);
      const outBytes = new Uint8Array((oxcWasm as any).memory.buffer, outPtr + 4, outLen);
      const dec = new TextDecoder();
      const rewritten = dec.decode(outBytes);
      (oxcWasm as any).dealloc(ptr, input.length);
      (oxcWasm as any).dealloc(outPtr, outLen + 4);
      return rewritten;
    } catch (err) {
      console.warn('[Andromeda] wasm rewrite failed, falling back', err);
    }
  }

  const idents = ['location', 'history', 'navigator', 'document'];
  let out = source;
  for (const id of idents) {
    const re = new RegExp('([^\\w\\.$])' + id + '([^\\w])', 'g');
    out = out.replace(re, (_m, p1, p2) => `${p1}$proxyWrap(${id})${p2}`);
    const re2 = new RegExp('^' + id + '([^\\w])', 'm');
    out = out.replace(re2, (_m, p1) => `$proxyWrap(${id})${p1}`);
  }
  return out;
}
