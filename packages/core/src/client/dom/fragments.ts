import { rewriteHtml } from "@rewriters/html";
import { ScramjetClient } from "@client/index";
import { ForeignContext } from "@/shared/rewriters/html";
import { String } from "@/shared/snapshot";
import { Arguments, Returns } from "@client/webidl";

function foreignContextForRange(
	client: ScramjetClient,
	range: Range
): ForeignContext {
	const nRange = new client.native.Range(range);
	const node = nRange.startContainer;
	const nNode = new client.native.Node(node);
	const element = nNode.nodeType === 1 ? node : nNode.parentElement;
	if (!element) return "html";
	if (client.box.instanceof(element, "SVGElement")) return "svg";
	if (client.box.instanceof(element, "MathMLElement")) return "math";
	return "html";
}

export default function (client: ScramjetClient, _self: Self) {
	client.Intercept(class extends Range {
		@Returns("DocumentFragment")
		@Arguments("(TrustedHTML or DOMString)")
		createContextualFragment(string: string | TrustedHTML): DocumentFragment {
			const html = String(string);
			const rewritten = rewriteHtml(html, client.context, client.meta, {
				loadScripts: false,
				inline: true,
				source: client.url.href,
				apisource: "Range.prototype.createContextualFragment",
				foreignContext: foreignContextForRange(client, this),
			});

			return super.createContextualFragment(rewritten);
		}
	});
}
