import { site } from "./lib.ts";

export default [
	site("rv16-babel-standalone-module", {
		"/dep.js": "export const x = 'dep';",
		"/": `<!doctype html><html><head>
<script type="importmap">{"imports":{"react":"https://esm.sh/react@18.3.1","react-dom/client":"https://esm.sh/react-dom@18.3.1/client"}}</script>
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
</head><body><div id="root"></div>
<script type="text/babel" data-type="module" data-presets="react">
import { x } from "./dep.js";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
function App() { const [n, setN] = useState(1); useEffect(() => { setN(2); }, []); return <p id="p">{x}:{n}</p>; }
createRoot(document.getElementById("root")).render(<App />);
window.__jsx = x;
</script>
<script>
runTest(async () => {
  for (let i = 0; i < 100 && !(document.getElementById("p") && document.getElementById("p").textContent.endsWith(":2")); i++) await new Promise(r => setTimeout(r, 50));
  assertConsistent("jsx", window.__jsx);
  assertConsistent("text", document.getElementById("p") ? document.getElementById("p").textContent : "none");
}, true);
</script></body></html>`,
	}),
];
