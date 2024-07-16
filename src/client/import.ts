import { encodeUrl } from "../shared/rewriters/url"

window.$sImport = function(url) {
  return (function() { }.constructor(`return import("${encodeUrl(url)}")`))();
}
