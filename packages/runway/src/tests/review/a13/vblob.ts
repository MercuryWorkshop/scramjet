import { htmlTest } from "../../../testcommon.ts";
// A parsed <video>/<audio>/<source> with a blob: src in the served HTML.
const vals = [
	"blob:",
	"blob:http://localhost/abc",
	"blob:https://example.com/8c0f0d6e-1b9c-4a57-9b8e-2f7a2b7e0c11",
	"blob:null/abc",
];
export default vals.flatMap((v, i) =>
	["video", "source"].map((tag) =>
		htmlTest({
			name: `rv13-vblob-${tag}-${i}`,
			html: `<!DOCTYPE html><html><body>${tag === "source" ? `<video><source src="${v}"></video>` : `<video src="${v}"></video>`}<p id=p>after</p>
<script>runTest(async () => { assertConsistent("attr", document.querySelector("${tag}").getAttribute("src")); assertConsistent("after", document.getElementById("p") && document.getElementById("p").textContent); }, true);</script></body></html>`,
		})
	)
);
