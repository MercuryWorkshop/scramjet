import { basicTest } from "../../../testcommon.ts";

const P: Record<string, string> = {
	url_of_location: `return new URL(window.location).href.replace(location.origin, 'O');`,
	url_of_location_bare: `return new URL(location).href.replace(location.origin, 'O');`,
	url_of_document_location: `return new URL(document.location).href.replace(location.origin, 'O');`,
	sphinx_highlight: `history.replaceState(null,'','/3/?highlight=list'); const url = new URL(window.location); url.searchParams.delete('highlight'); try { window.history.replaceState({}, '', url); return location.href.replace(location.origin,'O'); } catch(e){ return 'THROW '+e.name+': '+e.message.slice(0,200); }`,
	usp_of_location_search: `return new URLSearchParams(window.location.search).get('highlight');`,
	string_location: `return [String(window.location), ''+window.location, \`\${window.location}\`, window.location.toString()].map(s=>s.replace(location.origin,'O'));`,
	location_in_array_join: `return [window.location].join('').replace(location.origin,'O');`,
	json_location: `return JSON.stringify(window.location).slice(0,80);`,
	location_valueOf: `const v = window.location.valueOf(); return v === window.location;`,
	url_parse: `return URL.parse ? URL.parse(window.location).href.replace(location.origin,'O') : 'n/a';`,
	a_href_location: `const a=document.createElement('a'); a.href=window.location; return a.href.replace(location.origin,'O');`,
	fetch_location: `const r=await fetch(window.location); return r.url.replace(location.origin,'O');`,
	request_location: `return new Request(window.location).url.replace(location.origin,'O');`,
	win_open_loc: `return 'skip';`,
	history_push_location: `try { history.pushState(null,'',window.location); return location.href.replace(location.origin,'O'); } catch(e){ return 'THROW '+e.name+': '+e.message.slice(0,150); }`,
	history_push_document_location: `try { history.replaceState(null,'',document.location); return 'ok'; } catch(e){ return 'THROW '+e.name+': '+e.message.slice(0,150); }`,
	history_push_self_location: `try { history.replaceState(null,'',self.location); return 'ok'; } catch(e){ return 'THROW '+e.name+': '+e.message.slice(0,150); }`,
	history_push_location_obj_indirect: `const w = window; const loc = w['loc'+'ation']; try { history.replaceState(null,'',loc); return 'ok'; } catch(e){ return 'THROW '+e.name+': '+e.message.slice(0,150); }`,
};

export default [
	basicTest({
		name: "rv7-url-location",
		autoPass: false,
		js: `
		const probes = {${Object.entries(P)
			.map(([k, v]) => JSON.stringify(k) + ": async () => {" + v + "\n}")
			.join(",\n")}};
		const out = {__marker: typeof $scramjet !== 'undefined' ? '$scramjet' : 'bare'};
		for (const [k, v] of Object.entries(probes)) {
			try { out[k] = JSON.stringify(await v()); } catch (e) { out[k] = 'THROW ' + (e && e.name) + ': ' + (e && e.message); }
		}
		console.log('RV7PROBE ' + JSON.stringify(out));
		fail('RV7PROBE ' + JSON.stringify(out));
		`,
	}),
];
