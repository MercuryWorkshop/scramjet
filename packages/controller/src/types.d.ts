import type { RawHeaders } from "@mercuryworkshop/proxy-transports";

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
	initialHeaders: RawHeaders;
	rawClientUrl?: string;
};

export type TransferResponse = {
	body: BodyType;
	headers: RawHeaders;
	status: number;
	statusText: string;
};

export type Controllerbound = {
	ready: [];
	request: [TransferRequest, TransferResponse];
	sendSetCookie: [
		{
			url: string;
			cookie: string;
		},
	];
	initRemoteTransport: [MessagePort];
};

export type SWbound = {
	sendSetCookie: [
		{
			url: string;
			cookie: string;
		},
	];
};

export type TransportToController = {
	request: [
		{
			remote: string;
			method: string;
			body: BodyInit | null;
			headers: RawHeaders;
			// signal: AbortSignal | undefined
		},
		TransferrableResponse,
	];
	connect: [
		{
			url: string;
			protocols: string[];
			requestHeaders: RawHeaders;
			port: MessagePort;
		},
		(
			| {
					result: "success";
					protocol: string;
					extensions: string;
			  }
			| {
					result: "failure";
					error: string;
			  }
		),
	];
};

export type ControllerToTransport = {
	ready: [];
};
export type WebSocketData = string | ArrayBuffer | Blob;
export type WebSocketMessage =
	| {
			type: "data";
			data: WebSocketData;
	  }
	| {
			type: "close";
			code: number;
			reason: string;
	  };
