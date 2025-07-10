import iconClose from "@ktibow/iconset-material-symbols/close";
import {
	createState,
	type Component,
	type ComponentInstance,
	type Stateful,
} from "dreamland/core";
import { Icon } from "./ui/Icon";
import { IconButton } from "./Omnibox";

export const DragTab: Component<{
	active: boolean;
	id: number;
	icon: string;
	title: string;
	mousedown: (e: MouseEvent) => void;
	transitionend: () => void;
}> = function (cx) {
	return (
		<div
			style="z-index: 0;"
			class="tab"
			data-id={this.id}
			on:mousedown={(e) => this.mousedown(e)}
			on:transitionend={() => {
				console.log("tr end");
				cx.root.style.transition = "";
				cx.root.style.zIndex = "0";
				this.transitionend();
			}}
		>
			<div class="dragroot" style="position: unset;">
				<div class={use(this.active).map((x) => `main ${x ? "active" : ""}`)}>
					<img src={use(this.icon)} />
					<span>{use(this.title)}</span>
					<Icon class="close" icon={iconClose} />
				</div>
				{/* <div class="belowcontainer">
					{use(this.active).andThen(<div class="below"></div>)}
				</div> */}
			</div>
		</div>
	);
};
DragTab.css = `
	:scope {
		display: inline-block;
		user-select: none;
		position: absolute;

		--tab-active-border-width: 11px;
		--tab-active-border-radius: 10px;
		--tab-active-border-radius-neg: -10px;
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
	.main .close {
		width: 14px;
		height: 14px;
	}

	.main:not(.active):hover {
		transition: background 250ms;

		background: var(--aboutbrowser-hover-tab-bg);
		color: var(--aboutbrowser-hover-tab-fg);
	}

	.main.active {
		background: var(--aboutbrowser-active-tab-bg);
		color: var(--aboutbrowser-active-tab-fg);

		# border-radius: 12px 12px 0 0;
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
	.below::before, .below::after {
		content: '';
		position: absolute;
		bottom: 0;

		width: var(--tab-active-border-width);
		height: var(--tab-active-border-radius);

		background: var(--aboutbrowser-active-tab-bg);
	}
	.below::before {
		left: var(--tab-active-border-radius-neg);
		mask-image: radial-gradient(circle at 0 0, transparent var(--tab-active-border-radius), black 0);
	}
	.below::after {
		right: var(--tab-active-border-radius-neg);
		mask-image: radial-gradient(circle at var(--tab-active-border-width) 0, transparent var(--tab-active-border-radius), black 0);
	}
`;

let id = 0;
export class Tab {
	id: number;
	title: string;
	frame: ScramjetFrame;

	dragoffset: number;
	dragpos: number;

	width: number;
	pos: number;

	constructor(title: string, frame: ScramjetFrame) {
		return createState({
			id: id++,
			frame,
			title,
			dragoffset: -1,
			dragpos: -1,
			width: 0,
			pos: 0,
		});
	}
}
export const Tabs: Component<
	{
		tabs: Tab[];
		activetab: number;
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

	const mosueDown = (e: MouseEvent, tab: Tab) => {
		this.currentlydragging = tab.id;

		const root = getTabFromIndex(tab.id);
		const rect = root.getBoundingClientRect();
		root.style.zIndex = "100";
		const dragroot = root.querySelector(".dragroot") as HTMLElement;
		dragroot.style.width = rect.width + "px";
		dragroot.style.position = "absolute";
		tab.dragoffset = e.clientX - rect.left;

		if (tab.dragoffset < 0) throw new Error("dragoffset must be positive");

		calcDragPos(e, tab);
	};

	const transitionend = () => {
		transitioningTabs--;
		if (transitioningTabs == 0) {
			this.tabs = this.tabs;
		}
	};

	return (
		<div this={use(this.container).bind()}>
			<div class="extra left" this={use(this.leftEl).bind()}></div>
			{use(this.tabs).mapEach((tab) => (
				<DragTab
					id={tab.id}
					title={tab.title}
					icon="/vite.svg"
					active={use(this.activetab).map((x) => x === tab.id)}
					mousedown={(e) => mosueDown(e, tab)}
					transitionend={transitionend}
				/>
			))}
			<div class="extra after" this={use(this.afterEl).bind()}></div>
			<div class="extra right" this={use(this.rightEl).bind()}></div>
		</div>
	);
};
Tabs.css = `
	:scope {
	flex: 1;
		background: var(--aboutbrowser-frame-bg);
		padding: 6px 12px;
		height: calc(28px + 12px);

		position: relative;
	}

	.extra {
		position: absolute;
	}

	.left {
		left: 0;
	}
	.right {
		right: 0;
	}
`;
