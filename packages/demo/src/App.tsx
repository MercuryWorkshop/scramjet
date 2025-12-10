import { controller } from ".";
import { createStore, css, type Component } from "dreamland/core";

const store = createStore(
	{
		url: "https://google.com",
	},
	{
		ident: "store",
		backing: "localstorage",
		autosave: "auto",
	}
);

export const App: Component<
	{},
	{},
	{
		url: string;
		frame: controller.Frame;
		frameel: HTMLIFrameElement;
	}
> = function (cx) {
	cx.mount = () => {
		this.frame = controller.createFrame(this.frameel);
		let body = btoa(
			`<body style="background: #000; color: #fff">Welcome to <i>Scramjet</i>! Type in a URL in the omnibox above and press enter to get started.</body>`
		);
		this.frame.go(`data:text/html;base64,${body}`);
	};
	return (
		<div>
			<form
				on:submit={(e: SubmitEvent) => {
					e.preventDefault();
					this.frame.go(store.url);
				}}
			>
				<input
					id="search"
					type="text"
					value={use(store.url)}
					placeholder="Enter URL"
				/>
			</form>
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
