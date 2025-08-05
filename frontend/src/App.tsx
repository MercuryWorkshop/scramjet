import type { Component } from "dreamland/core";
import { Omnibox } from "./components/Omnibox";
import { Tabs } from "./components/TabStrip";
import { ThemeVars } from "./theme";
import { config } from "./Browser";
import { browser } from "./main";
import type { Tab } from "./Tab";

export const App: Component = function (cx) {
	return (
		<div id="app">
			<ThemeVars colors={use(config.theme)} />
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
			{cx.children}
		</div>
	);
};
