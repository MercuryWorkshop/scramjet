import { css, Pointer, type Component, type DLElement } from "dreamland/core";
import { browser } from "../Browser";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import type { IconifyIcon } from "@iconify/types";

export const Menu: Component<{
	x: number;
	y: number;
	items: MenuItem[];
}> = function (cx) {
	const close = () => {
		cx.root.remove();
		browser.unfocusframes = false;
	};

	const ev = (e: MouseEvent) => {
		// Don't close if the click is over the menu
		if (cx.root.contains(e.target as Node)) {
			return;
		}

		window.removeEventListener("click", ev, { capture: true });
		window.removeEventListener("contextmenu", ev, { capture: true });
		close();
		e.stopImmediatePropagation();
		e.preventDefault();
	};

	cx.mount = () => {
		browser.unfocusframes = true;
		document.body.appendChild(cx.root);
		const { width, height } = cx.root.getBoundingClientRect();
		let maxX = document.documentElement.clientWidth - width;
		let maxY = document.documentElement.clientHeight - height;
		if (this.x > maxX) this.x = maxX;
		if (this.y > maxY) this.y = maxY;

		window.addEventListener("click", ev, { capture: true });
		window.addEventListener("contextmenu", ev, {
			capture: true,
		});

		cx.root.addEventListener("click", (e) => {
			e.stopPropagation();
		});
	};
	return (
		<div style={use`--x: ${this.x}px; --y: ${this.y}px;`}>
			{use(this.items).mapEach((item) =>
				item.checkbox ? (
					<button
						class="item"
						on:click={(e: MouseEvent) => {
							if (!item.checkbox) return;
							item.checkbox.value = !item.checkbox.value;

							e.preventDefault();
							e.stopPropagation();
						}}
					>
						<Checkbox value={item.checkbox}></Checkbox>
						{item.label}
					</button>
				) : (
					<button
						class="item"
						on:click={(e: MouseEvent) => {
							item.action?.();
							close();
							e.stopPropagation();
						}}
					>
						{item.icon ? <Icon icon={item.icon}></Icon> : <div class="pad" />}
						<span>{item.label}</span>
					</button>
				)
			)}
		</div>
	);
};
Menu.style = css`
	:scope {
		position: absolute;
		top: var(--y);
		left: var(--x);
		background: var(--bg);
		border: 1px solid var(--fg4);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		min-width: 10em;
	}
	.item {
		background: none;
		border: none;
		font-size: 0.8em;
		padding: 1em;
		text-align: left;
		color: var(--fg);

		display: flex;
		align-items: center;
		gap: 1em;
	}

	.pad {
		width: 1em;
	}

	input[type="checkbox"] {
		width: 1em;
		height: 1em;
		padding: 0;
		margin: 0;

		background: var(--bg);
		border: 1px solid var(--bg20);
	}
	.item:hover {
		background: var(--bg01);
	}
`;

let activeMenu: DLElement<typeof Menu> | null = null;

type MenuItem = {
	label: string;
	action?: () => void;
	checkbox?: Pointer<boolean>;
	icon?: IconifyIcon;
};

export function setContextMenu(elm: HTMLElement, items: MenuItem[]) {
	elm.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		createMenu(e.clientX, e.clientY, items);
	});
}

export function createMenu(
	x: number,
	y: number,
	items: MenuItem[]
): DLElement<typeof Menu> {
	if (activeMenu) {
		activeMenu.remove();
	}

	let menu = (<Menu x={x} y={y} items={items} />) as DLElement<typeof Menu>;
	activeMenu = menu;

	return menu;
}
