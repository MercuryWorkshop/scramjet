import { versionInfo } from "@mercuryworkshop/scramjet";
import { assertDependencyVersions } from "./version";

export { versionInfo };
export { ManagedPlugin } from "@mercuryworkshop/scramjet-controller";
export {
	HttpCachePlugin,
	CACHE_NAME,
	type HttpCachePluginOptions,
} from "./http-cache-plugin";
export { UrlWatcherPlugin, type UrlWatcherOptions } from "./url-watcher";
export { CatchEscapedLinksPlugin } from "./catch-escaped-links";
export {
	setupAlwaysLastBubble,
	type AddAlwaysLastEventListener,
} from "./alwaysLastBubble";
export {
	EventHandlerPlugin,
	type EventHandlerPluginOptions,
} from "./event-handler-plugin";
export {
	LinkHandlerPlugin,
	type LinkHandlerPluginOptions,
} from "./link-handler-plugin";

assertDependencyVersions();
