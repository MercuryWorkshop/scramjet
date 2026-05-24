const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const frameWrapper = document.getElementById("sj-frame-wrapper");
const frameElement = document.getElementById("sj-frame");
const frameUrl = document.getElementById("sj-frame-url");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");

let controller;
let frame;
async function init() {
	controller = await initBootstrap();

	const cachePlugin = new $scramjetUtils.HttpCachePlugin();
	const urlWatcher = new $scramjetUtils.UrlWatcherPlugin((url) => {
		frameUrl.textContent = url;
	});
	const catchEscapedLinks = new $scramjetUtils.CatchEscapedLinksPlugin(
		(url) => new URL(`/?goto=${encodeURIComponent(url.href)}`, location.origin)
	);

	frame = controller.createFrame(frameElement, {
		plugins: [cachePlugin, urlWatcher, catchEscapedLinks],
	});
}

function showErrorScreen(error, details) {
	frameWrapper.style.display = "none";
	error.textContent = error;
	errorCode.textContent = details;
}

async function navigate(url) {
	if (!frame || !controller) {
		await init();
	}
	if (!url.startsWith("http")) {
		url = `https://${url}`;
	}
	await frame.go(url);
	frameWrapper.style.display = "flex";
}

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	try {
		await navigate(address.value);
	} catch (error) {
		showErrorScreen(error.message, error.stack);
	}
});

const goto = new URL(location.href).searchParams.get("goto");
if (goto) {
	history.replaceState(null, "", location.pathname);
	address.value = goto;
	navigate(goto).catch((error) => showErrorScreen(error.message, error.stack));
}
