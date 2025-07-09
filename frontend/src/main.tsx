import "./style.css";

import { createBrowser } from "./browser";
import { createMenu } from "./Menu";
let app = document.getElementById("app")!;

let browser = createBrowser();
(self as any).browser = browser;

try {
	let built = browser.build();
	built.id = "app";
	built.addEventListener("contextmenu", (e) => {
		createMenu(e.x, e.y, [
			{
				label: "Reload",
			},
		]);
		e.preventDefault();
	});

	app.replaceWith(built);
} catch (e) {
	let err = e as any;
	app.replaceWith(
		document.createTextNode(
			`Error mounting: ${"message" in err ? err.message : err}`
		)
	);
}
