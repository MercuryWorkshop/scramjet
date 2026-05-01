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
	fill?: boolean;
	onChange?: (value: string) => void;
	onSave?: () => void;
};

const Monaco: Component<MonacoProps, {}, { instance?: any }> = function (cx) {
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

		this.instance.onDidChangeModelContent(() => {
			this.onChange?.(this.instance.getValue());
		});

		this.instance.addCommand(
			monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
			() => {
				this.onSave?.();
			}
		);

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

		use(this.readOnly).listen((next) => {
			if (!this.instance) return;
			this.instance.updateOptions({ readOnly: next ?? true });
		});
	};

	return (
		<div
			class={`monaco-host ${this.fill ? "fill" : ""}`}
			style={
				this.fill
					? "min-height: 0; height: 100%;"
					: `min-height: ${this.minHeight ?? 260}px; height: ${this.minHeight ?? 260}px;`
			}
		/>
	);
};

Monaco.style = css`
	:scope {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		min-height: 200px;
		height: auto;
		flex: 0 0 auto;
		border-radius: 0;
		overflow: hidden;
		border: 0;
		background: #111;
	}
	:scope.fill {
		flex: 1;
		height: 100%;
		min-height: 0;
	}
	.monaco-host {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		min-height: 200px;
		height: 100%;
	}
	.monaco-host.fill {
		min-height: 0;
	}
`;
export default Monaco;
