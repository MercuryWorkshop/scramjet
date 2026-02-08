import { css, type Component } from "dreamland/core";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.main.js";

if (!(globalThis as any).MonacoEnvironment) {
	(globalThis as any).MonacoEnvironment = {
		getWorkerUrl() {
			return "data:application/javascript,";
		},
	};
}

type MonacoProps = {
	value: string;
	language?: string;
	readOnly?: boolean;
	minHeight?: number;
};

export const MonacoComponent: Component<MonacoProps, {}, { instance?: any }> =
	function (cx) {
		cx.mount = () => {
			this.instance = monaco.editor.create(cx.root, {
				value: this.value ?? "",
				language: this.language ?? "plaintext",
				readOnly: this.readOnly ?? true,
				automaticLayout: true,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				lineNumbers: "on",
				renderLineHighlight: "none",
				theme: "vs-dark",
			});

			use(this.value).listen((next) => {
				if (!this.instance) return;
				const current = this.instance.getValue();
				if (current !== next) {
					this.instance.setValue(next ?? "");
				}
			});

			use(this.language).listen((next) => {
				if (!this.instance || !this.instance.getModel()) return;
				monaco.editor.setModelLanguage(
					this.instance.getModel(),
					next ?? "plaintext"
				);
			});
		};

		return (
			<div
				class="monaco-host"
				style={`min-height: ${this.minHeight ?? 260}px; height: ${this.minHeight ?? 260}px;`}
			/>
		);
	};

MonacoComponent.style = css`
	:scope {
		width: 100%;
		min-height: 200px;
		height: auto;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #1f2937;
		background: #0b0f15;
	}
	.monaco-host {
		width: 100%;
		min-height: 200px;
		height: 100%;
	}
`;
