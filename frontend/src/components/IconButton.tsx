import type { IconifyIcon } from "@iconify/types";
import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";

export const IconButton: Component<{
	icon: IconifyIcon;
	click?: (e: MouseEvent) => void;
	active?: boolean;
}> = function (cx) {
	this.active ??= true;
	return (
		<button
			disabled={use(this.active).map((x) => (x ? undefined : true))}
			class:active={use(this.active)}
			on:click={(e) => this.click?.(e)}
		>
			<Icon icon={this.icon} />
		</button>
	);
};
IconButton.style = css`
	:scope {
		padding: 0.4em;
		display: flex;
		outline: none;
		border: none;
		font-size: 1.25em;
		background: none;
		color: grey;
	}
	:scope.active {
		cursor: pointer;
		color: var(--aboutbrowser-active-tab-fg);
	}
`;
