import { decodeUrl, encodeUrl } from "../shared/rewriters/url"

window.$sImport = function(base) {
  return function(url) {
    let resolved = new URL(url, base).href
    console.log(resolved)
    return (function() { }.constructor(`return import("${encodeUrl(resolved)}")`))();
  }
}
