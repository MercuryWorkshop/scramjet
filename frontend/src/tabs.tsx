import iconClose from "@ktibow/iconset-material-symbols/close";
import iconAdd from "@ktibow/iconset-material-symbols/add";
import type { Component, ComponentInstance } from "dreamland/core";
import { Icon } from "./ui/Icon";

type TabCallbacks = {
	relayout: () => void;
	getMaxDragPos: () => number;
	getLayoutStart: () => number;
	getAbsoluteStart: () => number;

	"on:transitionend": () => void;
	"on:setactive": (id: Symbol) => void;
};

export const Tab: Component<
	{
		active: boolean;
		icon: string;
		title: string;

		funcs: TabCallbacks;
	},
	{
		dragroot: HTMLElement;
		dragoffset: number;
	},
	{
		id: Symbol;

		dragpos: number;

		width: number;
		pos: number;
	}
> = function (cx) {
	cx.css = `
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

			border-radius: 10px;
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

			border-radius: 12px 12px 0 0;
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

	this.dragpos = -1;
	this.dragoffset = -1;
	this.width = 0;
	this.pos = 0;

	this.id = Symbol();

	const calcDragPos = (e: MouseEvent) => {
		const maxPos = this.funcs.getMaxDragPos() - cx.root.offsetWidth;

		const pos = e.clientX - this.dragoffset - this.funcs.getAbsoluteStart();

		this.dragpos = Math.min(Math.max(this.funcs.getLayoutStart(), pos), maxPos);
		this.funcs.relayout();
	};

	cx.mount = () => {
		const root = cx.root;

		root.addEventListener("mousedown", (e: MouseEvent) => {
			this.active = true;
			this.funcs["on:setactive"](this.id);

			const rect = root.getBoundingClientRect();
			root.style.zIndex = "100";
			this.dragroot.style.width = rect.width + "px";
			this.dragroot.style.position = "absolute";
			this.dragoffset = e.clientX - rect.left;

			if (this.dragoffset < 0) throw new Error("dragoffset must be positive");

			calcDragPos(e);
		});
		root.addEventListener("transitionend", () => {
			root.style.transition = "";
			root.style.zIndex = "0";
			this.funcs["on:transitionend"]();
		});

		window.addEventListener("mousemove", (e: MouseEvent) => {
			if (this.dragoffset == -1) return;
			calcDragPos(e);
		});

		window.addEventListener("mouseup", (_e) => {
			if (this.dragoffset == -1) return;

			this.dragroot.style.width = "";
			this.dragroot.style.position = "unset";

			this.dragoffset = -1;
			this.dragpos = -1;
			this.funcs.relayout();
		});
	};

	return (
		<div style="z-index: 0;">
			<div this={use(this.dragroot).bind()} style="position: unset;">
				<div class={use(this.active).map((x) => `main ${x ? "active" : ""}`)}>
					<img src={use(this.icon)} />
					<span>{use(this.title)}</span>
					<Icon class="close" icon={iconClose} />
				</div>
				<div class="belowcontainer">
					{use(this.active).andThen(<div class="below"></div>)}
				</div>
			</div>
		</div>
	);
};

export const Tabs: Component<
	{},
	{
		container: HTMLElement;
		leftEl: HTMLElement;
		rightEl: HTMLElement;
		afterEl: HTMLElement;

		tabs: ComponentInstance<typeof Tab>[];
	},
	{}
> = function (cx) {
	cx.css = `
		:scope {
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
		this.tabs.sort((aComponent, bComponent) => {
			let a = aComponent.$.state;
			let b = bComponent.$.state;

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
		for (const component of this.tabs) {
			let tab = component.$.state;
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
	const tabfuncs: TabCallbacks = {
		relayout() {
			layoutTabs(true);
		},
		getMaxDragPos() {
			return getLayoutStart() + getRootWidth();
		},
		getAbsoluteStart() {
			return getAbsoluteStart();
		},
		getLayoutStart() {
			return getLayoutStart();
		},

		"on:transitionend": () => {
			transitioningTabs--;
			if (transitioningTabs == 0) {
				this.tabs = this.tabs;
			}
		},
		"on:setactive": (id: Symbol) => {
			for (const tab of this.tabs) {
				if (tab.$.state.id != id) tab.$.state.active = false;
			}
			// TODO on:active
		},
	};

	this.tabs = [
		(
			<Tab
				active={true}
				icon="/vite.svg"
				title="ViteViteViteViteViteVite  Vite Vite Vite"
				funcs={tabfuncs}
			/>
		) as ComponentInstance<typeof Tab>,
	];

	cx.mount = () => {
		requestAnimationFrame(() => layoutTabs(false));
		window.addEventListener("resize", () => layoutTabs(false));
	};

	return (
		<div this={use(this.container).bind()}>
			<div class="extra left" this={use(this.leftEl).bind()}></div>
			{use(this.tabs)}
			<div class="extra after" this={use(this.afterEl).bind()}></div>
			<div class="extra right" this={use(this.rightEl).bind()}></div>
		</div>
	);
};
