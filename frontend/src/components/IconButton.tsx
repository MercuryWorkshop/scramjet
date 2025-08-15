import type { IconifyIcon } from "@iconify/types";
import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";

export const IconButton: Component<{
	icon: IconifyIcon;
	click?: (e: MouseEvent) => void;
	active?: boolean;
	tooltip?: string;
}> = function (cx) {
	this.active ??= true;
	return (
		<button
			disabled={use(this.active).map((x) => (x ? undefined : true))}
			class:active={use(this.active)}
			on:click={(e) => this.click?.(e)}
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
		align-items: center;
		justify-content: center;
		padding-top: 0.25em;

		padding-bottom: 0.25em;

		display: flex;
		outline: none;
		border: none;
		font-size: 1.25em;
		background: none;
		color: var(--fg4);
		border-radius: 0.2em;
	}
	:scope.active:hover {
		background: var(--bg20);
	}
	:scope.active {
		cursor: pointer;
		color: var(--fg);
	}
`;
