export type RawHeaders = [string, string][];

export type WebSocketDataType = Blob | ArrayBuffer | string;
export type FetchBodyType = ReadableStream | ArrayBuffer | Blob | string;

export type TransferrableResponse = {
	body: FetchBodyType;
	headers: RawHeaders;
	status: number;
	statusText: string;
};

export interface ProxyTransport {
	init: () => Promise<void>;
	ready: boolean;
	connect: (
		url: URL,
		protocols: string[],
		requestHeaders: RawHeaders,
		onopen: (protocol: string, extensions: string) => void,
		onmessage: (data: WebSocketDataType) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void
	) => [
		(data: WebSocketDataType) => void,
		(code: number, reason: string) => void,
	];

	request: (
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: RawHeaders,
		signal: AbortSignal | undefined
	) => Promise<TransferrableResponse>;
}
