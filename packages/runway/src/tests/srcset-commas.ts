import { serverTest, basicTest } from "../testcommon.ts";

// srcset candidates whose URLs contain commas, as CDN image URLs do
// (amazon: `…_AC_AIweblab1374086,T2_SF217.5,435_QL80_.jpg 1.5x, … 2x`)
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

export default [
	serverTest({
		// one server serves both harnesses; this checks what scramjet requests
		scramjetOnly: true,
		name: "srcset-commas-in-urls-loads-the-candidate",
		start: async (server, _port, { pass, fail }) => {
			server.on("request", (req, res) => {
				const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
				if (path === "/") {
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						`<!doctype html><img sizes="3000px" srcset="/i/a,T2_SF217.5,435_QL80_.png 100w, /i/a,T2_SF290,580_QL80_.png 4000w">`
					);
				} else if (path !== "/favicon.ico") {
					res.writeHead(200, { "Content-Type": "image/png" });
					res.end(PNG);
					if (path === "/i/a,T2_SF290,580_QL80_.png")
						pass("the 4000w candidate, whole");
					else fail("requested " + path);
				}
			});
		},
	}),
	basicTest({
		name: "srcset-commas-in-urls-readback",
		js: `
			const img = document.createElement("img");
			img.srcset = "/i/a,b,c.png 1x, /i/d,e.png 2x";
			assertConsistent("srcset", img.srcset);
			assertConsistent("attr", img.getAttribute("srcset"));
		`,
	}),
];
