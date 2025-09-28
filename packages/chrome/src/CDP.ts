import type Protocol from "devtools-protocol";
import { browser } from "./Browser";
import type { Tab } from "./Tab";

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
			sessionId: msg.sessionId,
		};
		console.log(msg);

		try {
			resultMsg.result = await this.callMethod(
				msg.method,
				msg.params,
				msg.sessionId
			);
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

	sessionid = 0;

	sessions = new Map<
		string,
		{
			tab: Tab;
			callbacks: Map<number, (result: any) => void>;
			messageid: number;
		}
	>();
	initSession(tab: Tab): string {
		const sid = String(this.sessionid++);

		const callbacks = new Map<number, (result: any) => void>();
		const session = {
			tab,
			callbacks,
			messageid: 1,
		};
		this.sessions.set(sid, session);
		tab.onChobitsuMessage = (message: string) => {
			let msg = JSON.parse(message);
			if (callbacks.has(msg.id)) {
				const callback = callbacks.get(msg.id)!;
				callback(msg);
				callbacks.delete(session.messageid);

				return;
			}
			console.log("Forwawrding Evvent", msg);
			if (msg.params?.context && !msg.params.context.auxData) {
				msg.params.context.auxData = {
					frameId: String(tab.id),
					isDefault: true,
				};
			}
			this.sendMessage(
				JSON.stringify({
					method: msg.method,
					params: msg.params,
					sessionId: sid,
				})
			);
		};

		return sid;
	}

	async callTabMethod(
		sessionid: string,
		method: string,
		params: object
	): Promise<object> {
		const session = this.sessions.get(sessionid);
		if (!session) {
			throw new ErrorWithCode(-32001, `Session ${sessionid} not found`);
		}
		const msgid = session.messageid++;

		const msg = {
			id: msgid,
			method,
			params,
		};
		if (!session.tab.sendToChobitsu) {
			throw new ErrorWithCode(-32001, `Session ${sessionid} not found`);
		}
		session.tab.sendToChobitsu(JSON.stringify(msg));

		return await new Promise((resolve) => {
			session.callbacks.set(msgid, (result: any) => {
				resolve(result);
			});
		});
	}

	emit<T>(method: string, params: T) {
		const msg = JSON.stringify({
			method,
			params,
		});
		this.sendMessage(msg);
	}

	async callMethod(method: string, params: any, sessionId?: string) {
		const [domainName, methodName] = method.split(".");
		const domain: any = (Scopes as any)[domainName];
		if (domain) {
			if (domain[methodName]) {
				return domain[methodName](params) || {};
			}
		}

		if (sessionId) {
			console.log("Routing " + method + " to session " + sessionId);

			const result: any = await this.callTabMethod(sessionId, method, params);

			if (result.result) {
				return result.result;
			} else if (result.error) {
				throw new Error(result.error.message);
			} else {
				throw new Error("Bad message from subcdp");
			}
		}

		throw Error(`${method} unimplemented`);
	}
}

function createTargetInfo(tab: Tab): Protocol.Target.TargetInfo {
	return {
		browserContextId: "0",
		targetId: String(tab.id),
		type: "page",
		title: tab.title || "New Tab",
		url: tab.url.href,
		attached: true,
		canAccessOpener: false,
	};
}

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
			const tab = browser.newTab(new URL("https://google.com/"));
			const sessionid = server.initSession(tab);

			await tab.waitForChobitsuInit;
			server.emit<Protocol.Target.AttachedToTargetEvent>(
				"Target.attachedToTarget",
				{
					sessionId: sessionid,
					waitingForDebugger: false,
					targetInfo: createTargetInfo(tab),
				}
			);

			return {
				targetId: String(tab.id),
			};
		},

		async closeTarget(params: Protocol.Target.CloseTargetRequest) {
			let tab = browser.tabs.find((x) => x.id === Number(params.targetId));
			if (!tab) {
				throw new Error(`Target ${params.targetId} not found`);
			}
			browser.destroyTab(tab);
			server.emit<Protocol.Target.TargetDestroyedEvent>(
				"Target.targetDestroyed",
				{
					targetId: String(tab.id),
				}
			);
		},

		async setAutoAttach(params: Protocol.Target.SetAutoAttachRequest) {
			return {};
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
