import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BARE_PORT = 4502;

export async function startBareHarness() {
	const app = express();

	const proxyToPort = (
		port: string,
		targetPath: string,
		req: any,
		res: any
	) => {
		const options = {
			hostname: "localhost",
			port: parseInt(port),
			path: targetPath,
			method: req.method,
			headers: {
				...req.headers,
				host: `localhost:${port}`,
			},
		};

		const proxyReq = http.request(options, (proxyRes) => {
			res.statusCode = proxyRes.statusCode!;
			for (const [key, value] of Object.entries(proxyRes.headers)) {
				if (value !== undefined) {
					res.setHeader(key, value);
				}
			}
			proxyRes.pipe(res);
		});

		proxyReq.on("error", (err) => {
			console.error(`[Bare Proxy] Error for ${targetPath}:`, err);
			if (!res.headersSent) {
				res.statusCode = 502;
				res.end(`Proxy error: ${err.message}`);
			}
		});

		req.pipe(proxyReq);
	};

	// Proxy test content to avoid CORS issues
	// All test resources will be served through /test/:port/*
	app.use("/test/:port", (req, res) => {
		const port = req.params.port;
		const targetPath = req.url;
		proxyToPort(port, targetPath, req, res);
	});

	// Also proxy relative asset requests (like /common.js) based on Referer
	app.use((req, res, next) => {
		const referer = req.headers.referer;
		if (typeof referer === "string") {
			const match = referer.match(/\/test\/(\d+)\//);
			if (match) {
				const port = match[1];
				proxyToPort(port, req.url, req, res);
				return;
			}
		}
		next();
	});

	app.use(express.static(path.join(__dirname, "public")));

	app.listen(BARE_PORT, () => {
		console.log(`    Bare harness server listening on port ${BARE_PORT}`);
	});
}
