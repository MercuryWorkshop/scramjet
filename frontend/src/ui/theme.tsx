import type { Component } from "dreamland/core";

type Range<T extends number> = number extends T ? number : _Range<T, []>;
type _Range<T extends number, R extends unknown[]> = R["length"] extends T
	? R[number]
	: _Range<T, [R["length"], ...R]>;

export type ColorComponent = Range<256>;
export type Color = [ColorComponent, ColorComponent, ColorComponent];

export interface Theme {
	frame_bg: Color;
	toolbar_bg: Color;
	toolbar_button_fg: Color;
	toolbar_fg: Color;

	inactive_tab_bg: Color;
	inactive_tab_fg: Color;
	active_tab_fg: Color;

	button_bg: Color;

	ntp_bg: Color;
	ntp_fg: Color;
	ntp_link_fg: Color;

	omnibox_bg: Color;
	omnibox_fg: Color;

	bookmark_fg: Color;
}

type CalculatedColor =
	| { calc: "mix"; a: keyof Theme; b: keyof Theme; percent: Range<101> }
	| { calc: "alias"; name: keyof Theme };
const CALCULATED_COLORS: Record<string, CalculatedColor> = {
	active_tab_bg: { calc: "alias", name: "toolbar_bg" },
	hover_tab_bg: { calc: "mix", a: "frame_bg", b: "toolbar_bg", percent: 50 },
	hover_tab_fg: { calc: "alias", name: "active_tab_fg" },
};

export const ThemeVars: Component<{ colors: Theme }> = function (cx) {
	const cssName = (x: string) => x.replace(/_/g, "-");

	cx.mount = () => {
		const root = cx.root as HTMLStyleElement;

		let update = (x: Theme) => {
			let style = ":root {\n";

			for (const [k, v] of Object.entries(x)) {
				style += `\t--aboutbrowser-${cssName(k)}: rgb(${v[0]}, ${v[1]}, ${v[2]});\n`;
			}

			style += "\n";

			for (const [k, v] of Object.entries(CALCULATED_COLORS)) {
				let calculated;

				if (v.calc == "mix") {
					calculated = `color-mix(in srgb, var(--aboutbrowser-${cssName(v.a)}), var(--aboutbrowser-${cssName(v.b)}) ${v.percent}%)`;
				} else if (v.calc == "alias") {
					calculated = `var(--aboutbrowser-${cssName(v.name)})`;
				}

				style += `\t--aboutbrowser-${cssName(k)}: ${calculated};\n`;
			}

			style += "}";

			root.innerHTML = style;
		};

		use(this.colors).listen(update);
		update(this.colors);
	};

	return <style></style>;
};
