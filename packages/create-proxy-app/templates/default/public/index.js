const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const frameWrapper = document.getElementById("sj-frame-wrapper");
const frameElement = document.getElementById("sj-frame");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");

let controller;
let frame;
async function init() {
	controller = await initBootstrap();
	frame = controller.createFrame(frameElement);
	installPlugins(frame);
}

function installPlugins(frame) {
	const errorPlugin = new $scramjet.Plugin("error-handler");
	errorPlugin.tap(frame.hooks.error.request, (context, props) => {
		props.suppressError = false;
		console.error(context.error);
		showErrorScreen(
			`Scramjet couldn't load ${context.rawrequest.rawUrl}`,
			context?.error?.message || context?.error?.toString() || "Unknown error"
		);
	});
}

function showErrorScreen(error, details) {
	frameWrapper.style.display = "none";
	error.textContent = error;
	errorCode.textContent = details;
}

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	try {
		if (!frame || !controller) {
			await init();
		}
		await frame.go(address.value);
		frameWrapper.style.display = "flex";
	} catch (error) {
		showErrorScreen(error.message, error.stack);
	}
});
