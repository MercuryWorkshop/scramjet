import { ScramjetClient } from "@client/index";
import { Arguments, Constructor, Returns, Type } from "@client/webidl";
import { readWorkerOptions, readWorkletOptions } from "@client/helpers";
import { String_indexOf, String_substring } from "@/shared/snapshot";

export default function (client: ScramjetClient, self: Self) {
	const scoped = (name: string) => `${client.scopeOrigin}@${name}`;

	/**
	 * The `credentials` signal `rewriteUrl` stamps onto the proxy URL, which the
	 * service worker reads back for `Sec-Fetch-Storage-Access`. Only "include"
	 * is carried: `fetch/headers.ts` treats an absent value as the default the
	 * destination implies, and for these three that default is what the other
	 * two enum members mean.
	 */
	const credentialsOption = (credentials: RequestCredentials) =>
		credentials === "include" ? "include" : undefined;

	// A shared worker is the one scoped name the page can read back from the
	// inside: `SharedWorkerGlobalScope.name` is the string the constructor was
	// given, so without this a site reads `https://site.example@myworker`.
	if ("SharedWorkerGlobalScope" in self) {
		client.Intercept(class extends SharedWorkerGlobalScope {
			@Type("DOMString")
			get name(): string {
				const name = super.name;

				// the origin cannot contain an "@", so the first one is the
				// separator and a name the page put an "@" in survives intact
				return String_substring(name, String_indexOf(name, "@") + 1);
			}
		});
	}

	client.Intercept(class extends Worker {
		@Constructor("USVString", "optional WorkerOptions")
		static konstructor(scriptURL: string, options?: WorkerOptions) {
			const init = readWorkerOptions(options);

			return new this(
				client.rewriteUrl(scriptURL, {
					destination: "worker",
					isModule: init.type === "module",
					credentials: credentialsOption(init.credentials),
				}),
				init
			);
		}
	});

	// sharedworkers can only be constructed from window
	if ("SharedWorker" in self)
		client.Intercept(class extends SharedWorker {
			@Constructor("USVString", "optional (DOMString or WorkerOptions)")
			static konstructor(scriptURL: string, options?: string | WorkerOptions) {
				if (typeof options === "string") {
					return new this(
						client.rewriteUrl(scriptURL, { destination: "sharedworker" }),
						scoped(options)
					);
				}

				const init = readWorkerOptions(options);

				return new this(
					client.rewriteUrl(scriptURL, {
						destination: "sharedworker",
						isModule: init.type === "module",
						credentials: credentialsOption(init.credentials),
					}),
					{ ...init, name: scoped(init.name!) }
				);
			}
		});

	if ("Worklet" in self)
		client.Intercept(class extends Worklet {
			@Arguments("USVString", "optional WorkletOptions")
			@Returns("Promise<undefined>")
			async addModule(
				moduleURL: string,
				options?: WorkletOptions
			): Promise<void> {
				const init = readWorkletOptions(options);

				// a worklet's script is always a module script - there is no
				// classic form to opt into - so the URL has to say so, or the
				// service worker treats it as a classic script and neither the
				// request's mode and credentials nor the rewrite it eventually
				// gets are the ones a module is owed.
				//
				// `destination` is deliberately left to the browser, which
				// reports `audioworklet` / `paintworklet`. Naming `script` here
				// would route the body through the module rewriter, and the
				// result references the `$scramjet$*` helpers - which a
				// `WorkletGlobalScope` does not have and cannot be given, so it
				// would turn a worklet that merely leaks URLs into one that
				// throws on load.
				return super.addModule(
					client.rewriteUrl(moduleURL, {
						isModule: true,
						credentials: credentialsOption(init.credentials),
					}),
					init
				);
			}
		});
}
