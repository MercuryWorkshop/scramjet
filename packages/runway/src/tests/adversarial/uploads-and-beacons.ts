import { serverTest } from "../../testcommon.ts";

// Two request paths that only fail loudly in production: file uploads, where
// the multipart body has to reach the origin byte for byte, and beacons, which
// are fire-and-forget so a page never notices when they vanish. The beacon tests
// are resolved by the server, so they only pass if the request really arrived.
//
// Nothing here diverges - this is regression cover for an area with no tests.

const uploadTest = (
	name: string,
	js: string,
	opts: {
		autoPass?: boolean;
		onRequest?: (req: any, body: string, ctx: any) => void;
	} = {}
) =>
	serverTest({
		name,
		autoPass: opts.autoPass ?? true,
		js,
		start: async (server, _port, ctx) => {
			server.on("request", (req, res) => {
				if (res.headersSent) return;
				const path = (req.url || "/").split("?")[0];
				if (path === "/" || path === "/script.js") return;
				const chunks: Buffer[] = [];
				req.on("data", (c) => chunks.push(c));
				req.on("end", () => {
					const body = Buffer.concat(chunks).toString("utf8");
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							path,
							method: req.method,
							ct: req.headers["content-type"] ?? null,
							body,
						})
					);
					if (opts.onRequest) opts.onRequest(req, body, ctx);
				});
			});
		},
	});

export default [
	uploadTest(
		"uploads-formdata-with-file",
		`
			const fd = new FormData();
			fd.append("doc", new File(["filecontent"], "up.txt", { type: "text/plain" }));
			fd.append("field", "value");
			const j = await (await fetch("/upload", { method: "POST", body: fd })).json();
			assertEqual(j.method, "POST", "method");
			assert(String(j.ct).startsWith("multipart/form-data; boundary="), "content-type: " + j.ct);
			assert(j.body.includes('name="doc"'), "the file field is present");
			assert(j.body.includes('filename="up.txt"'), "the filename survived");
			assert(j.body.includes("filecontent"), "the file content survived");
			assert(j.body.includes('name="field"'), "the text field survived alongside it");
		`
	),
	uploadTest(
		"uploads-input-files-and-form",
		`
			// how a real upload flow is wired, and how tests drive it
			const input = document.createElement("input");
			input.type = "file";
			input.name = "doc";
			const dt = new DataTransfer();
			dt.items.add(new File(["viainput"], "in.txt", { type: "text/plain" }));
			input.files = dt.files;
			assertEqual(input.files.length, 1, "the FileList was assigned");
			assertEqual(input.files[0].name, "in.txt", "file name");
			assertEqual(await input.files[0].text(), "viainput", "the file is readable from script");
			const form = document.createElement("form");
			form.appendChild(input);
			document.body.appendChild(form);
			assertEqual(new FormData(form).get("doc").name, "in.txt", "FormData picks the file up from the form");
			const j = await (await fetch("/upload", { method: "POST", body: new FormData(form) })).json();
			assert(j.body.includes('filename="in.txt"'), "the upload reached the origin");
			assert(j.body.includes("viainput"), "with its content");
		`
	),
	uploadTest(
		"uploads-binary-body",
		`
			const j = await (await fetch("/upload", {
				method: "POST",
				headers: { "Content-Type": "application/octet-stream" },
				body: new Uint8Array([1, 2, 3, 4, 5]),
			})).json();
			assertEqual(j.ct, "application/octet-stream", "content-type");
			assertEqual(j.body.length, 5, "the binary body arrived at full length");
			const big = new Uint8Array(64 * 1024).fill(65);
			const j2 = await (await fetch("/upload", { method: "POST", body: big })).json();
			assertEqual(j2.body.length, 64 * 1024, "a 64KiB body arrived intact");
		`
	),
	uploadTest(
		"beacons-sendbeacon-string",
		`
			assertEqual(navigator.sendBeacon("/beacon", "beaconpayload"), true, "sendBeacon returned true");
		`,
		{
			autoPass: false,
			onRequest: (req, body, { pass, fail }) => {
				if ((req.url || "").split("?")[0] !== "/beacon") return;
				if (req.method !== "POST")
					return void fail("the beacon method was " + req.method);
				if (body === "beaconpayload") pass("the beacon arrived at the origin");
				else fail("the beacon body was " + JSON.stringify(body));
			},
		}
	),
	uploadTest(
		"beacons-sendbeacon-blob",
		`
			assertEqual(navigator.sendBeacon("/beaconblob", new Blob(["blobbeacon"], { type: "text/plain" })), true,
				"sendBeacon with a Blob returned true");
		`,
		{
			autoPass: false,
			onRequest: (req, body, { pass, fail }) => {
				if ((req.url || "").split("?")[0] !== "/beaconblob") return;
				if (body === "blobbeacon") pass("the blob beacon arrived");
				else fail("the blob beacon body was " + JSON.stringify(body));
			},
		}
	),
	uploadTest(
		"beacons-keepalive-fetch",
		`
			await fetch("/keepalive", { method: "POST", body: "kapayload", keepalive: true });
		`,
		{
			autoPass: false,
			onRequest: (req, body, { pass, fail }) => {
				if ((req.url || "").split("?")[0] !== "/keepalive") return;
				if (body === "kapayload") pass("the keepalive fetch arrived");
				else fail("the keepalive body was " + JSON.stringify(body));
			},
		}
	),
];
