import type { BareHeaders } from "../../bare-mux-custom";

export type BodyType =
	| string
	| ArrayBuffer
	| Blob
	| ReadableStream<Uint8Array<ArrayBufferLike>>;

export type TransferRequest = {
	rawUrl: string;
	destination: RequestDestination;
	mode: RequestMode;
	referrer: string;
	method: string;
	body: BodyType | null;
	cache: RequestCache;
	forceCrossOriginIsolated: boolean;
	initialHeaders: BareHeaders;
	rawClientUrl?: string;
};

export type TransferResponse = {
	body: BodyType;
	headers: BareHeaders;
	status: number;
	statusText: string;
};

export type Controllerbound = {
	ready: [];
	request: [TransferRequest, TransferResponse];
};

export type SWbound = {};
