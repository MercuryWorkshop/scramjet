import type { IconifyIcon } from "@iconify/types";
import type { Component } from "dreamland/core";
import { Icon } from "./Icon";

export const IconButton: Component<{
	icon: IconifyIcon;
	click?: (e: MouseEvent) => void;
}> = function (cx) {
	return (
		<button on:click={(e) => this.click?.(e)}>
			<Icon icon={this.icon} />
		</button>
	);
};
IconButton.css = `
  :scope {
    padding: 0.4em;
    display: flex;
    outline: none;
    border: none;
    font-size: 1.25em;
    background: inerhit
    # background: var(--aboutbrowser-toolbar-bg);
    cursor: pointer;
  }
`;
