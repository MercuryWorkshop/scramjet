import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { browser } from "../main";

export const HistoryPage: Component<
	{
		tab: Tab;
	},
	{}
> = function (cx) {
	return (
		<div>
			<h1>History</h1>
			<div class="entries">
				{browser.globalhistory
					.sort((a, b) => b.timestamp - a.timestamp)
					.map((entry) => (
						<div
							class="entry"
							on:click={() => {
								browser.newTab(entry.url);
							}}
						>
							<img src={entry.favicon || "/vite.svg"} alt="favicon" />
							<span class="title">{entry.title || entry.url.href}</span>
							<span class="url">{entry.url.hostname}</span>
						</div>
					))}
			</div>
		</div>
	);
};
HistoryPage.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: sans-serif;
	}
	.entries {
		display: flex;
		flex-direction: column;
		gap: 1em;
		width: 70%;
	}
	.entry {
		display: flex;
		align-items: center;
		/*border-bottom: 1px solid #ccc;*/
		cursor: pointer;
		gap: 0.5em;
	}
	.entry img {
		width: 16px;
		height: 16px;
	}
	.entry .title {
		font-weight: bold;
	}
`;
