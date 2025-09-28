import type {
	BareHeaders,
	TransferrableResponse,
	BareTransport,
} from "./bare-mux-custom";
import initEpoxy, {
	EpoxyClient,
	EpoxyClientOptions,
	EpoxyHandlers,
	info as epoxyInfo,
} from "@mercuryworkshop/epoxy-tls";

export { epoxyInfo };

export type EpoxyOptions = {
	wisp_v2?: boolean;
	udp_extension_required?: boolean;

	title_case_headers?: boolean;
	ws_title_case_headers?: boolean;

	wisp_ws_protocols?: string[];

	redirect_limit?: number;
	header_limit?: number;
	buffer_size?: number;
};
const opts = [
	"wisp_v2",
	"udp_extension_required",
	"title_case_headers",
	"ws_title_case_headers",
	"wisp_ws_protocols",
	"redirect_limit",
	"header_limit",
	"buffer_size",
];

export default class EpoxyTransport implements BareTransport {
	ready = false;

	client_version: typeof epoxyInfo;
	client: EpoxyClient = null!;
	wisp: string;
	opts: EpoxyOptions;

	constructor(opts: EpoxyOptions & { wisp: string }) {
		this.wisp = opts.wisp;
		this.opts = opts;

		this.client_version = epoxyInfo;
	}

	setopt(opts: EpoxyClientOptions, opt: string) {
		// == allows both null and undefined
		if (this.opts[opt] != null) opts[opt] = this.opts[opt];
	}

	async init() {
		await initEpoxy();

		let options = new EpoxyClientOptions();
		options.user_agent = navigator.userAgent;
		opts.forEach((x) => this.setopt(options, x));
		this.client = new EpoxyClient(this.wisp, options);

		this.ready = true;
	}

	async meta() {}

	async request(
		remote: URL,
		method: string,
		body: BodyInit | null,
		headers: BareHeaders,
		signal: AbortSignal | undefined
	): Promise<TransferrableResponse> {
		if (body instanceof Blob) body = await body.arrayBuffer();

		try {
			let res = await this.client.fetch(remote.href, {
				method,
				body,
				headers,
				redirect: "manual",
			});
			return {
				body: res.body!,
				headers: (res as any).rawHeaders,
				status: res.status,
				statusText: res.statusText,
			};
		} catch (err) {
			console.error(err);
			throw err;
		}
	}

	connect(
		url: URL,
		protocols: string[],
		requestHeaders: BareHeaders,
		onopen: (protocol: string) => void,
		onmessage: (data: Blob | ArrayBuffer | string) => void,
		onclose: (code: number, reason: string) => void,
		onerror: (error: string) => void
	): [
		(data: Blob | ArrayBuffer | string) => void,
		(code: number, reason: string) => void,
	] {
		let handlers = new EpoxyHandlers(
			onopen,
			onclose,
			onerror,
			(data: Uint8Array | string) =>
				//@ts-ignore
				data instanceof Uint8Array ? onmessage(data.buffer) : onmessage(data)
		);

		let ws = this.client.connect_websocket(
			handlers,
			url.href,
			protocols,
			Object.assign(requestHeaders)
		);

		return [
			async (data) => {
				if (data instanceof Blob) data = await data.arrayBuffer();
				(await ws).send(data);
			},
			async (code, reason) => {
				(await ws).close(code, reason || "");
			},
		];
	}
}
