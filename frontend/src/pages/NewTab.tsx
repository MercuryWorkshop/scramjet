import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";

export const NewTab: Component<
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
							this.tab.history.push(new URL(e.target!.value));
						}
					}}
					placeholder="Search Google or type A URL"
				></input>
			</div>
		</div>
	);
};
NewTab.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		font-family: sans-serif;
	}

	.main {
		width: 70%;
		display: flex;
		flex-direction: column;
		align-items: center;
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
