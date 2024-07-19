Object.defineProperty(document, "cookie", {
	get() {
		return "";
	},
	set(value) {
		console.log("COOKIE SET", value);
	},
});

delete window.cookieStore;
