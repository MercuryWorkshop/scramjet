// lib/sandbox/monkeypatch.ts
export type WindowLike = any;

export function installSandboxPatches(win: WindowLike, helpers: { proxyWrap: (value:any) => any }) {
  if (win.__andromeda_patch_installed) return;
  win.__andromeda_patch_installed = true;

  function wrapFunction(original: Function) {
    const handler = {
      apply(target: Function, thisArg: any, args: any[]) {
        const rewrittenArgs = args.map(a => {
          try {
            if (typeof a === 'string' && isLikelyUrl(a)) {
              return helpers.proxyWrap(a);
            }
            return a;
          } catch (e) {
            return a;
          }
        });
        return Reflect.apply(target, thisArg, rewrittenArgs);
      }
    };
    try {
      return new Proxy(original, handler);
    } catch (e) {
      return original;
    }
  }

  if (typeof win.fetch === 'function') {
    try {
      const originalFetch = win.fetch.bind(win);
      win.fetch = wrapFunction(originalFetch);
    } catch (e) {
      console.warn('[Andromeda] failed to wrap fetch', e);
    }
  }

  try {
    const OriginalXHR = win.XMLHttpRequest;
    function PatchedXHR(this: any) {
      const xhr = new OriginalXHR();

      const originalOpen = xhr.open;
      xhr.open = function(method: string, url: string, ...rest: any[]) {
        try {
          if (typeof url === 'string' && isLikelyUrl(url)) {
            url = helpers.proxyWrap(url);
          }
        } catch (e) { }
        return originalOpen.call(this, method, url, ...rest);
      };

      const originalSetRequestHeader = xhr.setRequestHeader;
      xhr.setRequestHeader = function(k: string, v: string) {
        return originalSetRequestHeader.call(this, k, v);
      };

      return xhr;
    }
    PatchedXHR.prototype = OriginalXHR.prototype;
    win.XMLHttpRequest = PatchedXHR as any;
  } catch (e) {
    console.warn('[Andromeda] failed to patch XMLHttpRequest', e);
  }

  try {
    const realLocation = win.location;
    Object.defineProperty(win, 'location', {
      configurable: true,
      enumerable: true,
      get() {
        const proxied = Object.assign({}, realLocation);
        if (typeof helpers.proxyWrap === 'function') {
          try {
            proxied.href = helpers.proxyWrap(proxied.href);
          } catch (e) {}
        }
        return proxied;
      },
      set(val) {
        if (typeof helpers.proxyWrap === 'function') {
          try {
            const proxiedVal = helpers.proxyWrap(val);
            realLocation.href = proxiedVal;
          } catch (e) {
            realLocation.href = val;
          }
        } else {
          realLocation.href = val;
        }
      }
    });
  } catch (e) {
    console.warn('[Andromeda] failed to patch location', e);
  }

  try {
    const origQuery = win.Document && win.Document.prototype && win.Document.prototype.querySelector;
    if (origQuery) {
      Document.prototype.querySelector = new Proxy(origQuery, {
        apply(target, thisArg, args) {
          return Reflect.apply(target, thisArg, args);
        }
      }) as any;
    }
  } catch (e) { }

  function isLikelyUrl(value: string) {
    return /^https?:\/\//i.test(value) || /^\/\//.test(value);
  }
}
