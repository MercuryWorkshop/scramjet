import { ManagedPlugin } from "@mercuryworkshop/scramjet-controller";
import type { Frame } from "@mercuryworkshop/scramjet-controller";

export type UrlWatcherOptions = {};

/**
 * Runs a callback whenever the URL of a Frame changes.
 * Includes hash changes and history.pushState/replaceState.
 * For only true navigation events, use the Frame.hooks.init.post hook.
 */
export class UrlWatcherPlugin extends ManagedPlugin {
	constructor(
		private onUrlChange: (url: string) => void,
		private options: UrlWatcherOptions = {}
	) {
		super("url-watcher", []);
	}

	install(frame: Frame): void {
		this.tap(frame.hooks.init.post, (context) => {
			if (!context.isTopLevel) return;

			const notify = () => {
				this.onUrlChange(context.client.url.href);
			};

			notify();

			this.tap(context.client.hooks.lifecycle.navigate, (_context, props) => {
				this.onUrlChange(props.url);
			});

			// TODO: this will probably make it fire twice if it was triggered by location.hash
			context.window.addEventListener("hashchange", notify, { capture: true });
		});
	}
}
