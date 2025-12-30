import { playwrightTest } from "../testcommon.ts";
import http from "http";
import type { CDPSession } from "playwright";

let testServerPort = 9100;

// Helper to create a test server that serves pages with custom scheme links
function createTestServer(
	htmlContent: string
): Promise<{ server: http.Server; port: number }> {
	const port = testServerPort++;
	return new Promise((resolve) => {
		const server = http.createServer((req, res) => {
			if (req.url === "/") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(htmlContent);
			} else {
				res.writeHead(404);
				res.end("Not found");
			}
		});
		server.listen(port, () => resolve({ server, port }));
	});
}

// Helper to set up CDP session and intercept frame navigation requests
async function setupFrameNavigationInterception(page: any): Promise<{
	cdp: CDPSession;
	navigatedUrls: string[];
	cleanup: () => Promise<void>;
}> {
	const navigatedUrls: string[] = [];

	// Get CDP session from the page
	const cdp = await page.context().newCDPSession(page);

	// Enable Page domain
	await cdp.send("Page.enable");

	// Listen for frame navigation events - this catches attempts to navigate frames
	cdp.on("Page.frameRequestedNavigation", (event: any) => {
		navigatedUrls.push(event.url);
	});

	// Also listen for frameNavigated events
	cdp.on("Page.frameNavigated", (event: any) => {
		if (event.frame?.url) {
			navigatedUrls.push(event.frame.url);
		}
	});

	// And frameStartedLoading/Stopped can help
	cdp.on("Page.navigatedWithinDocument", (event: any) => {
		if (event.url) {
			navigatedUrls.push(event.url);
		}
	});

	return {
		cdp,
		navigatedUrls,
		cleanup: async () => {
			await cdp.send("Page.disable").catch(() => {});
			await cdp.detach().catch(() => {});
		},
	};
}

export default [
	// Test clicking an anchor with custom scheme - capture via CDP Page domain
	playwrightTest({
		name: "custom-schemes-click-anchor",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<a id="custom-link" href="custom-scheme://example.com/test">Click me</a>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				// Wait for the link to be visible
				const link = frame.locator("#custom-link");
				await link.waitFor({ state: "visible", timeout: 5000 });

				// Click the link
				await link.click().catch(() => {});
				await page.waitForTimeout(500);

				// Check if custom-scheme URL was captured
				const customSchemeNav = navigatedUrls.find((url) =>
					url.startsWith("custom-scheme://")
				);
				if (!customSchemeNav) {
					throw new Error(
						`Expected navigation to custom-scheme://, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!customSchemeNav.includes("example.com/test")) {
					throw new Error(
						`Expected custom-scheme://example.com/test, got: ${customSchemeNav}`
					);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test clicking mailto: link
	playwrightTest({
		name: "custom-schemes-click-mailto",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<a id="mailto-link" href="mailto:test@example.com?subject=Hello">Email me</a>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				const link = frame.locator("#mailto-link");
				await link.waitFor({ state: "visible", timeout: 5000 });
				await link.click().catch(() => {});
				await page.waitForTimeout(500);

				const mailtoNav = navigatedUrls.find((url) =>
					url.startsWith("mailto:")
				);
				if (!mailtoNav) {
					throw new Error(
						`Expected navigation to mailto:, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!mailtoNav.includes("test@example.com")) {
					throw new Error(
						`Expected mailto:test@example.com, got: ${mailtoNav}`
					);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test clicking tel: link
	playwrightTest({
		name: "custom-schemes-click-tel",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<a id="tel-link" href="tel:+1234567890">Call me</a>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				const link = frame.locator("#tel-link");
				await link.waitFor({ state: "visible", timeout: 5000 });
				await link.click().catch(() => {});
				await page.waitForTimeout(500);

				const telNav = navigatedUrls.find((url) => url.startsWith("tel:"));
				if (!telNav) {
					throw new Error(
						`Expected navigation to tel:, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!telNav.includes("+1234567890")) {
					throw new Error(`Expected tel:+1234567890, got: ${telNav}`);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test window.location assignment with custom scheme
	playwrightTest({
		name: "custom-schemes-location-assign",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<button id="navigate-btn">Navigate</button>
					<script>
						document.getElementById('navigate-btn').addEventListener('click', () => {
							window.location = 'steam://run/123456';
						});
					</script>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				const btn = frame.locator("#navigate-btn");
				await btn.waitFor({ state: "visible", timeout: 5000 });
				await btn.click().catch(() => {});
				await page.waitForTimeout(500);

				const steamNav = navigatedUrls.find((url) =>
					url.startsWith("steam://")
				);
				if (!steamNav) {
					throw new Error(
						`Expected navigation to steam://, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!steamNav.includes("run/123456")) {
					throw new Error(`Expected steam://run/123456, got: ${steamNav}`);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test location.replace with custom scheme
	playwrightTest({
		name: "custom-schemes-location-replace",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<button id="replace-btn">Replace</button>
					<script>
						document.getElementById('replace-btn').addEventListener('click', () => {
							location.replace('vscode://file/path/to/file.ts');
						});
					</script>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				const btn = frame.locator("#replace-btn");
				await btn.waitFor({ state: "visible", timeout: 5000 });
				await btn.click().catch(() => {});
				await page.waitForTimeout(500);

				const vscodeNav = navigatedUrls.find((url) =>
					url.startsWith("vscode://")
				);
				if (!vscodeNav) {
					throw new Error(
						`Expected navigation to vscode://, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!vscodeNav.includes("file/path/to/file.ts")) {
					throw new Error(
						`Expected vscode://file/path/to/file.ts, got: ${vscodeNav}`
					);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test dynamically created anchor and click
	playwrightTest({
		name: "custom-schemes-dynamic-anchor-click",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<button id="create-and-click">Create Link</button>
					<div id="container"></div>
					<script>
						document.getElementById('create-and-click').addEventListener('click', () => {
							const anchor = document.createElement('a');
							anchor.href = 'discord://users/123456789';
							anchor.id = 'dynamic-link';
							anchor.textContent = 'Dynamic Link';
							document.getElementById('container').appendChild(anchor);
						});
					</script>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				// Click button to create the anchor
				const btn = frame.locator("#create-and-click");
				await btn.waitFor({ state: "visible", timeout: 5000 });
				await btn.click();
				await page.waitForTimeout(300);

				// Now click the dynamically created link
				const dynamicLink = frame.locator("#dynamic-link");
				await dynamicLink.waitFor({ state: "visible", timeout: 5000 });
				await dynamicLink.click().catch(() => {});
				await page.waitForTimeout(500);

				const discordNav = navigatedUrls.find((url) =>
					url.startsWith("discord://")
				);
				if (!discordNav) {
					throw new Error(
						`Expected navigation to discord://, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!discordNav.includes("users/123456789")) {
					throw new Error(
						`Expected discord://users/123456789, got: ${discordNav}`
					);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test form submission with custom scheme action
	playwrightTest({
		name: "custom-schemes-form-submit",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<form id="custom-form" action="myapp://submit/data" method="get">
						<input type="text" name="test" value="value">
						<button type="submit" id="submit-btn">Submit</button>
					</form>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				const submitBtn = frame.locator("#submit-btn");
				await submitBtn.waitFor({ state: "visible", timeout: 5000 });
				await submitBtn.click().catch(() => {});
				await page.waitForTimeout(500);

				const myappNav = navigatedUrls.find((url) =>
					url.startsWith("myapp://")
				);
				if (!myappNav) {
					throw new Error(
						`Expected navigation to myapp://, but got: ${navigatedUrls.join(", ")}`
					);
				}

				if (!myappNav.includes("submit/data")) {
					throw new Error(`Expected myapp://submit/data, got: ${myappNav}`);
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),

	// Test multiple custom schemes on one page
	playwrightTest({
		name: "custom-schemes-multiple-links",
		fn: async ({ page, frame, navigate }) => {
			const { server, port } = await createTestServer(`
				<!DOCTYPE html>
				<html>
				<body>
					<a id="link-steam" href="steam://run/440">Steam</a>
					<a id="link-discord" href="discord://invite/abc">Discord</a>
					<a id="link-slack" href="slack://open">Slack</a>
					<a id="link-zoommtg" href="zoommtg://zoom.us/join?confno=123">Zoom</a>
					<a id="link-spotify" href="spotify://album/xyz">Spotify</a>
				</body>
				</html>
			`);

			const { navigatedUrls, cleanup } =
				await setupFrameNavigationInterception(page);

			try {
				await navigate(`http://localhost:${port}/`);

				// Click each link and verify navigation is attempted
				const expectedSchemes = [
					{ id: "link-steam", scheme: "steam://", expected: "steam://run/440" },
					{
						id: "link-discord",
						scheme: "discord://",
						expected: "discord://invite/abc",
					},
					{ id: "link-slack", scheme: "slack://", expected: "slack://open" },
					{
						id: "link-zoommtg",
						scheme: "zoommtg://",
						expected: "zoommtg://zoom.us/join?confno=123",
					},
					{
						id: "link-spotify",
						scheme: "spotify://",
						expected: "spotify://album/xyz",
					},
				];

				for (const { id } of expectedSchemes) {
					const link = frame.locator(`#${id}`);
					await link.waitFor({ state: "visible", timeout: 5000 });
					await link.click().catch(() => {});
					await page.waitForTimeout(300);
				}

				// Verify all schemes were navigated to
				for (const { scheme, expected } of expectedSchemes) {
					const nav = navigatedUrls.find((u) => u === expected);
					if (!nav) {
						const found = navigatedUrls
							.filter((u) => u.startsWith(scheme))
							.join(", ");
						throw new Error(
							`Expected ${expected}, but got: ${found || "none"}. All URLs: ${navigatedUrls.join(", ")}`
						);
					}
				}
			} finally {
				await cleanup();
				server.close();
			}
		},
	}),
];
