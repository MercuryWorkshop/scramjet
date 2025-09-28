import type { IconifyIcon } from "@iconify/types";
import type { Component } from "dreamland/core";

export const Icon: Component<
	{
		icon: IconifyIcon;
		width?: string | undefined;
		height?: string | undefined;
		class?: string | undefined;
	},
	{}
> = function (cx) {
	cx.mount = () => {
		const update = (icon: IconifyIcon) => {
			cx.root.innerHTML = icon.body;
		};
		use(this.icon).listen(update);
		update(this.icon);
	};

	return (
		<svg
			width={use(this.width).map((x) => x || "1em")}
			height={use(this.height).map((x) => x || "1em")}
			viewBox={use`0 0 ${this.icon.width} ${this.icon.height}`}
			xmlns="http://www.w3.org/2000/svg"
			{...(this.class ? { class: this.class } : {})}
		></svg>
	);
};
