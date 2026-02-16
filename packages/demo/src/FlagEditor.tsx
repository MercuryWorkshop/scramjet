import { createStore, css, type Component } from "dreamland/core";
import type { ScramjetFlags } from "@mercuryworkshop/scramjet";
import { defaultConfig } from "@mercuryworkshop/scramjet";

const flagStore = createStore<ScramjetFlags>(
	{
		...defaultConfig.flags,
		allowFailedIntercepts: true,
	},
	{
		ident: "scramjet-flags",
		backing: "localstorage",
		autosave: "auto",
	}
);

// Flag descriptions for better UX
const flagDescriptions: Record<keyof ScramjetFlags, string> = {
	syncxhr: "Enable synchronous XMLHttpRequest support",
	strictRewrites: "Use strict URL rewriting rules",
	rewriterLogs: "Enable rewriter logging (debug mode)",
	captureErrors: "Capture and handle JavaScript errors",
	cleanErrors: "Clean error messages for better readability",
	scramitize: "Apply scramitization transformations",
	sourcemaps: "Enable source map support",
	destructureRewrites: "Use destructuring in URL rewrites",
	allowInvalidJs: "Allow invalid JavaScript to pass through",
	allowFailedIntercepts: "Allow failed request intercepts",
	debugTrampolines: "Enable debug trampolines (debug mode)",
	encapsulateWorkers: "Encapsulate web workers",
};

export const FlagEditor: Component<
	{
		onFlagsChange?: (flags: ScramjetFlags) => void;
		inline?: boolean;
	},
	{},
	{
		isOpen: boolean;
	}
> = function (cx) {
	this.isOpen = false;

	const toggleFlag = (flag: keyof ScramjetFlags, value: boolean) => {
		flagStore[flag] = value;
		if (this.onFlagsChange) {
			this.onFlagsChange(flagStore);
		}
	};

	const resetToDefaults = () => {
		Object.assign(flagStore, {
			...defaultConfig.flags,
			allowFailedIntercepts: true,
		});
		if (this.onFlagsChange) {
			this.onFlagsChange(flagStore);
		}
	};

	return (
		<div
			class={use(this.inline).map(
				(inline) => `flag-editor ${inline ? "inline" : ""}`
			)}
		>
			<button
				class="toggle-button"
				on:click={() => {
					this.isOpen = !this.isOpen;
				}}
			>
				{use(this.isOpen).map((open) => (open ? "▼" : "▶"))} Flag Editor
			</button>
			{use(this.isOpen).andThen(
				<div class="editor-panel">
					<div class="header">
						<h3>Scramjet Feature Flags</h3>
						<button class="reset-button" on:click={resetToDefaults}>
							Reset to Defaults
						</button>
					</div>
					<div class="flags-list">
						{(Object.keys(flagStore) as Array<keyof ScramjetFlags>).map(
							(flag) => (
								<label class="flag-item">
									<input
										type="checkbox"
										checked={use(flagStore[flag])}
										on:change={() => toggleFlag(flag, event.target.checked)}
									/>
									<div class="flag-info">
										<span class="flag-name">{flag}</span>
										<span class="flag-desc">{flagDescriptions[flag]}</span>
									</div>
								</label>
							)
						)}
					</div>
				</div>
			)}
		</div>
	);
};

FlagEditor.style = css`
	:scope {
		position: fixed;
		top: 1em;
		right: 1em;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid #444;
		border-radius: 8px;
		color: white;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		font-size: 14px;
		max-width: 400px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	:scope.inline {
		position: relative;
		background: transparent;
		border: none;
		box-shadow: none;
		max-width: none;
	}

	.toggle-button {
		width: 100%;
		padding: 0.75em 1em;
		background: #333;
		border: none;
		border-radius: 8px 8px 0 0;
		color: white;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		text-align: left;
		transition: background 0.2s;
	}

	:scope.inline .toggle-button {
		padding: 0.35em 0.7em;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		font-size: 0.8em;
		line-height: 1;
	}

	:scope.inline .toggle-button:hover {
		background: #222;
	}

	.toggle-button:hover {
		background: #444;
	}

	.editor-panel {
		padding: 1em;
		border-top: 1px solid #444;
		max-height: 60vh;
		overflow-y: auto;
	}

	:scope.inline .editor-panel {
		position: absolute;
		top: calc(100% + 0.35em);
		right: 0;
		min-width: 320px;
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid #444;
		border-radius: 8px;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
		z-index: 1000;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1em;
	}

	.header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.reset-button {
		padding: 0.4em 0.8em;
		background: #555;
		border: 1px solid #666;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}

	.reset-button:hover {
		background: #666;
	}

	.flags-list {
		display: flex;
		flex-direction: column;
		gap: 0.75em;
	}

	.flag-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75em;
		cursor: pointer;
		padding: 0.5em;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.flag-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.flag-item input[type="checkbox"] {
		margin-top: 0.2em;
		cursor: pointer;
		flex-shrink: 0;
	}

	.flag-info {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		flex: 1;
	}

	.flag-name {
		font-weight: 500;
		color: #fff;
		font-family: "Courier New", monospace;
		font-size: 13px;
	}

	.flag-desc {
		font-size: 12px;
		color: #aaa;
		line-height: 1.4;
	}
`;

export { flagStore };
