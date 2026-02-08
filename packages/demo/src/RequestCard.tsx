import { css, type Component } from "dreamland/core";
import type { RequestEntry } from "./RequestViewer";

export const RequestCard: Component<
	{
		request: RequestEntry;
		selected: boolean;
		onSelect?: (id: string) => void;
	},
	{},
	{}
> = function () {
	return (
		<div
			class={use(this.selected).map(
				(selected) => `request-row ${selected ? "selected" : ""}`
			)}
			data-status={this.request.status ?? ""}
			on:click={() => this.onSelect?.(this.request.id)}
		>
			<div class="request-main">
				<span class="request-method">{this.request.method}</span>
				<span
					class={
						this.request.status !== undefined
							? `request-status status-${Math.floor(this.request.status / 100)}`
							: "request-status"
					}
				>
					{this.request.status ?? "…"}
				</span>
				<span class="request-duration">
					{this.request.durationMs !== undefined
						? `${this.request.durationMs}ms`
						: "…"}
				</span>
				<span class="request-destination">
					{this.request.destination ?? "unknown"}
				</span>
				<span class="request-time">{this.request.time}</span>
			</div>
			<div class="request-url" title={this.request.url}>
				{this.request.url}
			</div>
			{this.request.contentType ? (
				<div class="request-type">{this.request.contentType}</div>
			) : null}
		</div>
	);
};

RequestCard.style = css`
	.request-row {
		display: flex;
		flex-direction: column;
		gap: 0.35em;
		padding: 0.65em 0.75em;
		border: 1px solid #262626;
		border-radius: 8px;
		background: linear-gradient(135deg, #141414 0%, #101010 100%);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease,
			background 0.15s ease;
	}
	.request-row:hover {
		border-color: #3a3a3a;
		background: linear-gradient(135deg, #181818 0%, #121212 100%);
		transform: translateY(-1px);
	}
	.request-row.selected {
		border-color: #60a5fa;
		box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.5);
		background: linear-gradient(135deg, #1a1f2b 0%, #12161f 100%);
	}
	.request-main {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5em;
		font-size: 0.8em;
	}
	.request-method {
		font-weight: 600;
		color: #fff;
		padding: 0.15em 0.5em;
		border-radius: 6px;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.35);
		letter-spacing: 0.02em;
	}
	.request-status {
		padding: 0.15em 0.45em;
		border-radius: 6px;
		background: rgba(148, 163, 184, 0.15);
		border: 1px solid rgba(148, 163, 184, 0.35);
		color: #e2e8f0;
		min-width: 2.5em;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.request-status.status-2 {
		background: rgba(34, 197, 94, 0.15);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #bbf7d0;
	}
	.request-status.status-3 {
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: #bae6fd;
	}
	.request-status.status-4 {
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(251, 191, 36, 0.35);
		color: #fde68a;
	}
	.request-status.status-5 {
		background: rgba(248, 113, 113, 0.18);
		border: 1px solid rgba(248, 113, 113, 0.4);
		color: #fecaca;
	}
	.request-duration,
	.request-destination,
	.request-time {
		color: #9ca3af;
	}
	.request-url {
		font-size: 0.85em;
		color: #e5e7eb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.request-type {
		font-size: 0.75em;
		color: #93c5fd;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		padding: 0.1em 0.4em;
		border-radius: 999px;
		width: fit-content;
	}
`;
