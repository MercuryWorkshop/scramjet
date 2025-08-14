import { css, type Component, type DLElement } from "dreamland/core";
import { browser } from "../main";

export const Menu: Component<{
	x: number;
	y: number;
	items: { label: string; action?: () => void }[];
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

		close();
		e.stopImmediatePropagation();
		e.preventDefault();
	};

	cx.mount = () => {
		browser.unfocusframes = true;
		document.body.appendChild(cx.root);
		const { top, left, width, height } = cx.root.getBoundingClientRect();
		let maxX = document.documentElement.clientWidth - width;
		let maxY = document.documentElement.clientHeight - height;
		if (this.x > maxX) this.x = maxX;
		if (this.y > maxY) this.y = maxY;

		window.addEventListener("click", ev, { once: true, capture: true });
		window.addEventListener("contextmenu", ev, {
			once: true,
			capture: true,
		});

		cx.root.addEventListener("click", (e) => {
			e.stopPropagation();
		});
	};
	return (
		<div style={use`--x: ${this.x}px; --y: ${this.y}px;`}>
			{use(this.items).mapEach((item) => (
				<button
					on:click={(e: MouseEvent) => {
						item.action?.();
						close();
						e.stopPropagation();
					}}
				>
					{item.label}
				</button>
			))}
		</div>
	);
};
Menu.style = css`
	:scope {
		position: absolute;
		top: var(--y);
		left: var(--x);
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		min-width: 10em;
	}
	button {
		background: none;
		border: none;
		font-size: 0.8em;
		padding: 1em;
		text-align: left;
	}
	button:hover {
		background: #f0f0f0;
	}
`;

let activeMenu: DLElement<typeof Menu> | null = null;

export function setContextMenu(
	elm: HTMLElement,
	items: { label: string; action?: () => void }[]
) {
	elm.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		createMenu(e.clientX, e.clientY, items);
	});
}

export function createMenu(
	x: number,
	y: number,
	items: { label: string; action?: () => void }[]
): DLElement<typeof Menu> {
	if (activeMenu) {
		activeMenu.remove();
	}

	let menu = <Menu x={x} y={y} items={items} />;
	activeMenu = menu as DLElement<typeof Menu>;

	return menu;
}
