import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { browser } from "../Browser";
import { trimUrl } from "../components/UrlInput";
import { createMenu } from "../components/Menu";

export const NewTabPage: Component<
	{
		tab: Tab;
	},
	{}
> = function () {
	return (
		<div>
			<div class="main">
				<input
					on:keydown={(e: KeyboardEvent) => {
						if (e.key === "Enter") {
							e.preventDefault();
							browser.searchNavigate((e.target as HTMLInputElement).value);
						}
					}}
					placeholder="Search Google or type A URL"
				></input>
				<div class="suggestions">
					{browser.globalhistory.slice(0, 5).map((entry) => (
						<div
							class="suggestion"
							on:contextmenu={(e: MouseEvent) => {
								createMenu({ left: e.clientX, top: e.clientY }, [
									{
										label: "Open",
										action: () => browser.activetab.pushNavigate(entry.url),
									},
									{
										label: "Open in New Tab",
										action: () => browser.newTab(entry.url),
									},
								]);
								e.preventDefault();
								e.stopPropagation();
							}}
							on:click={() => browser.newTab(entry.url)}
						>
							<div class="suggestioninner">
								<div class="circle">
									<img
										src={entry.favicon || "/defaultfavicon.png"}
										alt="favicon"
									/>
								</div>
								<span class="title">{entry.title || trimUrl(entry.url)}</span>
							</div>
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
		font-family: var(--font);
		background: var(--bg01);
		color: var(--fg);
	}

	.suggestions {
		width: 100%;

		grid-template-columns: repeat(5, 1fr);
		grid-template-rows: repeat(2, 1fr);
		display: grid;
	}

	.suggestion {
		cursor: pointer;
		aspect-ratio: 1/1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 2em;
	}
	.suggestion:hover {
		background: var(--bg03);
	}
	.suggestioninner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5em;
	}
	.circle {
		width: 64px;
		height: 64px;

		border-radius: 50%;
		background-color: var(--bg02);
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.title {
		width: 6em;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
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
		border: 2px solid var(--bg20);
		outline: none;
		border-radius: 1em;
		padding: 1em;
		background: var(--bg);
		color: var(--fg);
	}

	.main {
		position: relative;
		top: 10em;
	}
`;
