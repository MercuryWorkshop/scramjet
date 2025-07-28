import iconClose from "@ktibow/iconset-ion/close";
import iconAdd from "@ktibow/iconset-ion/add";
import {
	createState,
	css,
	type Component,
	type ComponentInstance,
	type Stateful,
} from "dreamland/core";
import { Icon } from "./Icon";
import { memoize } from "../memoize";
import { IconButton } from "./IconButton";
import type { Tab } from "../Tab";
import html2canvas from "html2canvas";
import { setContextMenu } from "./Menu";
import { browser } from "../main";

export const DragTab: Component<
	{
		active: boolean;
		id: number;
		tab: Tab;
		mousedown: (e: MouseEvent) => void;
		destroy: () => void;
		transitionend: () => void;
	},
	{
		tooltipActive: boolean;
	}
> = function (cx) {
	this.tooltipActive = false;
	cx.mount = () => {
		setContextMenu(cx.root, [
			{
				label: "New tab to the right",
				action: () => {
					browser.newTabRight(this.tab);
				},
			},
			{
				label: "Reload",
				action: () => {
					this.tab.frame.reload();
				},
			},
			{
				label: "Duplicate",
				action: () => {
					browser.newTabRight(this.tab, this.tab.url);
				},
			},
			{
				label: "Close Tab",
				action: () => {
					this.destroy();
				},
			},
		]);
	};

	let hoverTimeout: number;

	return (
		<div
			style="z-index: 0;"
			class="tab"
			data-id={this.id}
			on:mousedown={(e) => {
				this.mousedown(e);
				e.stopPropagation();
				e.preventDefault();
			}}
			on:transitionend={() => {
				cx.root.style.transition = "";
				cx.root.style.zIndex = "0";
				this.transitionend();
			}}
			on:mouseenter={() => {
				if (hoverTimeout) clearTimeout(hoverTimeout);
				hoverTimeout = window.setTimeout(() => {
					this.tooltipActive = true;
				}, 500);
			}}
			on:mouseleave={() => {
				if (hoverTimeout) clearTimeout(hoverTimeout);
				this.tooltipActive = false;
			}}
		>
			<div class="tooltip" class:active={use(this.tooltipActive)}>
				<span class="title">{use(this.tab.title)}</span>
				<span class="hostname">{use(this.tab.url.hostname)}</span>
				{/*<img src={use(this.tab.screenshot)} class="img" />*/}
				<div
					style={use`background-image: -moz-element(#tab${this.tab.id})`}
					class="img"
				></div>
			</div>
			<div
				class="dragroot"
				style="position: unset;"
				on:auxclick={(e) => {
					if (e.button === 1) {
						this.destroy();
					}
				}}
			>
				<div class={use(this.active).map((x) => `main ${x ? "active" : ""}`)}>
					<img src={use(this.tab.icon)} />
					<span>{use(this.tab.title)}</span>
					<button
						class="close"
						on:click={(e) => {
							e.stopPropagation();
							this.destroy();
						}}
					>
						<Icon icon={iconClose} />
					</button>
				</div>
				{/* <div class="belowcontainer">
					{use(this.active).andThen(<div class="below"></div>)}
				</div> */}
			</div>
		</div>
	);
};
DragTab.style = css`
	:scope {
		display: inline-block;
		user-select: none;
		position: absolute;

		--tab-active-border-width: 11px;
		--tab-active-border-radius: 10px;
		--tab-active-border-radius-neg: -10px;
	}

	.tooltip {
		position: absolute;
		top: 5em;
		left: 0;
		z-index: 1000;
		background: var(--aboutbrowser-frame-bg);
		border-radius: 4px;
		width: 20em;
		/* height: 10em; */
		flex-direction: column;
		display: none;
		border-radius: 4px;
		padding: 0.5em;
	}
	.tooltip .hostname {
		font-size: 12px;
	}
	.tooltip.active {
		display: flex;
	}

	.tooltip .img {
		width: 100%;
		height: 10em;
		background-size: cover;
	}

	.main {
		height: 28px;
		min-width: 0;
		width: 100%;

		color: var(--aboutbrowser-inactive-tab-fg);

		border-radius: 4px;
		padding: 7px 8px 5px 8px;

		display: flex;
		align-items: center;
		gap: 8px;
	}
	.main img {
		width: 16px;
		height: 16px;
	}
	.main span {
		flex: 1;
		font-size: 13px;

		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.main .close > * {
		width: 14px;
		height: 14px;
	}
	.close {
		outline: none;
		border: none;
		background: none;
		cursor: pointer;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0;
		margin-left: 8px;
	}

	.main:not(.active):hover {
		transition: background 250ms;

		background: var(--aboutbrowser-hover-tab-bg);
		color: var(--aboutbrowser-hover-tab-fg);
	}

	.main.active {
		background: var(--aboutbrowser-active-tab-bg);
		color: var(--aboutbrowser-active-tab-fg);
	}

	.belowcontainer {
		position: relative;
	}
	.below {
		position: absolute;
		bottom: -6px;
		height: 6px;
		width: 100%;

		background: var(--aboutbrowser-active-tab-bg);
	}
	.below::before,
	.below::after {
		content: "";
		position: absolute;
		bottom: 0;

		width: var(--tab-active-border-width);
		height: var(--tab-active-border-radius);

		background: var(--aboutbrowser-active-tab-bg);
	}
	.below::before {
		left: var(--tab-active-border-radius-neg);
		mask-image: radial-gradient(
			circle at 0 0,
			transparent var(--tab-active-border-radius),
			black 0
		);
	}
	.below::after {
		right: var(--tab-active-border-radius-neg);
		mask-image: radial-gradient(
			circle at var(--tab-active-border-width) 0,
			transparent var(--tab-active-border-radius),
			black 0
		);
	}
`;

export const Tabs: Component<
	{
		tabs: Tab[];
		activetab: Tab;
		destroyTab: (tab: Tab) => void;
		addTab: () => void;
	},
	{
		container: HTMLElement;
		leftEl: HTMLElement;
		rightEl: HTMLElement;
		afterEl: HTMLElement;

		currentlydragging: number;
	},
	{}
> = function (cx) {
	this.currentlydragging = -1;

	const TAB_PADDING = 6;
	const TAB_MAX_SIZE = 231;
	const TAB_TRANSITION = "250ms ease";

	let transitioningTabs = 0;

	const getRootWidth = () => {
		const style = getComputedStyle(this.container);
		const padding =
			parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
		const border =
			parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
		const left = this.leftEl.offsetWidth;
		const right = this.rightEl.offsetWidth;
		const after = this.afterEl.offsetWidth;

		return this.container.offsetWidth - padding - border - left - right - after;
	};
	const getAbsoluteStart = () => {
		const rect = this.container.getBoundingClientRect();
		const style = getComputedStyle(this.container);

		return (
			rect.left +
			getLayoutStart() +
			parseFloat(style.paddingLeft) +
			parseFloat(style.borderLeftWidth)
		);
	};
	const getLayoutStart = () => {
		return this.leftEl.offsetWidth;
	};

	const getTabWidth = () => {
		let total = getRootWidth();

		// remove padding
		total -= TAB_PADDING * (this.tabs.length - 1);

		const each = total / this.tabs.length;

		return Math.min(TAB_MAX_SIZE, Math.floor(each));
	};

	const reorderTabs = () => {
		this.tabs.sort((a, b) => {
			const aCenter = a.pos + a.width / 2;

			const bLeft = b.pos;
			const bRight = b.pos + b.width;
			const bCenter =
				Math.abs(aCenter - bLeft) > Math.abs(aCenter - bRight) ? bRight : bLeft;

			return aCenter - bCenter;
		});
	};

	const getTabFromIndex = (index: number) => {
		return cx.root.querySelector(`.tab[data-id='${index}']`) as HTMLElement;
	};

	const layoutTabs = (transition: boolean) => {
		const width = getTabWidth();

		reorderTabs();

		let dragpos = -1;
		let currpos = getLayoutStart();
		for (const tab of this.tabs) {
			let component = getTabFromIndex(tab.id);
			component.style.width = width + "px";

			const tabPos = tab.dragpos != -1 ? tab.dragpos : currpos;
			component.style.transform = `translateX(${tabPos}px)`;
			if (transition && tab.dragpos == -1 && tab.pos != tabPos) {
				component.style.transition = `transform ${TAB_TRANSITION}`;
				this.afterEl.style.transition = `transform ${TAB_TRANSITION}`;
				transitioningTabs++;
			}
			dragpos = Math.max(dragpos, tab.dragpos + width + TAB_PADDING);

			tab.pos = tabPos;
			tab.width = width;
			currpos += width + TAB_PADDING;
		}

		const afterpos = Math.max(dragpos, currpos);
		this.afterEl.style.transform = `translateX(${afterpos}px)`;
	};
	use(this.tabs).listen(() => {
		setTimeout(() => {
			layoutTabs(true);
		}, 10);
	});

	cx.mount = () => {
		requestAnimationFrame(() => layoutTabs(false));
		window.addEventListener("resize", () => layoutTabs(false));

		setContextMenu(cx.root, [
			{
				label: "New Tab",
				action: () => {
					this.addTab();
				},
			},
		]);
	};

	const getMaxDragPos = () => {
		return getLayoutStart() + getRootWidth();
	};

	const calcDragPos = (e: MouseEvent, tab: Tab) => {
		const root = getTabFromIndex(tab.id);
		const maxPos = getMaxDragPos() - root.offsetWidth;

		const pos = e.clientX - tab.dragoffset - getAbsoluteStart();

		tab.dragpos = Math.min(Math.max(getLayoutStart(), pos), maxPos);
		layoutTabs(true);
	};

	window.addEventListener("mousemove", (e: MouseEvent) => {
		if (this.currentlydragging == -1) return;
		calcDragPos(e, this.tabs.find((tab) => tab.id === this.currentlydragging)!);
	});

	window.addEventListener("mouseup", (e) => {
		if (this.currentlydragging == -1) return;
		const tab = this.tabs.find((tab) => tab.id === this.currentlydragging)!;
		const root = getTabFromIndex(tab.id);
		const dragroot = root.querySelector(".dragroot") as HTMLElement;

		dragroot.style.width = "";
		dragroot.style.position = "unset";
		tab.dragoffset = -1;
		tab.dragpos = -1;
		layoutTabs(true);
		this.currentlydragging = -1;
	});

	const mouseDown = (e: MouseEvent, tab: Tab) => {
		if (e.button != 0) return;
		this.currentlydragging = tab.id;

		const root = getTabFromIndex(tab.id);
		const rect = root.getBoundingClientRect();
		root.style.zIndex = "100";
		const dragroot = root.querySelector(".dragroot") as HTMLElement;
		dragroot.style.width = rect.width + "px";
		dragroot.style.position = "absolute";
		tab.dragoffset = e.clientX - rect.left;
		tab.startdragpos = rect.left;

		if (tab.dragoffset < 0) throw new Error("dragoffset must be positive");

		calcDragPos(e, tab);

		if (this.activetab != tab) this.activetab = tab;
	};

	const transitionend = () => {
		transitioningTabs--;
		if (transitioningTabs == 0) {
			this.tabs = this.tabs;
		}

		this.afterEl.style.transition = "";
	};

	let tabcache = {};

	return (
		<div this={use(this.container).bind()}>
			<div class="extra left" this={use(this.leftEl).bind()}></div>
			{use(this.tabs).mapEach((tab) =>
				memoize(
					() => (
						<DragTab
							id={tab.id}
							tab={tab}
							active={use(this.activetab).map((x) => x === tab)}
							mousedown={(e) => mouseDown(e, tab)}
							destroy={() => {
								this.destroyTab(tab);
							}}
							transitionend={transitionend}
						/>
					),
					tab.id,
					tabcache
				)
			)}
			<div class="extra after" this={use(this.afterEl).bind()}>
				<IconButton icon={iconAdd} click={this.addTab}></IconButton>
			</div>
			<div class="extra right" this={use(this.rightEl).bind()}></div>
		</div>
	);
};
Tabs.style = css`
	:scope {
		background: var(--aboutbrowser-frame-bg);
		padding: 6px 12px;
		height: calc(28px + 12px);
		z-index: 2;

		position: relative;
	}

	.extra {
		top: 0px;
		height: 100%;
		position: absolute;
		display: flex;
		align-items: center;
	}

	.left {
		left: 0;
	}
	.right {
		right: 0;
	}
`;
