import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { browser } from "../Browser";
import { IconButton } from "../components/IconButton";
import iconLink from "@ktibow/iconset-ion/link-outline";
import iconClose from "@ktibow/iconset-ion/close-outline";
import iconFolder from "@ktibow/iconset-ion/folder-outline";
import { Icon } from "../components/Icon";

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
							<span>{e.filename}</span>
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
`;
