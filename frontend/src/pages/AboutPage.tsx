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
		background: var(--bg01);
		color: var(--fg);
	}

	.main {
		width: 70%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.main {
		position: relative;
		top: 10em;
	}
`;
