import { css, type Component } from "dreamland/core";
const LoadInterstitial: Component<{
	status: string;
}> = function () {
	return (
		<dialog class="signin">
			<h1>Loading</h1>
			<p>{use(this.status)}</p>
		</dialog>
	);
};

LoadInterstitial.style = css`
	:scope {
		transition: opacity 0.4s ease;
		width: 50%;
		height: 20%;
		border: none;
		border-radius: 1em;
		text-align: center;
	}
	h1 {
		text-align: center;
		font-weight: bold;
		font-size: 2em;
	}
	:modal[open] {
		animation: fade 0.4s ease normal;
	}

	:modal::backdrop {
		backdrop-filter: blur(3px);
	}
`;

export default LoadInterstitial;
