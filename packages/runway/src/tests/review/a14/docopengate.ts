import { basicTest } from "../../../testcommon.ts";

// document.open() erases every listener on the document *and its window*
// (HTML "document open steps", step 13), including the capturing `message`
// gate postmessage.ts registers at hook time to enforce targetOrigin. A
// document.write'd friendly iframe is exactly a document.open()ed window.
export default [
	basicTest({
		name: "rv14-docopen-gate",
		js: String.raw`
const run = async (kind) => {
  const f = document.createElement("iframe");
  document.body.appendChild(f);
  const w = f.contentWindow;
  if (kind !== "plain") { const d = f.contentDocument; d.open(); d.write("<!DOCTYPE html><body>w</body>"); d.close(); }
  w.__got = [];
  w.addEventListener("message", (e) => w.__got.push(e.data));
  w.postMessage("wrong", "https://elsewhere.example");
  w.postMessage("right", location.origin);
  w.postMessage("star", "*");
  await new Promise((r) => setTimeout(r, 300));
  const got = w.__got.join(",");
  f.remove();
  return got;
};
assertConsistent("plain", await run("plain"));
assertConsistent("written", await run("written"));
`,
	}),
];
