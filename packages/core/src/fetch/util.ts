import { isHtmlMimeType, ScramjetHeaders } from "@/shared";
import { BareResponse } from "@mercuryworkshop/proxy-transports";
import { ScramjetFetchRequest } from ".";

export function normalizeContentType(
	request: ScramjetFetchRequest,
	headers: ScramjetHeaders
) {
	if (!isDocument(request)) return;

	const ct = headers.get("content-type");
	if (!ct) return;
	if (!isHtmlMimeType(ct)) return;

	headers.set("content-type", "text/html; charset=utf-8");
}

export function isRedirect(response: BareResponse) {
	return response.status >= 300 && response.status < 400;
}

export function isDocument(request: ScramjetFetchRequest) {
	return request.destination === "document" || request.destination === "iframe";
}
