import type { Tab } from "./Tab";

import type HtmlToImage from "html-to-image";

let stream: MediaStream | null;
let track: MediaStreamTrack | null;
let video: HTMLVideoElement | null;

export async function startCapture() {
	if (stream) return;

	stream = await navigator.mediaDevices.getDisplayMedia({
		video: {
			displaySurface: "window",
		},
		//@ts-expect-error untyped
		preferCurrentTab: true,
		audio: false,
	});
	track = stream.getVideoTracks()[0];

	video = document.createElement("video");
	video.srcObject = stream;
	video.play();
}

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;
export async function takeScreenshotGDM(
	container: HTMLElement
): Promise<Blob | null> {
	if (!stream || !track || !video) return null;
	try {
		//@ts-expect-error untyped
		const restrictionTarget = await RestrictionTarget.fromElement(container);
		//@ts-expect-error untyped
		await track.restrictTo(restrictionTarget);

		await new Promise((r) => setTimeout(r, 100));
		const settings = track.getSettings();
		canvas.width = settings.width!;
		canvas.height = settings.height!;
		ctx.drawImage(video, 0, 0);
		const blob: Blob | null = await new Promise((resolve) =>
			canvas.toBlob(resolve, "image/png")
		);

		return blob;
	} catch (e) {
		console.error(e);

		return null;
	}
}

export async function takeScreenshotSvg(tab: Tab): Promise<string | null> {
	const cw = tab.frame.frame.contentWindow!;
	const h2: typeof HtmlToImage = (cw as any).h2;
	const svg = await h2.toSvg(tab.frame.frame.contentDocument!.body, {
		onImageErrorHandler: (...args) => {
			console.log(args);
		},
	});

	return svg;
}
