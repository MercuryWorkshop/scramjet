import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";

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
					<div class="entry">
						<img src="/vite.svg"></img>
						<span>watermelon.mp3</span>
					</div>
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
