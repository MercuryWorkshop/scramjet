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
			data-request-id={this.request.id}
			data-status={this.request.status ?? ""}
			on:pointerdown={(e: PointerEvent) => {
				if (e.button !== 0) return;
				this.onSelect?.(this.request.id);
			}}
		>
			<div class="request-primary">
				<span class="request-method">{this.request.method}</span>
				<div class="request-url" title={this.request.url}>
					{this.request.url}
				</div>
			</div>
			<div class="request-main">
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
				{this.request.contentType ? (
					<span class="request-type">{this.request.contentType}</span>
				) : null}
			</div>
		</div>
	);
};

RequestCard.style = css`
	.request-row {
		display: grid;
		gap: 0.18em;
		padding: 0.38em 0.5em;
		border: 1px solid #262626;
		border-radius: 6px;
		background: #101010;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			background 0.15s ease;
	}
	.request-row:hover {
		border-color: #3a3a3a;
		background: #141414;
	}
	.request-row.selected {
		border-color: #60a5fa;
		box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.5);
		background: #141a22;
	}
	.request-primary {
		display: flex;
		align-items: center;
		gap: 0.4em;
		min-width: 0;
	}
	.request-main {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35em 0.45em;
		font-size: 0.72em;
		line-height: 1.15;
	}
	.request-method {
		font-weight: 600;
		color: #fff;
		padding: 0.08em 0.36em;
		border-radius: 4px;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.35);
		letter-spacing: 0.02em;
		flex: 0 0 auto;
	}
	.request-status {
		padding: 0.08em 0.35em;
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.15);
		border: 1px solid rgba(148, 163, 184, 0.35);
		color: #e2e8f0;
		min-width: 2.2em;
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
		font-variant-numeric: tabular-nums;
	}
	.request-url {
		font-size: 0.76em;
		line-height: 1.15;
		color: #e5e7eb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1 1 auto;
	}
	.request-type {
		font-size: 1em;
		line-height: 1;
		color: #93c5fd;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		padding: 0.08em 0.3em;
		border-radius: 999px;
	}
`;
