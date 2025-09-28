import type { Component } from "dreamland/core";
import { Omnibox } from "./components/Omnibox";
import { Tabs } from "./components/TabStrip";
import { browser } from "./Browser";
import type { Tab } from "./Tab";
import { BookmarksStrip } from "./components/BookmarksStrip";

export const App: Component = function (cx) {
	const applyTheme = () => {
		let theme = browser.settings.theme;

		if (theme === "system") {
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)"
			).matches;
			document.body.classList.toggle("light-mode", !prefersDark);
		} else {
			document.body.classList.toggle("light-mode", theme === "light");
		}
	};

	applyTheme();

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handleThemeChange = () => {
		if (browser.settings.theme === "system") {
			applyTheme();
		}
	};

	mediaQuery.addEventListener("change", handleThemeChange);

	use(browser.settings.theme).listen(applyTheme);

	return (
		<div id="app">
			<Tabs
				tabs={use(browser.tabs)}
				activetab={use(browser.activetab)}
				addTab={() => {
					browser.newTab(new URL("puter://newtab"), true);
				}}
				destroyTab={(tab: Tab) => {
					browser.destroyTab(tab);
				}}
			/>
			<Omnibox tab={use(browser.activetab)} />
			{use(browser.activetab.url, browser.settings.bookmarksPinned)
				.map(([u, pinned]) => pinned || u.href === "puter://newtab")
				.andThen(<BookmarksStrip />)}
			{cx.children}
		</div>
	);
};
