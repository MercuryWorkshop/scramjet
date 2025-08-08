export function startCDP(message: (message: string) => void): CDPServer {
	const server = new CDPServer(message);

	return server;
}

export class ErrorWithCode extends Error {
	code: number;
	constructor(code: number, message: string) {
		super(message);
		this.code = code;

		Object.setPrototypeOf(this, new.target.prototype);
	}
}

let server: CDPServer;
class CDPServer {
	id = 0;
	constructor(public sendMessage: (message: string) => void) {
		console.log("starting cdp server");
		server = this;
	}

	async message(message: string) {
		const msg = JSON.parse(message);
		const resultMsg: any = {
			id: msg.id,
		};

		try {
			resultMsg.result = await this.callMethod(msg.method, msg.params);
		} catch (e) {
			console.error("CDP error", e);
			if (e instanceof ErrorWithCode) {
				resultMsg.error = {
					message: e.message,
					code: e.code,
				};
			} else if (e instanceof Error) {
				resultMsg.error = {
					message: e.message,
				};
			}
		}
		console.log(resultMsg);

		this.sendMessage(JSON.stringify(resultMsg));
	}

	emit<T>(method: string, params: T) {
		const msg = JSON.stringify({
			method,
			params,
		});
		this.sendMessage(msg);
	}

	async callMethod(method: string, params: any) {
		const [domainName, methodName] = method.split(".");
		const domain: any = (Scopes as any)[domainName];
		if (domain) {
			if (domain[methodName]) {
				return domain[methodName](params) || {};
			}
		}

		throw Error(`${method} unimplemented`);
	}
}

import type Protocol from "devtools-protocol";
import { browser } from "./main";
const Scopes = {
	Browser: {
		getVersion(): Protocol.Browser.GetVersionResponse {
			return {
				protocolVersion: "0.0.0",
				product: "scramjet",
				revision: "0",
				userAgent: navigator.userAgent,
				jsVersion: "0.0.0",
			};
		},
		setDownloadBehavior(params: Protocol.Browser.SetDownloadBehaviorRequest) {
			console.log(params);
		},
	},

	Runtime: {
		runIfWaitingForDebugger() {
			console.log("?");
		},
	},

	Target: {
		async createTarget(
			params: Protocol.Target.CreateTargetRequest
		): Promise<Protocol.Target.CreateTargetResponse> {
			console.log("creating new target");
			const tab = browser.newTab(new URL("https://example.com"));

			server.emit<Protocol.Target.AttachedToTargetEvent>(
				"Target.attachedToTarget",
				{
					sessionId: "0",
					waitingForDebugger: false,
					targetInfo: {
						browserContextId: "0",
						targetId: String(tab.id),
						type: "page",
						title: "test",
						url: "https://google.com",
						attached: false,
						canAccessOpener: false,
					},
				}
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			return {
				targetId: String(tab.id),
			};
		},

		setAutoAttach(params: Protocol.Target.SetAutoAttachRequest) {
			console.log("Target.setAutoAttach", params);
		},
		getTargetInfo(
			params: Protocol.Target.GetTargetInfoRequest
		): Protocol.Target.GetTargetInfoResponse {
			return {
				targetInfo: {
					targetId: "0",
					/**
					 * List of types: https://source.chromium.org/chromium/chromium/src/+/main:content/browser/devtools/devtools_agent_host_impl.cc?ss=chromium&q=f:devtools%20-f:out%20%22::kTypeTab%5B%5D%22
					 */
					type: "tab",
					title: "test",
					url: "https://google.com",
					/**
					 * Whether the target has an attached client.
					 */
					attached: false,
					/**
					 * Opener target Id
					 */
					// openerId?: TargetID;
					/**
					 * Whether the target has access to the originating window.
					 */
					canAccessOpener: false,
					/**
					 * Frame id of originating window (is only set if target has an opener).
					 */
					// openerFrameId?: Page.FrameId;
					// browserContextId?: Browser.BrowserContextID;
					/**
					 * Provides additional details for specific target types. For example, for
					 * the type of "page", this may be set to "prerender".
					 */
					// subtype?: string;
				},
			};
		},
	},
};
