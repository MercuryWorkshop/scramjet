import { rewriteCss } from "@rewriters/css";
import { ScramjetClient } from "@client/index";
import { Constructor, idlDOMString, idlIsBufferSource } from "@client/webidl";

export default function (client: ScramjetClient, _self: Self) {
	client.Intercept(class extends FontFace {
		// https://drafts.csswg.org/css-font-loading/#fontface-interface
		@Constructor(
			"CSSOMString",
			"(CSSOMString or BinaryData)",
			"optional FontFaceDescriptors"
		)
		static konstructor(
			family: string,
			source: string | BufferSource,
			descriptors?: FontFaceDescriptors
		) {
			return new this(
				family,
				idlIsBufferSource(source)
					? (source as BufferSource)
					: rewriteCss(idlDOMString(source), client.context, client.meta),
				descriptors
			);
		}
	});
}
