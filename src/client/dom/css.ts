import { ScramjetClient } from "../client";
import { rewriteCss } from "../shared";

const cssProperties = [
	"background",
	"background-image",
	"mask",
	"mask-image",
	"list-style",
	"list-style-image",
	"border-image",
	"border-image-source",
	"cursor",
];
// const jsProperties = ["background", "backgroundImage", "mask", "maskImage", "listStyle", "listStyleImage", "borderImage", "borderImageSource", "cursor"];

export default function (client: ScramjetClient) {
	client.Proxy("CSSStyleDeclaration.prototype.setProperty", {
		apply(ctx) {
			if (cssProperties.includes(ctx.args[0]))
				ctx.args[1] = rewriteCss(ctx.args[1]);
		},
	});
}
