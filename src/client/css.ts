import { rewriteCss } from "./shared";

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

CSSStyleDeclaration.prototype.setProperty = new Proxy(
	CSSStyleDeclaration.prototype.setProperty,
	{
		apply(target, thisArg, argArray) {
			if (cssProperties.includes(argArray[0]))
				argArray[1] = rewriteCss(argArray[1]);

			return Reflect.apply(target, thisArg, argArray);
		},
	}
);
