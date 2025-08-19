import type { Component } from "dreamland/core";
import { Omnibox } from "./components/Omnibox";
import { Tabs } from "./components/TabStrip";
import { browser } from "./Browser";
import type { Tab } from "./Tab";
import { BookmarksStrip } from "./components/BookmarksStrip";

export const App: Component = function (cx) {
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
