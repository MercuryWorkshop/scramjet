import { controller } from ".";

export function App(cx) {
	cx.mount = () => {
		let frame = controller.createFrame(this.frameel);

		frame.go("https://google.com");
	};

	return (
		<div>
			scramjet
			<iframe this={use(this.frameel)}></iframe>
		</div>
	);
}
