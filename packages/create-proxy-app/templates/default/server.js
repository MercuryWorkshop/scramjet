import { bootstrap } from "@mercuryworkshop/proxy-bootstrap";
import http from "node:http";
import express from "express";

const { routeRequest, routeUpgrade } = await bootstrap();

const app = express();
app.use((req, res, next) => {
	if (routeRequest(req, res)) return;
	next();
});
app.use(express.static("public"));

const server = http.createServer(app);

server.on("upgrade", routeUpgrade);

server.listen(3030, () => {
	console.log("Server is running on port 3030");
});
