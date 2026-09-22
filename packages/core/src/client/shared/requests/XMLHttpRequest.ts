import {
	Array_join,
	Array_sort,
	String_indexOf,
	String_split,
	String_startsWith,
	String_substring,
	String_toLowerCase,
} from "@/shared/snapshot";
import { carriedHeaderName, uncarriedHeaderName } from "@/shared/headers";
import { ScramjetClient } from "@client/client";
import { Arguments, Returns, Type } from "@client/webidl";

export const enabled = (client: ScramjetClient, self: Self) =>
	"XMLHttpRequest" in self;

export default function (client: ScramjetClient) {
	client.Intercept(class extends XMLHttpRequest {
		@Arguments(
			"ByteString",
			"USVString",
			"optional boolean",
			"optional USVString?",
			"optional USVString?"
		)
		@Returns("undefined")
		open(
			method: string,
			url: string,
			isAsync?: boolean,
			username?: string | null,
			password?: string | null
		): void {
			const rewritten = client.rewriteUrl(url);

			if (arguments.length < 3) return super.open(method, rewritten);

			if (isAsync === false) {
				// not a scramjet limitation: Chromium has removed synchronous XHR
				// outright, so refusing it here is what the page would see from the
				// browser anyway. the xhr spec still allows it from a document
				// https://xhr.spec.whatwg.org/#the-open()-method
				throw client.errors.domException("InvalidAccessError", {
					execute: "open",
					on: "XMLHttpRequest",
					detail: "Synchronous requests are not supported.",
				});
			}

			return super.open(method, rewritten, isAsync, username, password);
		}

		@Type("USVString")
		get responseURL() {
			const url = super.responseURL;

			return String_startsWith(url, client.context.prefix.href)
				? client.unrewriteUrl(url)
				: url;
		}

		@Returns("ByteString?")
		@Arguments("ByteString")
		getResponseHeader(name: string): string | null {
			return super.getResponseHeader(carriedHeaderName(name));
		}

		@Returns("ByteString")
		@Arguments()
		getAllResponseHeaders(): string {
			const raw = super.getAllResponseHeaders();
			if (!raw) return raw;

			const restored: { name: string; line: string }[] = [];
			const lines = String_split(raw, "\r\n");

			for (let i = 0; i < lines.length; i++) {
				const colon = String_indexOf(lines[i], ":");
				if (colon === -1) continue;

				const carried = uncarriedHeaderName(
					String_substring(lines[i], 0, colon)
				);
				if (carried === null) continue;

				const name = String_toLowerCase(carried);
				// the value keeps the separator and its leading space verbatim
				restored[restored.length] = {
					name,
					line: name + String_substring(lines[i], colon),
				};
			}

			// a carrier sorts under `x-`, and the name it stands for almost never
			// does, so the list has to be re-sorted rather than filtered in place.
			// by name, not by line: "sort and combine" orders the names, and `-`
			// sorting before `:` would otherwise put
			// `content-security-policy-report-only` ahead of
			// `content-security-policy`
			// https://fetch.spec.whatwg.org/#concept-header-list-sort-and-combine
			Array_sort(restored, (a, b) =>
				a.name < b.name ? -1 : a.name > b.name ? 1 : 0
			);

			const out: string[] = [];
			for (let i = 0; i < restored.length; i++) out[i] = restored[i].line;

			return out.length ? Array_join(out, "\r\n") + "\r\n" : "";
		}
	});
}
