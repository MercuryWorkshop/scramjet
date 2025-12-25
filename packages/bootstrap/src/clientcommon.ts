export async function registerSw(path: string): Promise<ServiceWorker> {
	const registration = await navigator.serviceWorker.register(path, {
		type: "classic",
		updateViaCache: "none",
	});

	// Wait for the service worker to be ready
	await navigator.serviceWorker.ready;

	// If there's an active service worker, use it
	if (registration.active) {
		return registration.active;
	}

	// If there's an installing service worker, wait for it
	if (registration.installing) {
		await new Promise<void>((resolve) => {
			const sw = registration.installing!;
			if (sw.state === "activated") {
				resolve();
			} else {
				sw.addEventListener("statechange", function onChange() {
					if (sw.state === "activated") {
						sw.removeEventListener("statechange", onChange);
						resolve();
					}
				});
			}
		});

		return registration.active!;
	}

	// If there's a waiting service worker, skip waiting and activate it
	if (registration.waiting) {
		registration.waiting.postMessage({ type: "SKIP_WAITING" });

		await new Promise<void>((resolve) => {
			navigator.serviceWorker.addEventListener(
				"controllerchange",
				() => {
					resolve();
				},
				{ once: true }
			);
		});

		return navigator.serviceWorker.controller!;
	}

	throw new Error("No service worker found in registration");
}

export function loadScript(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = url;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load script " + url));
		document.head.appendChild(script);
	});
}
