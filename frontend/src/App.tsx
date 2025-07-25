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
				tabs={use(browser.tabs).bind()}
				activetab={use(browser.activetab).bind()}
				addTab={() => {
					browser.newTab();
				}}
				destroyTab={(tab: Tab) => {
					browser.destroyTab(tab);
				}}
			/>
			<Omnibox tab={use(browser.activetab).bind()} />
			{cx.children}
		</div>
	);
};
