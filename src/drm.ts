import { addListener, launch } from "devtools-detector";

function jail() {
	setInterval(() => {
		console.error("SCRAMJET ERROR");

		debugger;
	}, 0);
}

addListener((open) => open && jail());

if (!["http://localhost:1337"].includes(window.location.origin)) {
	jail();
}

launch();
