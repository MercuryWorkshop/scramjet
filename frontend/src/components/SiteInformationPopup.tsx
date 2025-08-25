import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { splitUrl } from "../utils";

import iconClose from "@ktibow/iconset-ion/close";
import { Icon } from "./Icon";
import { SmallIconButton } from "./SmallIconButton";

import iconTrash from "@ktibow/iconset-ion/trash-outline";
import iconSettings from "@ktibow/iconset-ion/settings-outline";
import { closeMenu } from "./Menu";

export const SiteInformationPopup: Component<{
	tab: Tab;
}> = function (cx) {
	return (
		<div>
			<div class="header">
				<span>
					{use(this.tab.url).map((u) => splitUrl(u)[0] + splitUrl(u)[1])}
				</span>
				<div class="buttoniconscontainer">
					<SmallIconButton
						click={() => {
							closeMenu();
						}}
						icon={iconClose}
					></SmallIconButton>
				</div>
			</div>
			<div class="content">
				<p>
					Connection is protected by SSL for this site and forwarded over WISP
				</p>
			</div>
			<div class="footer">
				<div class="entry">
					<Icon icon={iconTrash}></Icon>
					<span>Clear Site Data</span>
				</div>
				<div class="entry">
					<Icon icon={iconSettings}></Icon>
					<span>Site Settings</span>
				</div>
			</div>
		</div>
	);
};
SiteInformationPopup.style = css`
	:scope {
		display: flex;
		flex-direction: column;
		gap: 1em;
		width: 20em;
	}

	.buttoniconscontainer {
		flex: 1;
		display: flex;
		align-items: top;
		justify-content: end;
	}

	.content {
		padding-left: 1em;
	}

	.header {
		padding: 1em;
		display: flex;
		border-bottom: 1px solid var(--fg4);
	}
	.header span {
		font-size: 1.15em;
	}

	.footer {
		border-top: 1px solid var(--fg4);
		display: flex;
		flex-direction: column;
	}

	.entry {
		padding: 1em;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 1em;
	}
	.entry:hover {
		background: var(--bg20);
	}
`;
