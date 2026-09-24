import { ScramjetClient } from "@client/index";
import {
	Object_defineProperty,
	Reflect_apply,
	Reflect_construct,
} from "@/shared/snapshot";
import { CallSite, incumbencyMode, rawCallSites } from "@/shared/incumbency";

/**
 * What one rewritten script has to be made to look like, and how a frame is
 * traced back to it.
 */
export type ScriptRealm = {
	/**
	 * The realm the script was evaluated in, and the whole point of the
	 * exercise - `SingletonBox` is shared across the client tree, so a record
	 * in it says nothing about which realm without the client that put it there.
	 *
	 * Sound because `registerrealmfn` is installed per realm, on each realm's
	 * own global: a script resolving that identifier necessarily reaches its
	 * own realm's copy, so the client this closure captured is the script's.
	 */
	client: ScramjetClient;
	/** the scramtag the rewriter stamped into this script's functions */
	tag: string;
};

/**
 * Only the modes that install anything. `none` records nothing and gets no
 * globals - a global nothing calls is a surface for nothing.
 */
export const enabled = (client: ScramjetClient) => {
	const mode = incumbencyMode(client.context, client.topUrl);

	return mode === "pst" || mode === "stamp" || mode === "lazystamp";
};

/**
 * The realm whose script is running, as the stamp modes record it: the
 * innermost rewritten call site on the stack.
 *
 * Null when nothing the rewriter touched is on the stack at all - a callback
 * the host invoked directly, where the answer is the backup incumbent settings
 * object and nothing has recorded one.
 */
export function incumbentClient(client: ScramjetClient): ScramjetClient | null {
	const realm = client.box.incumbent;

	return (realm && client.box.globals.get(realm)) ?? null;
}

/**
 * How many frames an `Intercept` member's body sits above its caller: the body
 * itself, `invoke`, `attemptToCallHandler` and the proxy's `apply` - and the
 * trampoline, with `debugTrampolines` on.
 */
export const interceptDepth = (client: ScramjetClient) =>
	client.flagEnabled("debugTrampolines") ? 5 : 4;

/**
 * The same for a `client.Proxy` handler: the handler, the proxy's `apply`, and
 * the trampoline between them with `debugTrampolines` on.
 */
const proxyDepth = (client: ScramjetClient) =>
	client.flagEnabled("debugTrampolines") ? 3 : 2;

/**
 * The incumbent for the member whose body called this, `depth` frames above
 * the page's call into it.
 *
 * https://html.spec.whatwg.org/multipage/webappapis.html#incumbent-settings-object
 *
 * The topmost script-having execution context's realm if there is one, judged
 * by the frame at the fixed offset alone - under `pst`, whether it is a script
 * that registered; under the stamp modes, the realm the last rewritten call
 * recorded - and the backup incumbent settings object stack's top otherwise.
 *
 * Null in `none`, which records nothing, and when there is no answer at all.
 */
export function incumbentFor(
	client: ScramjetClient,
	depth: number
): ScramjetClient | null {
	const mode = incumbencyMode(client.context, client.topUrl);

	if (mode === "pst") {
		// rawCallSites and this function, then the member's own frames
		const caller = rawCallSites(3 + depth)?.[2 + depth];
		const realm = caller && realmForFrame(client, caller);
		if (realm) return realm.client;
	} else if (mode === "stamp" || mode === "lazystamp") {
		const incumbent = incumbentClient(client);
		if (incumbent) return incumbent;
	} else {
		return null;
	}

	const stack = client.box.backupincumbents;

	return stack.length ? stack[stack.length - 1] : null;
}

/**
 * https://html.spec.whatwg.org/multipage/webappapis.html#prepare-to-run-a-callback
 *
 * The backup incumbent settings object stack is pushed when the host runs a
 * callback, with the incumbent the callback was converted under - which is
 * every API that takes one, and far too many to intercept. It only decides
 * anything for a callback that puts no script of its own on the stack: a
 * script-having one is its own incumbent. And the one such callback that can
 * reach an incumbent-sensitive member is that member itself, bound.
 *
 * So the entry is recorded on the bound function instead, when it is made:
 * binding a member in {@link SingletonBox.incumbentSinks} binds a stand-in
 * that runs it with the incumbent of `bind`'s caller pushed. That is the
 * converting realm whenever the realm that binds is the one that hands the
 * result over, which is assumed - a function bound in one realm and handed to
 * a host API by another answers with the first.
 *
 * It also answers where the spec would not ask the backup stack at all: a
 * bound sink called directly by a script of *another* realm names the realm
 * that bound it rather than the caller.
 */
function installBind(client: ScramjetClient) {
	const box = client.box;

	client.Proxy("Function.prototype.bind", {
		apply(ctx) {
			const target = ctx.this;
			if (!box.incumbentSinks.has(target)) return;

			const incumbent = incumbentFor(client, proxyDepth(client));
			if (!incumbent) return;

			const standIn: any = new Proxy(target as (...args: any[]) => any, {
				apply(fn, that, args) {
					return callWithBackupIncumbent(client, incumbent, fn, that, args);
				},
				construct(fn, args, newTarget) {
					// a bound function constructed with itself as newTarget
					// hands over its target, which is this stand-in
					return Reflect_construct(
						fn,
						args,
						newTarget === standIn ? fn : newTarget
					);
				},
			});
			box.unproxy.set(standIn, target);

			ctx.this = standIn;
		},
	});
}

/**
 * Run `fn` with `incumbent` on the backup incumbent settings object stack,
 * and off it again however it exits. The stamp modes have no frames to look
 * at, so it is also recorded as the last realm running; a rewritten call the
 * callee makes records its own over it.
 */
function callWithBackupIncumbent(
	client: ScramjetClient,
	incumbent: ScramjetClient,
	fn: (...args: any[]) => any,
	that: any,
	args: any[]
) {
	const box = client.box;
	const stack = box.backupincumbents;
	const depth = stack.length;
	stack[depth] = incumbent;

	const mode = incumbencyMode(client.context, client.topUrl);
	if (mode === "stamp" || mode === "lazystamp") {
		box.incumbent = incumbent.global as Self;
	}

	try {
		return Reflect_apply(fn, that, args);
	} finally {
		stack.length = depth;
	}
}

export default function (client: ScramjetClient, self: Self) {
	const mode = incumbencyMode(client.context, client.topUrl);

	installBind(client);

	if (mode === "stamp" || mode === "lazystamp") {
		installCallFn(client, self);

		return;
	}

	// every rewritten script registers itself before it runs
	Object_defineProperty(self, client.config.globals.registerrealmfn, {
		value: (scriptId: string, tag: string) => {
			const realm: ScriptRealm = { client, tag };
			client.box.scriptrealms[scriptId] = realm;

			if (mode !== "pst") return;

			// this runs at the top of the script being registered, which is
			// the frame after rawCallSites() and this function. eval'd code and
			// `new Function` are that frame too - the script that evaluated them
			// is below it
			const self = rawCallSites(3)?.[2];
			const hash = self && self.getScriptHash?.();

			// its hash is the key a later stack walk looks it up by, and nothing
			// had to be written into the source - or shown to the page - to get
			// it there
			if (hash) client.box.scripthashes[hash] = scriptId;
		},
		enumerable: false,
		writable: false,
		configurable: false,
	});
}

/**
 * The realm a PST stack frame belongs to: look up the registered script and
 * the client it ran in by its hash.
 */
export function realmForFrame(
	client: ScramjetClient,
	frame: CallSite
): ScriptRealm | null {
	try {
		const hash = frame.getScriptHash?.();
		const scriptId = hash && client.box.scripthashes[hash];
		return scriptId ? (client.box.scriptrealms[scriptId] ?? null) : null;
	} catch {
		// Not a usable V8 CallSite.
		return null;
	}
}

/**
 * `callfn`, which every call in a `stamp`-rewritten script goes through.
 *
 * `$call(receiver, fn, ...args)`. The realm it records is this one's, and not
 * passed in: the name the rewriter emits resolves in the realm the code is
 * *running* in, so code `parent.eval`'d into another realm reaches that
 * realm's `$call`, which is the realm the browser would call incumbent too.
 *
 * `lazystamp` narrows the rewrite to calls written as `postMessage` rather
 * than narrowing anything here - by the time a call reaches this function it
 * has already been decided to be worth recording.
 */
function installCallFn(client: ScramjetClient, self: Self) {
	const box = client.box;

	Object_defineProperty(self, client.config.globals.callfn, {
		value: function (receiver: any, fn: any, ...args: any[]) {
			// only the innermost call can be the incumbent, so there is nothing
			// to keep a stack of, and nothing to put back afterwards either:
			// the next rewritten call overwrites this before anything reads
			// it, and until one does, what is left behind is the realm that
			// was running when the host was handed whatever it is now calling
			// - which is what the backup incumbent settings object would have
			// recorded. Restoring instead would answer a callback the host
			// invoked with nothing at all
			box.incumbent = self;

			return Reflect_apply(fn, receiver, args);
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
}
