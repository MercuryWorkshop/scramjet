import { controller } from ".";
import { css, type Component } from "dreamland/core";

export const App: Component<{ frameel: HTMLIFrameElement }> = function (cx) {
	let frame;
	cx.mount = () => {
		frame = controller.createFrame(this.frameel);

		frame.go("https://google.com");
	};

	return (
		<div>
			<input
				on:change={(e) => {
					let url = (e.target as HTMLInputElement).value;
					frame.go(url);
				}}
				placeholder="Enter URL"
			/>
			<iframe this={use(this.frameel)}></iframe>
		</div>
	);
};

App.style = css`
	:scope {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		margin: 0;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;

		padding: 1em;
		background: black;
		box-sizing: border-box;
	}
	iframe {
		background: white;
		flex: 1;
		border: none;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.5em;
		margin-bottom: 0.5em;
		font-size: 1em;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
`;
