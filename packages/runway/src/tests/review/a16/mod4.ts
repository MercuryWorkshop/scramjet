import { site, page } from "./lib.ts";

const counter = (name: string) =>
	`window.__c = window.__c || {}; window.__c[${JSON.stringify(name)}] = (window.__c[${JSON.stringify(name)}] || 0) + 1; export class K {}; export const url = import.meta.url.replace(/localhost:\\d+/, "HOST");`;

// the same module reached through a prefix-mapped specifier and a relative import
const files = {
	"/lib/a.js": counter("a"),
	"/lib/b.js":
		"import { K as KA } from './a.js'; export { KA as KfromB }; " +
		counter("b"),
	"/lib/sub/c.js":
		"import { K as KA } from '../a.js'; export { KA as KfromC };",
};

const list = [
	site("rv16-prefix-map-identity-static", {
		...files,
		"/": `<!doctype html><html><head><script type="importmap">{"imports":{"lib/":"/lib/"}}</script></head><body>
<script type="module">
import { K, url } from "lib/a.js";
import { KfromB } from "lib/b.js";
import { KfromC } from "lib/sub/c.js";
runTest(async () => {
  assertConsistent("same.b", K === KfromB);
  assertConsistent("same.c", K === KfromC);
  assertConsistent("counts", JSON.stringify(window.__c));
  assertConsistent("url", url);
}, true);
</script></body></html>`,
	}),
	// script-inserted map: static import from a later module script, plus import()
	site("rv16-prefix-map-identity-mixed", {
		...files,
		"/": page(`
{ const s = document.createElement("script"); s.type = "importmap"; s.textContent = '{"imports":{"lib/":"/lib/","a":"/lib/a.js"}}'; document.head.appendChild(s); }
const s = document.createElement("script"); s.type = "module"; s.textContent = 'import { K } from "lib/a.js"; import { K as K2 } from "a"; window.__K = K; window.__K2 = K2;'; document.body.append(s);
for (let i = 0; i < 40 && !window.__K; i++) await tick(25);
const dyn = await import("lib/a.js");
const b = await import("lib/b.js");
const bare = await import("a");
c("static-vs-dyn", window.__K === dyn.K);
c("static-vs-exact", window.__K === window.__K2);
c("dyn-vs-rel", dyn.K === b.KfromB);
c("bare-vs-prefix", bare.K === dyn.K);
c("counts", JSON.stringify(window.__c));
`),
	}),
];

// real three.js addons through unpkg, with the import map every three.js example uses
const three = site("rv16-three-addons-identity", {
	"/": `<!doctype html><html><head><script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
runTest(async () => {
  const fake = { getPixelRatio() { return 1; }, getSize(v) { return v.set(4, 4); } };
  const composer = new EffectComposer(fake);
  assertConsistent("copyPass instanceof ShaderPass", composer.copyPass instanceof ShaderPass);
  assertConsistent("orbit", typeof OrbitControls);
  assertConsistent("rev", THREE.REVISION);
}, true);
</script></body></html>`,
});

export default [...list, three];
