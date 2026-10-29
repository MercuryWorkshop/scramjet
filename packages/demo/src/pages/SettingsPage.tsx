import { css, type Component } from "dreamland/core";
import { controller, getTransport } from "..";
import {
	AVAILABLE_TRANSPORTS,
	type AvailableTransports,
	demoSettingsDefaults,
	demoSettingsStore,
	normalizeMaxRequests,
	normalizeTransport,
	normalizeWispUrl,
} from "../store";

const SettingsView: Component<
	{},
	{
		wispUrlInput: string;
		transportInput: AvailableTransports;
		maxRequestsInput: string;
		status: string;
		error: string;
	},
	{}
> = function () {
	this.wispUrlInput ??= demoSettingsStore.wispUrl;
	this.transportInput ??= demoSettingsStore.transport;
	this.maxRequestsInput ??= String(demoSettingsStore.maxRequests);
	this.status ??= "";
	this.error ??= "";

	const syncInputsFromStore = () => {
		this.wispUrlInput = demoSettingsStore.wispUrl;
		this.transportInput = demoSettingsStore.transport;
		this.maxRequestsInput = String(demoSettingsStore.maxRequests);
	};

	const applySettings = async () => {
		this.error = "";
		this.status = "Applying settings...";

		try {
			const nextWispUrl = normalizeWispUrl(this.wispUrlInput);
			const nextTransport = normalizeTransport(this.transportInput);
			const nextMaxRequests = normalizeMaxRequests(this.maxRequestsInput);
			const wispChanged = nextWispUrl !== demoSettingsStore.wispUrl;
			const transportChanged = nextTransport !== demoSettingsStore.transport;

			demoSettingsStore.wispUrl = nextWispUrl;
			demoSettingsStore.transport = nextTransport;
			demoSettingsStore.maxRequests = nextMaxRequests;

			this.wispUrlInput = nextWispUrl;
			this.transportInput = nextTransport;
			this.maxRequestsInput = String(nextMaxRequests);

			if (wispChanged || transportChanged) {
				controller.setTransport(getTransport());
			}
			this.status =
				wispChanged || transportChanged
					? "Settings saved. Transport updated for new requests."
					: "Settings saved.";
		} catch (error) {
			this.status = "";
			this.error =
				error instanceof Error ? error.message : "Failed to apply settings.";
		}
	};

	const resetDefaults = async () => {
		this.error = "";
		this.status = "Resetting settings...";
		this.wispUrlInput = demoSettingsDefaults.wispUrl;
		this.transportInput = demoSettingsDefaults.transport;
		this.maxRequestsInput = String(demoSettingsDefaults.maxRequests);
		await applySettings();
	};

	return (
		<div class="settings-panel">
			<div class="settings-header">
				<h2>Proxy settings</h2>
				<p>
					Adjust the connection and request capture. Transport changes apply
					to future requests.
				</p>
			</div>

			<label class="field">
				<span class="label">Wisp server</span>
				<input
					type="text"
					value={use(this.wispUrlInput)}
					spellcheck={false}
					on:input={(e: InputEvent) => {
						this.wispUrlInput = (e.target as HTMLInputElement).value;
					}}
				/>
				<span class="hint">Example: /wisp/ for the same-origin WebSocket proxy.</span>
			</label>

			<label class="field">
				<span class="label">Transport</span>
				<select
					value={use(this.transportInput)}
					on:change={(e: Event) => {
						this.transportInput = (e.target as HTMLSelectElement)
							.value as AvailableTransports;
					}}
				>
					{AVAILABLE_TRANSPORTS.map((option) => (
						<option value={option.value}>{option.label}</option>
					))}
				</select>
				<span class="hint">
					Transport client used to dispatch outbound requests over Wisp.
				</span>
			</label>

			<label class="field">
				<span class="label">Request log limit</span>
				<input
					type="number"
					min="10"
					max="5000"
					step="10"
					value={use(this.maxRequestsInput)}
					on:input={(e: InputEvent) => {
						this.maxRequestsInput = (e.target as HTMLInputElement).value;
					}}
				/>
				<span class="hint">
					Maximum number of captured requests kept in memory.
				</span>
			</label>

			<div class="actions">
				<button type="button" class="primary" on:click={applySettings}>
					Apply Settings
				</button>
				<button type="button" on:click={resetDefaults}>
					Reset Defaults
				</button>
				<button
					type="button"
					on:click={() => {
						syncInputsFromStore();
						this.error = "";
						this.status = "Inputs reverted to saved settings.";
					}}
				>
					Revert Inputs
				</button>
			</div>

			{use(this.error).map((error) =>
				error ? <div class="message error">{error}</div> : null
			)}
			{use(this.status).map((status) =>
				status ? <div class="message status">{status}</div> : null
			)}
		</div>
	);
};

SettingsView.style = css`
	:scope {
		display: block;
		flex: 1;
		min-width: 0;
		min-height: 0;
		padding: 16px;
		background: #0f0f0f;
		color: #e5e7eb;
		overflow: auto;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			sans-serif;
		box-sizing: border-box;
	}

	.settings-header {
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid #222;
	}

	.settings-header h2 {
		margin: 0 0 6px;
		font-size: 1rem;
		font-weight: 600;
	}

	.settings-header p {
		margin: 0;
		color: #a8a8a8;
		line-height: 1.45;
		font-size: 0.84rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
		max-width: 720px;
	}

	.label {
		font-size: 0.84rem;
		font-weight: 600;
		color: #e5e7eb;
	}

	input,
	select {
		width: 100%;
		padding: 0.55em 0.65em;
		border: 1px solid #2a2a2a;
		border-radius: 0;
		background: #111;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.88rem;
		outline: none;
		box-sizing: border-box;
	}

	input:focus,
	select:focus {
		border-color: #4a4a4a;
	}

	select {
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, #8f8f8f 50%),
			linear-gradient(135deg, #8f8f8f 50%, transparent 50%);
		background-position:
			calc(100% - 14px) 50%,
			calc(100% - 9px) 50%;
		background-size:
			5px 5px,
			5px 5px;
		background-repeat: no-repeat;
		padding-right: 28px;
		cursor: pointer;
	}

	.hint {
		color: #8f8f8f;
		font-size: 0.78rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
	}

	button {
		border: 1px solid #2a2a2a;
		border-radius: 0;
		background: #1a1a1a;
		color: #e5e7eb;
		padding: 0.45em 0.8em;
		cursor: pointer;
		font: inherit;
		font-size: 0.82rem;
		line-height: 1.2;
		min-height: 28px;
	}

	button:hover {
		background: #222;
	}

	button.primary {
		border-color: #4a4a4a;
		background: #1f1f1f;
	}

	button.primary:hover {
		background: #262626;
	}

	.message {
		margin-top: 12px;
		padding: 0.65em 0.8em;
		border: 1px solid #2a2a2a;
		background: #111;
		font-size: 0.82rem;
		max-width: 720px;
	}

	.message.error {
		border-color: #5a2a2a;
		color: #e7b0b0;
	}

	.message.status {
		color: #b8c2cc;
	}
`;
export default SettingsView;
