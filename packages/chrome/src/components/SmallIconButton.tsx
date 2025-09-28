import type { IconifyIcon } from "@iconify/types";
import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";

export const SmallIconButton: Component<{
	click: (e: MouseEvent) => void;
	icon: IconifyIcon;
}> = function () {
	return (
		<button on:click={this.click}>
			<Icon icon={this.icon}></Icon>
		</button>
	);
};
SmallIconButton.style = css`
	:scope {
		display: flex;
		align-items: center;
		font-size: 1em;
		position: relative;
	}
	:scope:hover::before {
		content: "";
		z-index: -1;
		position: absolute;
		width: 150%;
		height: 150%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg20);
		border-radius: 50%;
	}
`;
