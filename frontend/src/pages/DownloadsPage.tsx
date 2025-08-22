import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { browser } from "../Browser";
import { IconButton } from "../components/IconButton";
import iconLink from "@ktibow/iconset-ion/link-outline";
import iconClose from "@ktibow/iconset-ion/close-outline";
import iconFolder from "@ktibow/iconset-ion/folder-outline";
import { Icon } from "../components/Icon";

// Format bytes into human readable format
export function formatBytes(bytes: number, decimals: number = 2): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return (
		parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
	);
}

export const DownloadsPage: Component<
	{
		tab: Tab;
	},
	{}
> = function () {
	return (
		<div>
			<div class="main">
				<h1>Downloads</h1>
				<div class="entries">
					{use(browser.globalDownloadHistory).mapEach((e) => (
						<div class="entry">
							<div class="iconcontainer">
								<img src="/vite.svg"></img>
							</div>
							<div class="content">
								<a href={e.url}>{e.filename}</a>
								<span>
									<span>{formatBytes(e.size)}</span>
									<span>{new URL(e.url).hostname}</span>
									<span>{new Date(e.timestamp).toDateString()}</span>
								</span>
							</div>
							<div class="icons">
								<Icon icon={iconFolder}></Icon>
								<Icon icon={iconLink}></Icon>
								<Icon icon={iconClose}></Icon>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
DownloadsPage.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: sans-serif;

		background: var(--bg01);
		color: var(--fg);
		overflow-y: scroll;
	}

	a {
		color: color-mix(in oklab, var(--fg) 50%, var(--accent));
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: 1em;
		justify-content: center;
	}
	.entries {
		display: flex;
		flex-direction: column;
		gap: 1em;
		width: 100%;
	}
	.entry {
		display: flex;
		/*border-bottom: 1px solid #ccc;*/
		cursor: pointer;
		gap: 3em;

		width: 100%;
		background: var(--bg04);
		/*height: 10em;*/

		border-radius: var(--radius);
		padding: 2em;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}
	.entry img {
		width: 16px;
		height: 16px;
	}
	.entry .title {
		font-weight: bold;
	}

	.iconcontainer {
		width: 2em;
		height: 100%;
		justify-content: center;
	}
	.iconcontainer img {
		width: 100%;
		height: auto;
	}

	.icons {
		flex: 1;
		display: flex;
		justify-content: right;
		gap: 0.5em;

		font-size: 1.5em;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}

	.content > span {
		display: flex;
		gap: 1em;
		color: var(--fg2);
	}
`;
