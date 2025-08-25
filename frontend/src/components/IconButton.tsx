import type { IconifyIcon } from "@iconify/types";
import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";

export const IconButton: Component<{
	icon: IconifyIcon;
	click?: (e: MouseEvent) => void;
	rightclick?: (e: MouseEvent) => void;
	active?: boolean;
	tooltip?: string;
}> = function (cx) {
	this.active ??= true;
	return (
		<button
			disabled={use(this.active).map((x) => (x ? undefined : true))}
			class:active={use(this.active)}
			on:click={(e: MouseEvent) => this.click?.(e)}
			on:contextmenu={(e: MouseEvent) => this.rightclick?.(e)}
			title={this.tooltip}
		>
			<Icon icon={use(this.icon)} />
		</button>
	);
};
IconButton.style = css`
	:scope {
		box-sizing: border-box;
		aspect-ratio: 1/1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25em;

		font-size: 1.25em;
		color: var(--fg4);
		border-radius: 0.2em;
	}
	:scope.active:hover {
		background: var(--bg20);
	}
	:scope.active {
		color: var(--fg);
	}
`;
