import { bootstrap } from "@mercuryworkshop/proxy-bootstrap";
import express from "express";

const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.static("public"));

const { routeRequest, routeUpgrade } = await bootstrap();

const server = app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

server.on("request", routeRequest);
server.on("upgrade", routeUpgrade);
