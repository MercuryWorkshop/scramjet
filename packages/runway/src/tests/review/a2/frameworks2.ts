import { htmlTest } from "../../../testcommon.ts";

const fw = (name: string, head: string, body: string, js: string) =>
	htmlTest({
		name: `rv2-fw2-${name}`,
		html: `<!DOCTYPE html><html><head>${head}</head><body>${body}<script>
		runTest(async () => {
			const R = {};
			const rec = async (k, f) => { try { R[k] = await f(); } catch (e) { R[k] = "THREW " + e.name + ": " + e.message; } };
			${js}
			for (const k of Object.keys(R)) assertConsistent(k, typeof R[k] === "string" || typeof R[k] === "number" || typeof R[k] === "boolean" || R[k] === null ? R[k] : JSON.stringify(R[k]));
		}, true);
		</script></body></html>`,
	});

export default [
	fw(
		"angularjs",
		`<script src="https://cdn.jsdelivr.net/npm/angular@1.8.3/angular.min.js"></script>`,
		`<div id=ng ng-app ng-init="n=1; items=['a','b']"><a ng-href="/ng/{{n}}" id=nga>l{{n}}</a><img ng-src="/ngi/{{n}}.png"><p ng-repeat="i in items" ng-class="{on: n>1}" ng-style="{'background-image': 'url(/s' + n + '.png)'}">{{i}}</p><button ng-click="n=n+1" id=ngb>b</button><div ng-bind-html-unsafe="x"></div></div>`,
		`
		await new Promise(r => setTimeout(r, 300));
		const clean = (s) => s.replace(new RegExp("<" + "!--[^>]*--" + ">", "g"), "").replace(/ class="[^"]*"/g, (m) => m.split(" ").filter(c => !c.startsWith("ng-")).join(" "));
		await rec("init", () => clean(document.getElementById("ng").innerHTML));
		document.getElementById("ngb").click();
		await new Promise(r => setTimeout(r, 100));
		await rec("after", () => clean(document.getElementById("ng").innerHTML));
		await rec("href", () => document.getElementById("nga").href);
		`
	),
	fw(
		"vue2",
		`<script src="https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.js"></script>`,
		`<div id=v2><a :href="'/v2/' + n" id=v2a>l{{ n }}</a><img :src="src"><p v-for="i in items" :key="i" :class="{on: n>1}" :style="{backgroundImage: 'url(/v2bg.png)'}">{{ i }}</p><button @click="n++" id=v2b>b</button><div v-html="raw"></div><svg viewBox="0 0 1 1"><use :xlink:href="'#u' + n"></use></svg></div>`,
		`
		Vue.config.productionTip = false; Vue.config.devtools = false;
		new Vue({ el: "#v2", data: { n: 1, src: "/v2.png", items: ["a", "b"], raw: "<i>r</i><a href='/rr'>rr</a>" } });
		await rec("init", () => document.getElementById("v2").innerHTML);
		document.getElementById("v2b").click();
		await new Promise(r => setTimeout(r, 50));
		await rec("after", () => document.getElementById("v2").innerHTML);
		await rec("href", () => document.getElementById("v2a").href);
		`
	),
	fw(
		"htmx",
		`<script src="https://cdn.jsdelivr.net/npm/htmx.org@1.9.12/dist/htmx.min.js"></script>`,
		`<div id=hx><button hx-get="/frag" hx-target="#out" id=hxb>go</button><div id=out></div></div>`,
		`
		await new Promise(r => setTimeout(r, 200));
		await rec("attrs", () => { const b = document.getElementById("hxb"); return [b.getAttribute("hx-get"), htmx.version]; });
		const f = document.createElement("div");
		f.innerHTML = "<a hx-boost='true' href='/b'>b</a>";
		htmx.process(f);
		await rec("processed", () => f.innerHTML);
		`
	),
];
