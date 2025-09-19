import iconClose from "@ktibow/iconset-ion/close";
import iconAdd from "@ktibow/iconset-ion/add";
import iconNew from "@ktibow/iconset-ion/duplicate-outline";
import iconDuplicate from "@ktibow/iconset-ion/copy-outline";
import iconRefresh from "@ktibow/iconset-ion/refresh-outline";
import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";
import { memoize } from "../memoize";
import { OmnibarButton } from "./OmnibarButton";
import type { Tab } from "../Tab";
// import html2canvas from "html2canvas";
import { setContextMenu } from "./Menu";
import { browser, forceScreenshot, pushTab } from "../Browser";

const isFirefox =
	navigator.userAgent.includes("Gecko/") &&
	!navigator.userAgent.includes("Chrome");

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
				icon: iconNew,
				action: () => {
					browser.newTabRight(this.tab);
				},
			},
			{
				label: "Reload",
				icon: iconRefresh,
				action: () => {
					this.tab.frame.reload();
				},
			},
			{
				label: "Duplicate",
				icon: iconDuplicate,
				action: () => {
					browser.newTabRight(this.tab, this.tab.url);
				},
			},
			{
				label: "Close Tab",
				icon: iconClose,
				action: () => {
					this.destroy();
				},
			},
		]);

		cx.root.animate(
			[
				{
					width: "0px",
				},
				{},
			],
			{
				duration: 100,
				fill: "forwards",
			}
		);
	};

	let hoverTimeout: number;

	return (
		<div
			style="z-index: 0;"
			class="tab"
			data-id={this.id}
			on:mousedown={(e: MouseEvent) => {
				this.mousedown(e);
				e.stopPropagation();
				e.preventDefault();
			}}
			on:contextmenu={() => {
				if (hoverTimeout) clearTimeout(hoverTimeout);
				this.tooltipActive = false;
			}}
			on:transitionend={() => {
				cx.root.style.transition = "";
				cx.root.style.zIndex = "0";
				this.transitionend();
			}}
			on:mouseenter={() => {
				forceScreenshot(this.tab);
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
				<div class="text">
					<span class="title">{use(this.tab.title)}</span>
					<span class="hostname">{use(this.tab.url.hostname)}</span>
				</div>
				{isFirefox ? (
					<div
						style={use`background-image: -moz-element(#tab${this.tab.id})`}
						class="img"
					></div>
				) : (
					use(this.tab.screenshot).andThen(
						<img src={use(this.tab.screenshot)} class="img" />
					)
				)}
			</div>
			<div
				class="dragroot"
				style="position: unset;"
				on:auxclick={(e: MouseEvent) => {
					if (e.button === 1) {
						this.destroy();
					}
				}}
			>
				<div class={use(this.active).map((x) => `main ${x ? "active" : ""}`)}>
					<img
						src={use(this.tab.icon)}
						on:error={() => (this.tab.icon = "/defaultfavicon.png")}
					/>
					<span>{use(this.tab.title)}</span>
					<button
						class="close"
						on:click={(e: MouseEvent) => {
							e.stopPropagation();
							this.destroy();
						}}
						on:contextmenu={(e: MouseEvent) => {
							e.preventDefault();
							e.stopPropagation();
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
		top: 2.25em;
		left: 0;
		z-index: 1000;
		background: var(--bg);
		border: 1px solid var(--bg20);
		border-radius: 4px;
		width: 20em;
		gap: 0.25em;
		flex-direction: column;
		display: none;
		border-radius: 4px;
	}
	.tooltip .text {
		padding: 0.5em;
		display: flex;
		flex-direction: column;
		gap: 0.1em;
	}
	.tooltip .hostname {
		font-size: 12px;
	}
	.tooltip.active {
		display: flex;
	}

	.tooltip .img {
		width: 100%;
		aspect-ratio: var(--viewport-ratio);
		background-size: cover;
	}

	.main {
		height: 28px;
		min-width: 0;
		width: 100%;

		color: var(--fg);

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
		color: var(--fg);

		padding: 0;
		margin-left: 8px;
	}
	.close:hover {
		background: var(--bg20);
		border-radius: 0.5em;
	}

	.main:not(.active):hover {
		transition: background 250ms;

		background: var(--bg01);
		color: var(--fg);
	}

	.main.active {
		background: var(--bg02);
		color: var(--fg);
	}

	.belowcontainer {
		position: relative;
	}
	.below {
		position: absolute;
		bottom: -6px;
		height: 6px;
		width: 100%;

		background: var(--bg);
	}
	.below::before,
	.below::after {
		content: "";
		position: absolute;
		bottom: 0;

		width: var(--tab-active-border-width);
		height: var(--tab-active-border-radius);

		background: var(--bg01);
	}
`;

type VisualTab = {
	tab: Tab;
	root: HTMLElement;
	dragoffset: number;
	dragpos: number;
	startdragpos: number;

	width: number;
	pos: number;
};

export const Tabs: Component<
	{
		tabs: Tab[];
		visualtabs: VisualTab[];
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
	this.visualtabs = [];

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
		total -= TAB_PADDING * (this.visualtabs.length - 1);

		const each = total / this.visualtabs.length;

		return Math.min(TAB_MAX_SIZE, Math.floor(each));
	};

	const reorderTabs = () => {
		this.visualtabs.sort((a, b) => {
			const aCenter = a.pos + a.width / 2;

			const bLeft = b.pos;
			const bRight = b.pos + b.width;
			const bCenter =
				Math.abs(aCenter - bLeft) > Math.abs(aCenter - bRight) ? bRight : bLeft;

			return aCenter - bCenter;
		});
	};

	const layoutTabs = (transition: boolean) => {
		const width = getTabWidth();

		reorderTabs();

		let dragpos = -1;
		let currpos = getLayoutStart();
		for (const tab of this.visualtabs) {
			tab.root.style.width = width + "px";

			const tabPos = tab.dragpos != -1 ? tab.dragpos : currpos;
			tab.root.style.transform = `translateX(${tabPos}px)`;
			if (transition && tab.dragpos == -1 && tab.pos != tabPos) {
				tab.root.style.transition = `transform ${TAB_TRANSITION}`;
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

	const getMaxDragPos = () => {
		return getLayoutStart() + getRootWidth();
	};

	const calcDragPos = (e: MouseEvent, tab: VisualTab) => {
		const maxPos = getMaxDragPos() - tab.root.offsetWidth;

		const pos = e.clientX - tab.dragoffset - getAbsoluteStart();

		tab.dragpos = Math.min(Math.max(getLayoutStart(), pos), maxPos);
		layoutTabs(true);
	};

	window.addEventListener("mousemove", (e: MouseEvent) => {
		if (this.currentlydragging == -1) return;
		calcDragPos(
			e,
			this.visualtabs.find((tab) => tab.tab.id === this.currentlydragging)!
		);
	});

	window.addEventListener("mouseup", () => {
		if (this.currentlydragging == -1) return;
		const tab = this.visualtabs.find(
			(tab) => tab.tab.id === this.currentlydragging
		)!;
		const dragroot = tab.root.querySelector(".dragroot") as HTMLElement;

		dragroot.style.width = "";
		dragroot.style.position = "unset";
		tab.dragoffset = -1;
		tab.dragpos = -1;
		layoutTabs(true);
		this.currentlydragging = -1;
	});

	const mouseDown = (e: MouseEvent, tab: VisualTab) => {
		if (e.button != 0) return;
		this.currentlydragging = tab.tab.id;

		const rect = tab.root.getBoundingClientRect();
		tab.root.style.zIndex = "100";
		const dragroot = tab.root.querySelector(".dragroot") as HTMLElement;
		dragroot.style.width = rect.width + "px";
		dragroot.style.position = "absolute";
		tab.dragoffset = e.clientX - rect.left;
		tab.startdragpos = rect.left;

		if (tab.dragoffset < 0) throw new Error("dragoffset must be positive");

		calcDragPos(e, tab);

		if (this.activetab != tab.tab) {
			this.activetab = tab.tab;
		}
	};

	const transitionend = () => {
		transitioningTabs--;
		if (transitioningTabs == 0) {
			this.tabs = this.tabs;
		}

		this.afterEl.style.transition = "";
	};

	use(this.tabs).listen(() => {
		let newvisualtabs: VisualTab[] = [];

		for (let index = 0; index < this.tabs.length; index++) {
			let tab = this.tabs[index];

			let visualtab = this.visualtabs.find((t) => t.tab === tab);

			if (!visualtab) {
				let dt = (
					<DragTab
						id={tab.id}
						tab={tab}
						active={use(this.activetab).map((x) => x === tab)}
						mousedown={(e) => mouseDown(e, visualtab!)}
						destroy={() => {
							this.destroyTab(tab);
						}}
						transitionend={transitionend}
					/>
				);
				visualtab = {
					tab,
					root: dt,
					dragoffset: -1,
					dragpos: -1,
					startdragpos: -1,
					width: 0,
					pos: getLayoutStart() + index * (getTabWidth() + TAB_PADDING),
				};
			}

			newvisualtabs.push(visualtab);
		}

		for (let vtab of this.visualtabs) {
			if (!newvisualtabs.includes(vtab)) {
				let indexof = this.visualtabs.indexOf(vtab);
				newvisualtabs.splice(indexof, 0, vtab);
				let anim = vtab.root.animate(
					[
						{},
						{
							width: "0px",
						},
					],
					{
						duration: 100,
						fill: "forwards",
					}
				);
				anim.addEventListener(
					"finish",
					() => {
						this.visualtabs = this.visualtabs.filter((t) => t !== vtab);
						layoutTabs(false);
					},
					{ once: true }
				);
			}
		}

		this.visualtabs = newvisualtabs;
		setTimeout(() => layoutTabs(true), 10);
	});

	cx.mount = () => {
		requestAnimationFrame(() => layoutTabs(false));
		window.addEventListener("resize", () => layoutTabs(false));

		setContextMenu(cx.root, [
			{
				label: "New Tab",
				icon: iconNew,
				action: () => {
					this.addTab();
				},
			},
		]);

		this.tabs = this.tabs;
	};

	return (
		<div this={use(this.container)}>
			<div class="extra left" this={use(this.leftEl)}></div>
			{use(this.visualtabs).mapEach((tab) => tab.root)}
			<div
				class="extra after"
				this={use(this.afterEl)}
				on:contextmenu={(e: MouseEvent) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				<OmnibarButton icon={iconAdd} click={this.addTab}></OmnibarButton>
			</div>
			<div class="extra right" this={use(this.rightEl)}></div>
		</div>
	);
};
Tabs.style = css`
	:scope {
		background: var(--bg);
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

function updateAspectRatio() {
	const ratio = window.innerWidth / window.innerHeight;
	document.documentElement.style.setProperty("--viewport-ratio", String(ratio));
}

updateAspectRatio();
window.addEventListener("resize", updateAspectRatio);
