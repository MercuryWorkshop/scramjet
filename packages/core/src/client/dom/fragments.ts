import { rewriteHtml } from "@rewriters/html";
import { ScramjetClient } from "@client/index";
import { ForeignContext } from "@/shared/rewriters/html";

// TODO: this function is untested / llm slop
function foreignContextForRange(
	client: ScramjetClient,
	range: Range
): ForeignContext {
	const node = range.startContainer;
	const element = node.nodeType === 1 ? node : node.parentElement;
	if (!element) return "html";
	if (client.box.instanceof(element, "SVGElement")) return "svg";
	if (client.box.instanceof(element, "MathMLElement")) return "math";
	return "html";
}

export default function (client: ScramjetClient, _self: Self) {
	client.Proxy("Range.prototype.createContextualFragment", {
		apply(ctx) {
			ctx.args[0] = rewriteHtml(ctx.args[0], client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "Range.prototype.createContextualFragment",
				foreignContext: foreignContextForRange(client, ctx.this),
			});
		},
	});
}
