import zlib from "node:zlib";
import { serverTest } from "../../testcommon.ts";

// Answer in the best encoding the client offered, as a server does.
function encode(req: { headers: Record<string, unknown> }, body: string) {
	const offered = String(req.headers["accept-encoding"] ?? "");
	if (/\bzstd\b/.test(offered))
		return { encoding: "zstd", data: zlib.zstdCompressSync(Buffer.from(body)) };
	if (/\bbr\b/.test(offered))
		return { encoding: "br", data: zlib.brotliCompressSync(Buffer.from(body)) };
	if (/\bgzip\b/.test(offered))
		return { encoding: "gzip", data: zlib.gzipSync(Buffer.from(body)) };

	return { encoding: "identity", data: Buffer.from(body) };
}

export default [
	// Whatever a client offers in accept-encoding, a server may answer in -
	// so every encoding offered has to come back readable, on a fetch and on
	// a navigation alike.
	serverTest({
		name: "request-offered-encodings-are-decoded",
		autoPass: true,
		js: `
			assertEqual(await (await fetch("/probe")).text(), "decoded");

			const iframe = document.createElement("iframe");
			iframe.src = "/document";
			await new Promise((resolve) => {
				iframe.onload = resolve;
				document.body.append(iframe);
			});
			assertEqual(iframe.contentDocument.body.textContent.trim(), "decoded");
		`,
		async start(server) {
			server.on("request", (req, res) => {
				const body =
					req.url === "/probe"
						? { type: "text/plain", text: "decoded" }
						: req.url === "/document"
							? {
									type: "text/html",
									text: "<!DOCTYPE html><body>decoded</body>",
								}
							: null;
				if (!body) return;
				const { encoding, data } = encode(req, body.text);
				res.writeHead(200, {
					"Content-Type": body.type,
					"Content-Encoding": encoding,
				});
				res.end(data);
			});
		},
	}),
];
