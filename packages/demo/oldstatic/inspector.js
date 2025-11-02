class RequestInspector {
	constructor() {
		this.requests = [];
		this.selectedRequest = null;
		this.init();
	}

	init() {
		this.setupEventListeners();
		this.setupMessageHandler();
		this.render();
		this.setupCollapsibleSections();
	}

	setupEventListeners() {
		document.getElementById("clear-btn").addEventListener("click", () => {
			this.requests = [];
			this.selectedRequest = null;
			this.render();
		});

		document.getElementById("refresh-btn").addEventListener("click", () => {
			this.render();
		});

		// Tab switching
		document.querySelectorAll(".details-tab").forEach((tab) => {
			tab.addEventListener("click", (e) => {
				// Remove active class from all tabs
				document
					.querySelectorAll(".details-tab")
					.forEach((t) => t.classList.remove("active"));
				// Add active class to clicked tab
				e.target.classList.add("active");

				// Hide all tab content
				document
					.querySelectorAll(".tab-content")
					.forEach((content) => content.classList.remove("active"));

				// Show the corresponding tab content
				const tabName = e.target.dataset.tab;
				document.getElementById(`${tabName}-tab`).classList.add("active");

				// Update content if a request is selected
				if (this.selectedRequest) {
					this.updateDetails();
				}
			});
		});

		// Table row selection
		document
			.getElementById("request-table-body")
			.addEventListener("click", (e) => {
				const row = e.target.closest("tr[data-request-id]");
				if (row) {
					const requestId = parseInt(row.dataset.requestId);
					this.selectRequest(requestId);
				}
			});
	}

	setupMessageHandler() {
		navigator.serviceWorker.addEventListener("message", async (event) => {
			if (event.data.type === "scramjet-request") {
				// Check if there's a transferred stream in the message
				let requestData = event.data.data;
				// Handle transferred stream for request body
				// The stream is included directly in the data object
				if (requestData.body && requestData.body instanceof ReadableStream) {
					try {
						const reader = requestData.body.getReader();
						const chunks = [];
						let done, value;

						while (!done) {
							({ done, value } = await reader.read());
							if (value) {
								chunks.push(value);
							}
						}

						// Convert chunks to text
						const blob = new Blob(chunks);
						requestData.payload = await blob.text();
					} catch (error) {
						console.error("Error reading request body stream:", error);
						requestData.payload = "[Error reading request body]";
					}
				}
				this.addRequest(requestData);
			} else if (event.data.type === "scramjet-response") {
				// Check if there's a transferred stream in the message
				let responseData = event.data.data;
				console.log(responseData);

				// Handle transferred stream for response body
				// The stream is included directly in the data object
				if (responseData.body && responseData.body instanceof ReadableStream) {
					try {
						const reader = responseData.body.getReader();
						const chunks = [];
						let done, value;

						while (!done) {
							({ done, value } = await reader.read());
							if (value) {
								chunks.push(value);
							}
						}

						// Convert chunks to text
						const blob = new Blob(chunks);
						responseData.responseBody = await blob.text();
						responseData.responseSize = responseData.responseBody.length;
					} catch (error) {
						console.error("Error reading response body stream:", error);
						responseData.responseBody = "[Error reading response body]";
					}
				}
				this.updateResponse(responseData);
			}
		});
	}

	addRequest(requestData) {
		// Add timestamp if not present
		if (!requestData.timestamp) {
			requestData.timestamp = Date.now();
		}

		// Add to requests array
		this.requests.push({
			id: this.requests.length,
			...requestData,
		});

		// Update UI
		this.render();
	}

	updateResponse(responseData) {
		// Find the matching request by URL
		const request = this.requests.find((r) => r.url === responseData.url);
		if (request) {
			// Update request with response data
			request.status = responseData.status;
			request.responseHeaders = responseData.responseHeaders;
			request.responseSize = responseData.responseSize;
			request.responseTimestamp = responseData.timestamp;
			// Store response body if available
			if (responseData.responseBody) {
				request.responseBody = responseData.responseBody;
			}

			// Update UI
			this.render();

			// If this is the selected request, update details
			if (this.selectedRequest && this.selectedRequest.id === request.id) {
				this.updateDetails();
			}
		}
	}

	selectRequest(requestId) {
		this.selectedRequest = this.requests.find((r) => r.id === requestId);

		// Switch back to headers tab when selecting a new request
		document
			.querySelectorAll(".details-tab")
			.forEach((tab) => tab.classList.remove("active"));
		document
			.querySelector('.details-tab[data-tab="headers"]')
			.classList.add("active");

		// Hide all tab content and show headers tab content
		document
			.querySelectorAll(".tab-content")
			.forEach((content) => content.classList.remove("active"));
		document.getElementById("headers-tab").classList.add("active");

		this.render();
		this.updateDetails();
	}

	updateDetails() {
		if (!this.selectedRequest) return;

		document.getElementById("detail-url").textContent =
			this.selectedRequest.url || "-";
		document.getElementById("detail-method").textContent =
			this.selectedRequest.method || "-";
		const statusElement = document.getElementById("detail-status");
		statusElement.textContent = this.selectedRequest.status || "-";
		// Apply status coloring to the details status element
		statusElement.className = ""; // Clear any existing classes
		statusElement.classList.add(
			"status-code",
			this.getStatusClass(this.selectedRequest.status)
		);
		document.getElementById("detail-address").textContent =
			this.selectedRequest.remoteAddress || "-";
		document.getElementById("detail-referrer").textContent =
			this.selectedRequest.referrerPolicy || "-";

		// Update headers
		const requestHeaders = this.selectedRequest.requestHeaders || {};
		const responseHeaders = this.selectedRequest.responseHeaders || {};

		this.updateHeaderSection("request-headers", requestHeaders);
		this.updateHeaderSection("response-headers", responseHeaders);

		// Update preview tab content
		const previewContent = document.getElementById("preview-content");
		// Try different possible payload properties
		const payload =
			this.selectedRequest.payload ||
			this.selectedRequest.body ||
			this.selectedRequest.data ||
			this.selectedRequest.requestBody;
		if (payload) {
			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(payload);
				previewContent.textContent = JSON.stringify(parsed, null, 2);
			} catch (e) {
				// If not JSON, display as plain text
				previewContent.textContent = payload;
			}
		} else {
			previewContent.textContent = "No payload data available";
		}

		// Update response tab content
		const responseContent = document.getElementById("response-content");
		// Try different possible response body properties
		const responseBody =
			this.selectedRequest.responseBody ||
			this.selectedRequest.response ||
			this.selectedRequest.responseText ||
			this.selectedRequest.responseData;
		if (responseBody) {
			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(responseBody);
				responseContent.textContent = JSON.stringify(parsed, null, 2);
			} catch (e) {
				// If not JSON, display as plain text
				responseContent.textContent = responseBody;
			}
		} else {
			responseContent.textContent = "No response data available";
		}
	}

	getStatusClass(status) {
		if (!status) return "status-other";
		const code = parseInt(status);
		if (code >= 200 && code < 300) return "status-2xx";
		if (code >= 300 && code < 400) return "status-3xx";
		if (code >= 400 && code < 500) return "status-4xx";
		if (code >= 500) return "status-5xx";
		return "status-other";
	}

	getRequestName(url) {
		if (!url) return "-";
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			if (pathname === "/") return urlObj.hostname;
			const parts = pathname.split("/");
			return parts[parts.length - 1] || urlObj.hostname;
		} catch (e) {
			return url;
		}
	}

	formatSize(bytes) {
		if (!bytes) return "-";
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	}

	updateHeaderSection(sectionId, headers) {
		const container = document.getElementById(sectionId);
		if (!container) return;

		if (!headers || Object.keys(headers).length === 0) {
			container.innerHTML =
				'<div class="header-entry"><div class="header-name"></div><div class="header-value">(empty)</div></div>';
			return;
		}

		// Format headers like Chrome DevTools
		const headerEntries = Object.entries(headers)
			.map(([key, value]) => {
				// Clean up the value by removing extra whitespace and newlines
				const cleanValue = String(value || "")
					.trim()
					.replace(/\s+/g, " ");
				return `
                <div class="header-entry">
                    <div class="header-name">${key}:</div>
                    <div class="header-value">${cleanValue}</div>
                </div>
            `;
			})
			.join("");

		container.innerHTML = headerEntries;
	}

	setupCollapsibleSections() {
		// Add event listeners for collapsible sections
		document.querySelectorAll(".section-header").forEach((header) => {
			header.addEventListener("click", () => {
				const sectionType = header.dataset.section;
				const arrow = header.querySelector(".section-arrow");
				let content;

				if (sectionType === "general") {
					content = document.getElementById("general-content");
				} else if (sectionType === "request-headers") {
					content = document.getElementById("request-headers-content");
				} else if (sectionType === "response-headers") {
					content = document.getElementById("response-headers-content");
				}

				if (content) {
					content.classList.toggle("collapsed");
					arrow.classList.toggle("collapsed");
				}
			});
		});
	}

	formatTime(timestamp) {
		if (!timestamp) return "-";
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	}

	getFileIcon(request) {
		const mimeType = request.mimeType || "";
		const contentType = request.responseHeaders
			? request.responseHeaders["content-type"] ||
				request.responseHeaders["Content-Type"]
			: "";

		// Use mimeType if available, otherwise fallback to content-type
		const type = (mimeType || contentType || "").toLowerCase();

		// Map MIME types to appropriate icons and classes
		if (type.includes("javascript") || type.includes("script")) {
			return { icon: "file-script.svg", class: "icon-script" };
		} else if (type.includes("css")) {
			return { icon: "file-stylesheet.svg", class: "icon-stylesheet" };
		} else if (type.includes("html")) {
			return { icon: "file-document.svg", class: "icon-document" };
		} else if (type.includes("json")) {
			return { icon: "file-json.svg", class: "icon-json" };
		} else if (type.includes("image")) {
			return { icon: "file-image.svg", class: "icon-image" };
		} else if (type.includes("audio") || type.includes("video")) {
			return { icon: "file-media.svg", class: "icon-media" };
		} else if (type.includes("font")) {
			return { icon: "file-font.svg", class: "icon-font" };
		} else if (type.includes("wasm")) {
			return { icon: "file-wasm.svg", class: "icon-wasm" };
		} else if (type.includes("xml")) {
			return { icon: "file-document.svg", class: "icon-xml" };
		} else if (type.includes("manifest")) {
			return { icon: "file-manifest.svg", class: "icon-manifest" };
		} else {
			return { icon: "file-generic.svg", class: "icon-generic" };
		}
	}

	render() {
		const tbody = document.getElementById("request-table-body");

		if (this.requests.length === 0) {
			tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">No requests captured yet</div>
                    </td>
                </tr>
            `;
			return;
		}

		tbody.innerHTML = this.requests
			.map((request) => {
				const statusClass = this.getStatusClass(request.status);
				const iconInfo = this.getFileIcon(request);
				return `
                <tr data-request-id="${request.id}" class="${this.selectedRequest && this.selectedRequest.id === request.id ? "selected" : ""}">
                    <td>
                        <div class="request-info">
                            <img src="devtoolsimgs/${iconInfo.icon}" class="request-icon ${iconInfo.class}" alt="">
                            <span class="request-name">${this.getRequestName(request.url) || "-"}</span>
                        </div>
                    </td>
                    <td>
                        ${request.status ? `<span class="status-code ${statusClass}">${request.status}</span>` : ""}
                    </td>
                    <td>${request.destination || "-"}</td>
                    <td>${this.formatSize(request.responseSize)}</td>
                    <td>${this.formatTime(request.timestamp)}</td>
                </tr>
            `;
			})
			.join("");

		if (this.selectedRequest) {
			this.updateDetails();
		}
	}
}

// Initialize the inspector when the page loads
document.addEventListener("DOMContentLoaded", () => {
	window.inspector = new RequestInspector();
});

// Resizer functionality
document.addEventListener("DOMContentLoaded", () => {
	const resizer = document.getElementById("resizer");
	const leftPane = document.querySelector(".request-table-container");
	const rightPane = document.querySelector(".request-details");
	const container = document.querySelector(".main-content");

	let isResizing = false;

	resizer.addEventListener("mousedown", (e) => {
		isResizing = true;
		resizer.classList.add("active");
		document.body.style.cursor = "col-resize";
		e.preventDefault();
	});

	document.addEventListener("mousemove", (e) => {
		if (!isResizing) return;

		const containerRect = container.getBoundingClientRect();
		const relativeX = e.clientX - containerRect.left;
		const containerWidth = containerRect.width;

		// Calculate percentage width for left pane (min 20%, max 80%)
		const percentage = Math.min(
			Math.max((relativeX / containerWidth) * 100, 20),
			80
		);

		leftPane.style.flex = `0 0 ${percentage}%`;
	});

	document.addEventListener("mouseup", () => {
		isResizing = false;
		resizer.classList.remove("active");
		document.body.style.cursor = "";
	});
});
