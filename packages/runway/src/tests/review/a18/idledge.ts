import { probeTest } from "./harness.ts";

// Argument conversion and error paths of the CSS interceptors develop
// re-declared through the IDL layer.
const T = (code: string) =>
	`try { const v = (() => { ${code} })(); return ['ok', v === undefined ? 'undef' : v]; } catch(e){ return ['THROW', e.name, e.message]; }`;
const probes: Record<string, string> = {
	sp_noargs: T(`mk().style.setProperty();`),
	sp_one: T(
		`const d=mk(); d.style.setProperty('color'); return d.style.color;`
	),
	sp_prio_bad: T(
		`const d=mk(); d.style.setProperty('color','red','important!'); return d.style.color;`
	),
	sp_prio_obj: T(
		`const d=mk(); d.style.setProperty('color','red',{toString(){return 'important'}}); return d.style.getPropertyPriority('color');`
	),
	sp_value_obj: T(
		`const d=mk(); d.style.setProperty('width',{toString(){return '5px'}}); return d.style.width;`
	),
	sp_value_undefined: T(
		`const d=mk(); d.style.color='red'; d.style.setProperty('color', undefined); return d.style.color;`
	),
	sp_symbol: T(`mk().style.setProperty('color', Symbol());`),
	sp_extra_args: T(
		`const d=mk(); d.style.setProperty('color','red','',1,2); return d.style.color;`
	),
	gpv_noargs: T(`return mk().style.getPropertyValue();`),
	gpv_undefined: T(`return mk().style.getPropertyValue(undefined);`),
	rp_noargs: T(`return mk().style.removeProperty();`),
	cssText_null: T(
		`const d=mk(); d.style.cssText=null; return [d.style.cssText, d.getAttribute('style')];`
	),
	cssText_undef: T(
		`const d=mk(); d.style.cssText=undefined; return [d.style.cssText];`
	),
	cssText_obj: T(
		`const d=mk(); d.style.cssText={toString(){return 'color:red'}}; return [d.style.cssText];`
	),
	cssText_symbol: T(`mk().style.cssText=Symbol();`),
	style_null: T(
		`const d=mk(); d.style=null; return [d.style.cssText, d.getAttribute('style')];`
	),
	style_undef: T(
		`const d=mk(); d.style=undefined; return [d.style.cssText, d.getAttribute('style')];`
	),
	style_obj: T(
		`const d=mk(); d.style={toString(){return 'color:red'}}; return [d.style.cssText];`
	),
	rule_style_putforwards: T(
		`const sh=inl(); sh.insertRule('.pf{}'); sh.cssRules[0].style='background-image:url(/img/'+R+'-pf.png)'; mk().className='pf'; return [sh.cssRules[0].cssText];`
	),
	prop_symbol: T(`const d=mk(); d.style.color=Symbol();`),
	prop_bigint: T(`const d=mk(); d.style.zIndex=5n; return d.style.zIndex;`),
	prop_array: T(`const d=mk(); d.style.width=['5px']; return d.style.width;`),
	prop_valueOf: T(
		`const d=mk(); let n=0; d.style.width={toString(){n++; return '6px'}}; return [d.style.width, n];`
	),
	prop_toString_throws: T(
		`const d=mk(); d.style.width={toString(){throw new RangeError('x')}};`
	),
	ir_noargs: T(`inl().insertRule();`),
	ir_obj: T(
		`const sh=inl(); return [sh.insertRule({toString(){return '.io{color:red}'}}), sh.cssRules[0].cssText];`
	),
	ir_index_str: T(
		`const sh=inl(); sh.insertRule('.a{}'); return sh.insertRule('.b{}', '1');`
	),
	ir_index_neg: T(`inl().insertRule('.a{}', -1);`),
	ir_bad_rule: T(`inl().insertRule('not css');`),
	ir_index_toolarge: T(`inl().insertRule('.a{}', 5);`),
	ir_index_nan: T(
		`const sh=inl(); sh.insertRule('.a{}'); return sh.insertRule('.b{}', NaN);`
	),
	ir_wrong_this: T(`CSSStyleSheet.prototype.insertRule.call({}, '.a{}');`),
	addRule_undef: T(
		`const sh=inl(); return [sh.addRule('.ar', undefined), sh.cssRules[0].cssText];`
	),
	addRule_null: T(
		`const sh=inl(); return [sh.addRule(null, null), sh.cssRules[0].cssText];`
	),
	replaceSync_null: T(
		`const sh=new CSSStyleSheet(); sh.replaceSync(null); return [sh.cssRules.length];`
	),
	replaceSync_noargs: T(`new CSSStyleSheet().replaceSync();`),
	replaceSync_nonconstructed: T(
		`document.getElementById('st1').sheet.replaceSync('.x{}');`
	),
	replace_noargs: `try { await new CSSStyleSheet().replace(); return 'resolved'; } catch(e){ return ['REJ', e.name]; }`,
	replace_sync_throw_type: `try { const p = CSSStyleSheet.prototype.replace.call({}, ''); return ['returned', p instanceof Promise, await p.then(()=>'res', e=>'rej '+e.name)]; } catch(e){ return ['THROW', e.name]; }`,
	parse_noargs: T(`CSSStyleValue.parse();`),
	parse_bad: T(`CSSStyleValue.parse('width','bogus!');`),
	parse_num: T(`return String(CSSStyleValue.parse('width', 5));`),
	parseAll_url: T(
		`return CSSStyleValue.parseAll('background-image','url(/img/'+R+'-pa.png), url(/img/'+R+'-pb.png)').length;`
	),
	map_set_noval: T(`mk().attributeStyleMap.set('width');`),
	map_set_num: T(`mk().attributeStyleMap.set('width', 5);`),
	map_set_two: T(`mk().attributeStyleMap.set('width', CSS.px(1), CSS.px(2));`),
	map_set_bad_prop: T(`mk().attributeStyleMap.set('nope', '1px');`),
	map_set_obj_string: T(
		`const d=mk(); d.attributeStyleMap.set('width', {toString(){return '7px'}}); return d.style.width;`
	),
	map_append_nonlist: T(`mk().attributeStyleMap.append('width', '1px');`),
	map_delete_noargs: T(`mk().attributeStyleMap.delete();`),
	map_set_custom: T(
		`const d=mk(); d.attributeStyleMap.set('--z', 'url(/img/'+R+'-mz.png)'); return d.style.getPropertyValue('--z');`
	),
	map_wrong_this: T(`StylePropertyMap.prototype.set.call({}, 'width', '1px');`),
	rulemap_set: T(
		`const sh=inl(); sh.insertRule('.rm{}'); const r=sh.cssRules[0]; r.styleMap.set('background-image','url(/img/'+R+'-rm.png)'); mk().className='rm'; return r.cssText;`
	),
	ff_noargs: T(`new FontFace();`),
	ff_one: T(`new FontFace('a');`),
	ff_null_src: T(`const f=new FontFace('a', null); return f.status;`),
	ff_blob: T(`const f=new FontFace('a', new Blob(['x'])); return f.status;`),
	ff_dataview: T(
		`const f=new FontFace('a', new DataView(new ArrayBuffer(8))); return f.status;`
	),
	ff_desc_null: T(`const f=new FontFace('a','url(x)', null); return f.weight;`),
	ff_desc_bad: T(
		`const f=new FontFace('a','url(x)', {weight:'bogus'}); return f.status;`
	),
	ff_call: T(`FontFace('a','b');`),
	ff_subclass_new_target: T(
		`class F extends FontFace{}; const f=new F('a','url(/img/'+R+'-ffsub.woff2)'); return [f instanceof F, Object.getPrototypeOf(f)===F.prototype];`
	),
	ff_reflect_construct: T(
		`function G(){}; G.prototype=Object.create(FontFace.prototype); const f=Reflect.construct(FontFace, ['a','url(x)'], G); return [Object.getPrototypeOf(f)===G.prototype];`
	),
	ff_length: T(`return [FontFace.length, FontFace.name];`),
};

export default [probeTest("rv18-idledge", probes)];
