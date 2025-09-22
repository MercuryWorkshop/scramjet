import {
	createDelegate,
	css,
	Pointer,
	type Component,
	type DLElement,
} from "dreamland/core";
import { browser } from "../Browser";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import type { IconifyIcon } from "@iconify/types";
import { emToPx } from "../utils";
import { isPuter } from "../main";

export const closeMenu = createDelegate<void>();

export type PositionConstraints = {
	left?: number;
	right?: number;
	top?: number;
	bottom?: number;
};

export const Menu: Component<
	{
		position: PositionConstraints;
		items?: MenuItem[];
		custom?: HTMLElement;
	},
	{
		closing: boolean;
		x: number;
		y: number;
	}
> = function (cx) {
	this.closing = true;
	requestAnimationFrame(() => {
		this.closing = false;
	});
	this.x = 0;
	this.y = 0;

	const close = () => {
		browser.unfocusframes = false;

		window.removeEventListener("click", ev, { capture: true });
		window.removeEventListener("contextmenu", ev, { capture: true });

		this.closing = true;
		cx.root.addEventListener("transitionend", () => {
			cx.root.remove();
		});
	};
	closeMenu.listen(close);

	const ev = (e: MouseEvent) => {
		// Don't close if the click is over the menu
		if (cx.root.contains(e.target as Node)) {
			return;
		}

		close();
		e.stopImmediatePropagation();
		e.preventDefault();
	};

	cx.mount = () => {
		browser.unfocusframes = true;
		document.body.appendChild(cx.root);
		const { width, height } = cx.root.getBoundingClientRect();
		const docWidth = document.documentElement.clientWidth;
		const docHeight = document.documentElement.clientHeight;
		const padding = emToPx(1);

		if (this.position.left !== undefined) {
			this.x = this.position.left;
		} else if (this.position.right !== undefined) {
			this.x = this.position.right - width;
		}

		if (this.position.top !== undefined) {
			this.y = this.position.top;
		} else if (this.position.bottom !== undefined) {
			this.y = this.position.bottom - height;
		}

		const maxX = docWidth - width - padding;
		const maxY = docHeight - height - padding;
		if (this.x > maxX) this.x = maxX;
		if (this.y > maxY) this.y = maxY;
		if (this.x < padding) this.x = padding;
		if (this.y < padding) this.y = padding;

		window.addEventListener("click", ev, { capture: true });
		window.addEventListener("contextmenu", ev, {
			capture: true,
		});

		cx.root.addEventListener("click", (e) => {
			e.stopPropagation();
		});
	};
	return (
		<div
			style={use`--x: ${this.x}px; --y: ${this.y}px;`}
			class:closing={use(this.closing)}
		>
			{this.items
				? use(this.items).mapEach((item) =>
						item == "-" ? (
							<div class="separator" />
						) : item.checkbox ? (
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
								{item.image ? (
									<img src={item.image}></img>
								) : item.icon ? (
									<Icon icon={item.icon}></Icon>
								) : (
									<div class="pad" />
								)}
								<span>{item.label}</span>
							</button>
						)
					)
				: this.custom}
		</div>
	);
};
Menu.style = css`
	:scope {
		position: absolute;
		top: var(--y);
		left: var(--x);
		background: var(--bg02);
		border: 1px solid var(--fg4);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		min-width: 10em;
		overflow: hidden;

		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
		opacity: 1;
		transform: scale(100%);
	}
	.separator {
		border-top: 1px solid var(--fg4);
	}
	:scope.closing {
		transform: scale(95%);
		opacity: 0;
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

	img {
		width: 16px;
		height: 16px;
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

type MenuItem =
	| {
			label: string;
			action?: () => void;
			checkbox?: Pointer<boolean>;
			icon?: IconifyIcon;
			image?: string;
	  }
	| "-";

export function setContextMenu(elm: HTMLElement, items: MenuItem[]) {
	elm.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		createMenu({ left: e.clientX, top: e.clientY }, items);
	});
}

export function createMenu(
	position: PositionConstraints,
	items: MenuItem[]
): DLElement<typeof Menu> {
	if (isPuter) {
		puter.ui.contextMenu({
			items: items.map((i) =>
				i == "-"
					? i
					: {
							label: i.label,
							action: i.action,
						}
			),
		});

		return undefined as any;
	}

	if (activeMenu) {
		closeMenu();
	}

	let menu = (<Menu position={position} items={items} />) as DLElement<
		typeof Menu
	>;
	activeMenu = menu;

	return menu;
}

export function createMenuCustom(
	position: PositionConstraints,
	custom: HTMLElement
): DLElement<typeof Menu> {
	if (activeMenu) {
		closeMenu();
	}

	let menu = (<Menu position={position} custom={custom} />) as DLElement<
		typeof Menu
	>;
	activeMenu = menu;

	return menu;
}
