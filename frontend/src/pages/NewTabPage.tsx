import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { browser } from "../main";
import { trimUrl } from "../components/Omnibox";

export const NewTabPage: Component<
	{
		tab: Tab;
	},
	{}
> = function (cx) {
	return (
		<div>
			<div class="main">
				<h1>Puter Browser</h1>
				<input
					on:keydown={(e: KeyboardEvent) => {
						if (e.key === "Enter") {
							e.preventDefault();
							browser.searchNavigate(e.target!.value);
						}
					}}
					placeholder="Search Google or type A URL"
				></input>
				<div class="suggestions">
					{browser.globalhistory.slice(0, 5).map((entry) => (
						<div class="suggestion" on:click={() => browser.newTab()}>
							<div class="circle">
								<img src={entry.favicon || "/vite.svg"} alt="favicon" />
							</div>
							<span class="title">{entry.title || trimUrl(entry.url)}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
NewTabPage.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		font-family: sans-serif;
	}

	.suggestions {
		width: 100%;

		grid-template-columns: repeat(5, 1fr);
		grid-template-rows: repeat(2, 1fr);
		display: grid;
	}

	.suggestion {
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5em;
		width: 6em;
	}
	.circle {
		width: 64px;
		height: 64px;

		border-radius: 50%;
		background-color: #f0f0f0;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.title {
		width: 100%;
		text-overflow: ellipsis;
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
	}
	.suggestion img {
		width: 32px;
		height: 32px;
	}

	.main {
		width: 70%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1em;
	}

	input {
		width: 100%;
		height: 2em;
		font-size: 1.5em;
		border: 2px solid #ccc;
		outline: none;
		border-radius: 4px;
	}

	.main {
		position: relative;
		top: 10em;
	}
`;
