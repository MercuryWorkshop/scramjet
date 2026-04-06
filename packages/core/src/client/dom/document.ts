import { rewriteHtml } from "@rewriters/html";
import { ScramjetClient } from "@client/index";
import { createReferrerString } from "@/fetch/headers";

export default function (client: ScramjetClient, _self: Self) {
	const tostring = String;
	client.Proxy(
		["Document.prototype.querySelector", "Document.prototype.querySelectorAll"],
		{
			apply(ctx) {
				ctx.args[0] = tostring(ctx.args[0]).replace(
					/((?:^|\s)\b\w+\[(?:src|href|data-href))[\^]?(=['"]?(?:https?[:])?\/\/)/,
					"$1*$2"
				);
			},
		}
	);

	client.Proxy("Document.prototype.write", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(ctx.args[0], client.context, client.meta, {
						loadScripts: false,
						inline: true,
						source: client.url.href,
						apisource: "Document.prototype.write",
					});
				} catch {}
		},
	});

	client.Trap("Document.prototype.referrer", {
		get() {
			if (!client.history) return "";
			if (client.history.length < 2) return "";
			let lastState = client.history[client.history.length - 2];
			let referrerURL = new URL(lastState.url);
			return createReferrerString(
				referrerURL,
				client.url,
				lastState.refererPolicy
			);
		},
	});

	client.Proxy("Document.prototype.writeln", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(ctx.args[0], client.context, client.meta, {
						loadScripts: false,
						inline: true,
						source: client.url.href,
						apisource: "Document.prototype.writeln",
					});
				} catch {}
		},
	});

	client.Proxy("Document.prototype.parseHTMLUnsafe", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(ctx.args[0], client.context, client.meta, {
						loadScripts: false,
						inline: true,
						source: client.url.href,
						apisource: "Document.prototype.parseHTMLUnsafe",
					});
				} catch {}
		},
	});
}
