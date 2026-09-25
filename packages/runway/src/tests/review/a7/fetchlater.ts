import { serverTest } from "../../../testcommon.ts";

let log: string[] = [];
export default [
	serverTest({
		name: "rv7-fetchlater",
		start: async (server) => {
			server.on("request", (req, res) => {
				if (req.url === "/") {
					log = [];
					res.writeHead(200, {
						"Content-Type": "text/html",
					});
					res.end(`<!doctype html><script>
runTest(async () => {
	if (!self.fetchLater) { fail('no fetchLater'); return; }
	let r;
	try { r = fetchLater('/fl-rel?x=1', { method: 'POST', body: 'abc', activateAfter: 0 }); } catch (e) { fail('THROW ' + e.name + ': ' + e.message); return; }
	try { fetchLater(location.origin + '/fl-abs', { activateAfter: 0 }); } catch (e) {}
	await new Promise(r => setTimeout(r, 2500));
	const l = await (await fetch('/__log')).json();
	console.log('RV7FL ' + JSON.stringify([typeof $scramjet, l]));
	assert(l.includes('/fl-rel?x=1') && l.includes('/fl-abs'), 'fetchLater reached origin: ' + JSON.stringify(l));
	pass();
}, false);
</script>`);
					return;
				}
				if (req.url === "/__log") {
					res.writeHead(200, {
						"Content-Type": "application/json",
					});
					res.end(JSON.stringify(log));
					return;
				}
				log.push(req.url!);
				res.writeHead(200);
				res.end("ok");
			});
		},
	}),
];
