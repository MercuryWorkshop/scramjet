import { appTest } from "./rv3-apps-lib.ts";

const counter = (sel = "button") => [
	{
		click: sel,
		text: "ount",
		wait: 500,
		evalLabel: "afterClick",
		eval: `document.body.innerText.match(/count is \\d+/i)?.[0] ?? document.querySelector("${sel}")?.textContent`,
	},
];
const vite = [
	appTest({
		name: "vite-react",
		dir: "vite-react-ts/dist",
		steps: counter(),
	}),
	appTest({
		name: "vite-vue",
		dir: "vite-vue-ts/dist",
		steps: counter(),
	}),
	appTest({
		name: "vite-svelte",
		dir: "vite-svelte-ts/dist",
		steps: counter(),
	}),
	appTest({
		name: "vite-preact",
		dir: "vite-preact-ts/dist",
		steps: counter(),
	}),
	appTest({
		name: "vite-solid",
		dir: "vite-solid-ts/dist",
		steps: counter(),
	}),
	appTest({
		name: "vite-lit",
		dir: "vite-lit-ts/dist",
		ready: "my-element",
		steps: [
			{
				wait: 500,
				evalLabel: "shadow",
				eval: `(() => { const e = document.querySelector("my-element"); const b = e && e.shadowRoot && e.shadowRoot.querySelector("button"); if (!b) return "no shadow button"; const before = b.textContent; b.click(); return new Promise(r => setTimeout(() => r(before + " -> " + b.textContent), 300)); })()`,
			},
		],
	}),
];

const nav = (count = true) => [
	...(count
		? [
				{
					click: "button",
					text: "ount",
					wait: 500,
					evalLabel: "afterClick",
					eval: `(document.body.innerText.match(/count is \\d+/i) || [null])[0]`,
				},
			]
		: []),
	{
		eval: `window.__keep = 1`,
		evalLabel: "mark",
	},
	{
		click: "#nav-about",
		expect: "#about",
		wait: 800,
		evalLabel: "aboutText",
		eval: `document.querySelector("#about").textContent + " | spa=" + (window.__keep === 1)`,
	},
	{
		eval: `history.back()`,
		evalLabel: "back",
	},
	{
		wait: 1500,
		expect: "#home",
	},
	{
		evalLabel: "afterBack",
		eval: `!!document.querySelector("#home") + " spa=" + (window.__keep === 1)`,
	},
];
export const more = [
	appTest({
		name: "astro",
		dir: "astro-basic/dist",
		ready: "#island",
		steps: [
			{
				click: "#island",
				wait: 500,
				evalLabel: "island",
				eval: `document.querySelector("#island").textContent`,
			},
			...nav(false),
		],
	}),
	appTest({
		name: "sveltekit",
		dir: "sk-static/build",
		ready: "#home",
		steps: nav(),
	}),
	appTest({
		name: "nuxt",
		dir: "nuxt-app/.output/public",
		ready: "#home",
		steps: nav(),
	}),
	appTest({
		name: "angular",
		dir: "ng-app/dist/ng-app/browser",
		spa: true,
		ready: "#home",
		steps: [
			...nav(),
			{
				evalLabel: "lazyCss",
				eval: `document.querySelector("#about") ? getComputedStyle(document.querySelector("#about")).color : "no-about"`,
			},
		],
	}),
	appTest({
		name: "next-export",
		dir: "next-export/out",
		ready: "#home",
		steps: [
			...nav(),
			{
				evalLabel: "nextLazy",
				eval: `window.__nextLazy`,
			},
		],
	}),
	appTest({
		name: "react-router-spa",
		dir: "rr-spa/build/client",
		spa: true,
		ready: "#home",
		steps: nav(),
	}),
	appTest({
		name: "webpack5",
		dir: "wp5/dist",
		ready: "#home",
		steps: [
			{
				click: "#go",
				expect: "#about",
				wait: 500,
				evalLabel: "route",
				eval: `document.querySelector("#about").textContent + " " + getComputedStyle(document.querySelector("#about")).color`,
			},
		],
	}),
	appTest({
		name: "parcel",
		dir: "parcel-app/dist",
		ready: "#home",
		steps: [
			{
				click: "#go",
				expect: "#about",
				wait: 500,
				evalLabel: "route",
				eval: `document.querySelector("#about").textContent + " " + getComputedStyle(document.querySelector("#about")).color`,
			},
		],
	}),
];
export default [...vite, ...more];
