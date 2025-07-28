import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { scramjet } from "../main";

export const AboutPage: Component<
	{
		tab: Tab;
	},
	{}
> = function (cx) {
	return (
		<div>
			<div class="main">
				<h1>Puter Browser</h1>
				Scramjet Version: {$scramjetVersion.build} {$scramjetVersion.version}
			</div>
		</div>
	);
};
AboutPage.style = css`
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
