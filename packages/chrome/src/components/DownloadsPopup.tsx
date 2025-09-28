import { css, type Component } from "dreamland/core";
import { browser } from "../Browser";
import { Icon } from "./Icon";
import { closeMenu, createMenuCustom } from "./Menu";
import iconClose from "@ktibow/iconset-ion/close";
import iconFolder from "@ktibow/iconset-ion/folder-outline";
import iconOpen from "@ktibow/iconset-ion/open-outline";
import iconPause from "@ktibow/iconset-ion/pause-outline";
import { formatBytes } from "../utils";

export const DownloadsPopup: Component<{}> = function (cx) {
	return (
		<div>
			<div class="title">
				<span>Recent Downloads</span>
				<div class="buttoniconcontainer">
					<button
						on:click={() => {
							closeMenu();
						}}
					>
						<Icon icon={iconClose}></Icon>
					</button>
				</div>
			</div>
			<div class="entries">
				{use(browser.sessionDownloadHistory).mapEach((b) => (
					<div class="entry">
						<div class="iconcontainer">
							<img src="/defaultfavicon.png"></img>
						</div>
						<div class="contents">
							<span>{b.filename}</span>
							{use(b.progressbytes).andThen(
								<span class="data">
									{use(b.progressbytes).map((s) => formatBytes(s!))}/
									{formatBytes(b.size)}
								</span>
							)}
							{use(b.progressbytes)
								.map((b) => !b)
								.andThen(<span class="data">{formatBytes(b.size)}</span>)}
						</div>
						<div class="buttoniconcontainer">
							{use(b.progress)
								.map((b) => !b)
								.andThen(
									<>
										<button>
											<Icon icon={iconFolder}></Icon>
										</button>
										<button>
											<Icon icon={iconOpen}></Icon>
										</button>
									</>
								)}
							{use(b.progress).andThen(
								<>
									<button
										on:click={() => {
											b.pause!();
										}}
									>
										<Icon icon={iconPause}></Icon>
									</button>
									<button
										on:click={() => {
											b.cancel!();
										}}
									>
										<Icon icon={iconClose}></Icon>
									</button>
								</>
							)}
						</div>
						{use(b.progress).andThen(
							<progress value={use(b.progress).map((p) => p || 0)} max="1">
								50%
							</progress>
						)}
					</div>
				))}
			</div>
			<div
				class="footer"
				on:click={() => {
					browser.newTab(new URL("puter://downloads"));
					closeMenu();
				}}
			>
				<span>Full Download History</span>
				<div class="buttoniconcontainer">
					<Icon icon={iconOpen}></Icon>
				</div>
			</div>
		</div>
	);
};
DownloadsPopup.style = css`
	:scope {
		width: 20em;
		display: flex;
		flex-direction: column;
		user-select: none;
	}

	.title {
		padding: 1em;
		display: flex;
		border-bottom: 1px solid var(--fg4);
	}
	.title p {
		font-size: 1.25em;
	}
	.title button {
		display: flex;
		align-items: center;
		font-size: 1em;
		position: relative;
	}
	.title button:hover::before {
		content: "";
		z-index: -1;
		position: absolute;
		width: 150%;
		height: 150%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg20);
		border-radius: 50%;
	}

	.entries {
		max-height: 30em;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.entry {
		padding: 1em;
		display: flex;
		gap: 1em;
		font-size: 0.9em;
		position: relative;
	}
	.entry:hover {
		background: var(--bg20);
	}
	.contents {
		display: flex;
		overflow: hidden;
		flex-direction: column;
		gap: 0.5em;
	}
	.entry .buttoniconcontainer {
		display: none;
	}
	.entry:hover .buttoniconcontainer {
		display: flex;
	}
	.entry .buttoniconcontainer {
		position: absolute;
		right: 0;
		top: 0;
		padding: 1em;
		background: var(--bg20);
		height: 100%;
		align-items: start;
		gap: 1em;
	}
	.entry .buttoniconcontainer button {
		font-size: 1.15em;
		position: relative;
		z-index: 1;
		display: flex;
	}
	.entry .buttoniconcontainer button:hover::before {
		content: "";
		z-index: -1;
		position: absolute;
		width: 150%;
		height: 150%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--fg4);
		border-radius: 50%;
	}

	.contents .data {
		color: var(--fg2);
	}
	.footer {
		border-top: 1px solid var(--fg4);
		padding: 1em;
		cursor: pointer;
		display: flex;
		align-items: center;
	}
	.footer:hover {
		background: var(--bg20);
	}

	.buttoniconcontainer {
		flex: 1;
		display: flex;
		justify-content: right;
	}

	progress {
		z-index: 1;
		position: absolute;
		bottom: -0.25em;
		left: 2em;
		margin: 0.5em;
		width: calc(100% - 4em);
		height: 0.25em;
		border: none;
	}
	progress::-webkit-progress-bar {
		background-color: var(--fg4);
		border-radius: var(--radius);
	}
	progress::-webkit-progress-value {
		background-color: var(--accent);
		border-radius: var(--radius);
	}
`;
