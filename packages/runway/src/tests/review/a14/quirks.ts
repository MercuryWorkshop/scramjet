import { serverTest } from "../../../testcommon.ts";

// Does the proxied document keep standards mode for common doctype'd shapes?
const SHAPES: Record<string, string> = {
	body: `<!DOCTYPE html><body>`,
	html: `<!DOCTYPE html><html><body>`,
	head: `<!DOCTYPE html><html><head></head><body>`,
	meta: `<!doctype html>\n<meta charset="utf-8"><title>t</title><body>`,
	title: `<!DOCTYPE html><title>t</title>`,
	comment: `<!-- c --><!DOCTYPE html><body>`,
	bom: `﻿<!DOCTYPE html><body>`,
	ws: `\n\n  <!DOCTYPE html><body>`,
	wsHtml: `\n\n  <!DOCTYPE html><html><head></head><body>`,
	commentHtml: `<!-- c --><!DOCTYPE html><html><head></head><body>`,
	bomHtml: `\ufeff<!DOCTYPE html><html><head></head><body>`,
	headless: `<!DOCTYPE html><html><body>`,
	legacyDoctype: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html><head></head><body>`,
	legacyNoHtml: `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><title>t</title>`,
};
export default Object.entries(SHAPES).map(([k, pre]) =>
	serverTest({
		name: "rv14-quirks-" + k,
		async start(server) {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					res.writeHead(200, {
						"content-type": "text/html; charset=utf-8",
					});
					res.end(
						pre +
							`<div>x</div><script>runTest(async () => { assertConsistent("compatMode", document.compatMode); }, true);</script>`
					);
				} else {
					res.writeHead(404);
					res.end();
				}
			});
		},
	})
);
