// Vencord 7fcd9c3f
// Standalone: true
// Platform: Universal
// Updater Disabled: false
"use strict";
var Vencord = (() => {
	var vN = Object.create;
	var zl = Object.defineProperty;
	var SN = Object.getOwnPropertyDescriptor;
	var bN = Object.getOwnPropertyNames;
	var TN = Object.getPrototypeOf,
		xN = Object.prototype.hasOwnProperty;
	var Hs = ((e) =>
		typeof require < "u"
			? require
			: typeof Proxy < "u"
				? new Proxy(e, {
						get: (t, o) => (typeof require < "u" ? require : t)[o],
					})
				: e)(function (e) {
		if (typeof require < "u") return require.apply(this, arguments);
		throw new Error('Dynamic require of "' + e + '" is not supported');
	});
	var g = (e, t) => () => (e && (t = e((e = 0))), t);
	var z0 = (e, t) => () => (
			t || e((t = { exports: {} }).exports, t), t.exports
		),
		et = (e, t) => {
			for (var o in t) zl(e, o, { get: t[o], enumerable: !0 });
		},
		W0 = (e, t, o, r) => {
			if ((t && typeof t == "object") || typeof t == "function")
				for (let i of bN(t))
					!xN.call(e, i) &&
						i !== o &&
						zl(e, i, {
							get: () => t[i],
							enumerable: !(r = SN(t, i)) || r.enumerable,
						});
			return e;
		};
	var j0 = (e, t, o) => (
			(o = e != null ? vN(TN(e)) : {}),
			W0(
				t || !e || !e.__esModule
					? zl(o, "default", { value: e, enumerable: !0 })
					: o,
				e
			)
		),
		q0 = (e) => W0(zl({}, "__esModule", { value: !0 }), e);
	var f,
		n,
		a = g(() => {
			"use strict";
			(f = Symbol.for("react.fragment")),
				(n = (...e) => (n = Vencord.Webpack.Common.React.createElement)(...e));
		});
	var Qo = {};
	et(Qo, {
		clear: () => IN,
		createStore: () => Wl,
		del: () => zs,
		delMany: () => MN,
		entries: () => Kf,
		get: () => lt,
		getMany: () => PN,
		keys: () => CN,
		promisifyRequest: () => lo,
		set: () => wt,
		setMany: () => wN,
		update: () => Wr,
		values: () => AN,
	});
	function lo(e) {
		return new Promise((t, o) => {
			(e.oncomplete = e.onsuccess = () => t(e.result)),
				(e.onabort = e.onerror = () => o(e.error));
		});
	}
	function Wl(e, t) {
		let o = indexedDB.open(e);
		o.onupgradeneeded = () => o.result.createObjectStore(t);
		let r = lo(o);
		return (i, s) => r.then((l) => s(l.transaction(t, i).objectStore(t)));
	}
	function Zo() {
		return jf || (jf = Wl("VencordData", "VencordStore")), jf;
	}
	function lt(e, t = Zo()) {
		return t("readonly", (o) => lo(o.get(e)));
	}
	function wt(e, t, o = Zo()) {
		return o("readwrite", (r) => (r.put(t, e), lo(r.transaction)));
	}
	function wN(e, t = Zo()) {
		return t(
			"readwrite",
			(o) => (e.forEach((r) => o.put(r[1], r[0])), lo(o.transaction))
		);
	}
	function PN(e, t = Zo()) {
		return t("readonly", (o) => Promise.all(e.map((r) => lo(o.get(r)))));
	}
	function Wr(e, t, o = Zo()) {
		return o(
			"readwrite",
			(r) =>
				new Promise((i, s) => {
					r.get(e).onsuccess = function () {
						try {
							r.put(t(this.result), e), i(lo(r.transaction));
						} catch (l) {
							s(l);
						}
					};
				})
		);
	}
	function zs(e, t = Zo()) {
		return t("readwrite", (o) => (o.delete(e), lo(o.transaction)));
	}
	function MN(e, t = Zo()) {
		return t(
			"readwrite",
			(o) => (e.forEach((r) => o.delete(r)), lo(o.transaction))
		);
	}
	function IN(e = Zo()) {
		return e("readwrite", (t) => (t.clear(), lo(t.transaction)));
	}
	function qf(e, t) {
		return (
			(e.openCursor().onsuccess = function () {
				!this.result || (t(this.result), this.result.continue());
			}),
			lo(e.transaction)
		);
	}
	function CN(e = Zo()) {
		return e("readonly", (t) => {
			if (t.getAllKeys) return lo(t.getAllKeys());
			let o = [];
			return qf(t, (r) => o.push(r.key)).then(() => o);
		});
	}
	function AN(e = Zo()) {
		return e("readonly", (t) => {
			if (t.getAll) return lo(t.getAll());
			let o = [];
			return qf(t, (r) => o.push(r.value)).then(() => o);
		});
	}
	function Kf(e = Zo()) {
		return e("readonly", (t) => {
			if (t.getAll && t.getAllKeys)
				return Promise.all([lo(t.getAllKeys()), lo(t.getAll())]).then(
					([r, i]) => r.map((s, l) => [s, i[l]])
				);
			let o = [];
			return e("readonly", (r) =>
				qf(r, (i) => o.push([i.key, i.value])).then(() => o)
			);
		});
	}
	var jf,
		$o = g(() => {
			"use strict";
			a();
		});
	function $t(e, t = 300) {
		let o;
		return function (...r) {
			clearTimeout(o),
				(o = setTimeout(() => {
					e(...r);
				}, t));
		};
	}
	var fr = g(() => {
		"use strict";
		a();
	});
	var Ws,
		Yf = g(() => {
			"use strict";
			a();
			Ws = class {
				set = new Set();
				get changeCount() {
					return this.set.size;
				}
				get hasChanges() {
					return this.changeCount > 0;
				}
				handleChange(t) {
					this.set.delete(t) || this.set.add(t);
				}
				add(t) {
					return this.set.add(t);
				}
				remove(t) {
					return this.set.delete(t);
				}
				getChanges() {
					return this.set.values();
				}
				map(t) {
					return [...this.getChanges()].map(t);
				}
			};
		});
	var RN,
		Ei,
		d,
		Oi,
		P = g(() => {
			"use strict";
			a();
			(RN = "Vencord.Webpack.Common.React"),
				(Ei = "1026515880080842772"),
				(d = Object.freeze({
					Ven: { name: "Vee", id: 343383572805058560n },
					Arjix: { name: "ArjixWasTaken", id: 674710789138939916n },
					Cyn: { name: "Cynosphere", id: 150745989836308480n },
					Trwy: { name: "trey", id: 354427199023218689n },
					Megu: { name: "Megumin", id: 545581357812678656n },
					botato: { name: "botato", id: 440990343899643943n },
					fawn: { name: "fawn", id: 336678828233588736n },
					rushii: { name: "rushii", id: 295190422244950017n },
					Glitch: { name: "Glitchy", id: 269567451199569920n },
					Samu: { name: "Samu", id: 702973430449832038n },
					Nyako: { name: "nyako", id: 118437263754395652n },
					MaiKokain: { name: "Mai", id: 722647978577363026n },
					echo: { name: "ECHO", id: 712639419785412668n },
					katlyn: { name: "katlyn", id: 250322741406859265n },
					nea: { name: "nea", id: 310702108997320705n },
					Nuckyz: { name: "Nuckyz", id: 235834946571337729n },
					D3SOX: { name: "D3SOX", id: 201052085641281538n },
					Nickyux: { name: "Nickyux", id: 427146305651998721n },
					mantikafasi: { name: "mantikafasi", id: 287555395151593473n },
					Xinto: { name: "Xinto", id: 423915768191647755n },
					JacobTm: { name: "Jacob.Tm", id: 302872992097107991n },
					DustyAngel47: { name: "DustyAngel47", id: 714583473804935238n },
					BanTheNons: { name: "BanTheNons", id: 460478012794863637n },
					BigDuck: { name: "BigDuck", id: 1024588272623681609n },
					AverageReactEnjoyer: {
						name: "Average React Enjoyer",
						id: 1004904120056029256n,
					},
					adryd: { name: "adryd", id: 0n },
					Tyman: { name: "Tyman", id: 487443883127472129n },
					afn: { name: "afn", id: 420043923822608384n },
					KraXen72: { name: "KraXen72", id: 379304073515499530n },
					kemo: { name: "kemo", id: 715746190813298788n },
					dzshn: { name: "dzshn", id: 310449948011528192n },
					Ducko: { name: "Ducko", id: 506482395269169153n },
					jewdev: { name: "jewdev", id: 222369866529636353n },
					Luna: { name: "Luny", id: 821472922140803112n },
					Vap: { name: "Vap0r1ze", id: 454072114492866560n },
					KingFish: { name: "King Fish", id: 499400512559382538n },
					Commandtechno: { name: "Commandtechno", id: 296776625432035328n },
					TheSun: { name: "sunnie", id: 406028027768733696n },
					axyie: { name: "'ax", id: 273562710745284628n },
					pointy: { name: "pointy", id: 99914384989519872n },
					SammCheese: { name: "Samm-Cheese", id: 372148345894076416n },
					zt: { name: "zt", id: 289556910426816513n },
					captain: { name: "Captain", id: 347366054806159360n },
					nick: { name: "nick", id: 347884694408265729n, badge: !1 },
					whqwert: { name: "whqwert", id: 586239091520176128n },
					lewisakura: { name: "lewisakura", id: 96269247411400704n },
					RuiNtD: { name: "RuiNtD", id: 157917665162297344n },
					hunt: { name: "hunt-g", id: 222800179697287168n },
					cloudburst: { name: "cloudburst", id: 892128204150685769n },
					Aria: { name: "Syncxv", id: 549244932213309442n },
					TheKodeToad: { name: "TheKodeToad", id: 706152404072267788n },
					LordElias: { name: "LordElias", id: 319460781567639554n },
					juby: { name: "Juby210", id: 324622488644616195n },
					Alyxia: { name: "Alyxia Sother", id: 952185386350829688n },
					Remty: { name: "Remty", id: 335055032204656642n },
					skyevg: { name: "skyevg", id: 1090310844283363348n },
					Dziurwa: { name: "Dziurwa", id: 1001086404203389018n },
					arHSM: { name: "arHSM", id: 841509053422632990n },
					F53: { name: "F53", id: 280411966126948353n },
					AutumnVN: { name: "AutumnVN", id: 393694671383166998n },
					pylix: { name: "pylix", id: 492949202121261067n },
					Tyler: { name: "\\\\GGTyler\\\\", id: 143117463788191746n },
					RyanCaoDev: { name: "RyanCaoDev", id: 952235800110694471n },
					FieryFlames: { name: "Fiery", id: 890228870559698955n },
					KannaDev: { name: "Kanna", id: 317728561106518019n },
					carince: { name: "carince", id: 818323528755314698n },
					PandaNinjas: { name: "PandaNinjas", id: 455128749071925248n },
					CatNoir: { name: "CatNoir", id: 260371016348336128n },
					outfoxxed: { name: "outfoxxed", id: 837425748435796060n },
					UwUDev: { name: "UwU", id: 691413039156690994n },
					amia: { name: "amia", id: 142007603549962240n },
					phil: { name: "phil", id: 305288513941667851n },
					ImLvna: { name: "lillith <3", id: 799319081723232267n },
					rad: { name: "rad", id: 610945092504780823n },
					AndrewDLO: { name: "Andrew-DLO", id: 434135504792059917n },
					HypedDomi: { name: "HypedDomi", id: 354191516979429376n },
					Rini: { name: "Rini", id: 1079479184478441643n },
					castdrian: { name: "castdrian", id: 224617799434108928n },
					Arrow: { name: "arrow", id: 958158495302176778n },
					bb010g: { name: "bb010g", id: 72791153467990016n },
					Dolfies: { name: "Dolfies", id: 852892297661906993n },
					RuukuLada: { name: "RuukuLada", id: 119705748346241027n },
					blahajZip: { name: "blahaj.zip", id: 683954422241427471n },
					archeruwu: { name: "archer_uwu", id: 160068695383736320n },
					ProffDea: { name: "ProffDea", id: 609329952180928513n },
					UlyssesZhan: { name: "UlyssesZhan", id: 586808226058862623n },
					ant0n: { name: "ant0n", id: 145224646868860928n },
					Board: { name: "BoardTM", id: 285475344817848320n },
					philipbry: { name: "philipbry", id: 554994003318276106n },
					Korbo: { name: "Korbo", id: 455856406420258827n },
					maisymoe: { name: "maisy", id: 257109471589957632n },
					Lexi: { name: "Lexi", id: 506101469787717658n },
					Mopi: { name: "Mopi", id: 1022189106614243350n },
					Grzesiek11: { name: "Grzesiek11", id: 368475654662127616n },
					Samwich: { name: "Samwich", id: 976176454511509554n },
					coolelectronics: { name: "coolelectronics", id: 696392247205298207n },
					Av32000: { name: "Av32000", id: 593436735380127770n },
					Noxillio: { name: "Noxillio", id: 138616536502894592n },
					Kyuuhachi: { name: "Kyuuhachi", id: 236588665420251137n },
					nin0dev: { name: "nin0dev", id: 886685857560539176n },
					Elvyra: { name: "Elvyra", id: 708275751816003615n },
					HappyEnderman: { name: "Happy enderman", id: 1083437693347827764n },
					Vishnya: { name: "Vishnya", id: 282541644484575233n },
					Inbestigator: { name: "Inbestigator", id: 761777382041714690n },
					newwares: { name: "newwares", id: 421405303951851520n },
					JohnyTheCarrot: { name: "JohnyTheCarrot", id: 132819036282159104n },
					puv: { name: "puv", id: 469441552251355137n },
					Kodarru: { name: "Kodarru", id: 785227396218748949n },
					nakoyasha: { name: "nakoyasha", id: 222069018507345921n },
					Sqaaakoi: { name: "Sqaaakoi", id: 259558259491340288n },
					Byron: { name: "byeoon", id: 1167275288036655133n },
					Kaitlyn: { name: "kaitlyn", id: 306158896630988801n },
					PolisanTheEasyNick: { name: "Oleh Polisan", id: 242305263313485825n },
					HAHALOSAH: { name: "HAHALOSAH", id: 903418691268513883n },
					GabiRP: { name: "GabiRP", id: 507955112027750401n },
					ImBanana: { name: "Im_Banana", id: 635250116688871425n },
					xocherry: { name: "xocherry", id: 221288171013406720n },
					ScattrdBlade: { name: "ScattrdBlade", id: 678007540608532491n },
					goodbee: { name: "goodbee", id: 658968552606400512n },
					Moxxie: { name: "Moxxie", id: 712653921692155965n },
					Ethan: { name: "Ethan", id: 721717126523781240n },
					nyx: { name: "verticalsync", id: 328165170536775680n },
					nekohaxx: { name: "nekohaxx", id: 1176270221628153886n },
					Antti: { name: "Antti", id: 312974985876471810n },
					Joona: { name: "Joona", id: 297410829589020673n },
					AshtonMemer: { name: "AshtonMemer", id: 373657230530052099n },
					surgedevs: { name: "Chloe", id: 1084592643784331324n },
					Lumap: { name: "Lumap", id: 585278686291427338n },
				})),
				(Oi = (() =>
					Object.freeze(
						Object.fromEntries(
							Object.entries(d)
								.filter((e) => e[1].id !== 0n)
								.map(([e, t]) => [t.id, t])
						)
					))());
		});
	function H(...e) {
		return e.filter(Boolean).join(" ");
	}
	function Xo(e) {
		return new Promise((t) => setTimeout(t, e));
	}
	function Kt(e, t = "Copied to clipboard!") {
		Gt.SUPPORTS_COPY
			? Gt.copy(e)
			: (t = "Your browser does not support copying to clipboard"),
			X.show({ message: t, id: X.genId(), type: X.Type.SUCCESS });
	}
	function kN(e) {
		return typeof e == "object" && e !== null && !Array.isArray(e);
	}
	function jr(e) {
		for (let t in e) if (Object.hasOwn(e, t)) return !1;
		return !0;
	}
	function DN(e) {
		try {
			return new URL(e);
		} catch {
			return null;
		}
	}
	function Fi(e) {
		return e;
	}
	function Qf(e, t, o = t + "s") {
		return e === 1 ? `${e} ${t}` : `${e} ${o}`;
	}
	function js(e, ...t) {
		return t.some((o) => o == null)
			? ""
			: e.reduce((o, r, i) => `${o}${r}${t[i] ?? ""}`, "");
	}
	function Xf(e, t) {
		try {
			let o = e();
			return o instanceof Promise ? o.catch(() => t) : o;
		} catch {
			return t;
		}
	}
	var Zf,
		LN,
		In,
		qr,
		me = g(() => {
			"use strict";
			a();
			b();
			P();
			Zf = (e) => {
				let t = e.getBoundingClientRect(),
					o = Math.max(
						document.documentElement.clientHeight,
						window.innerHeight
					);
				return !(t.bottom < 0 || t.top - o >= 0);
			};
			(LN = navigator.userAgent.includes("Mobi")),
				(In = (e) => Object.hasOwn(Oi, e));
			qr = ["arguments", "caller", "prototype"];
		});
	function pn(e, t = 5, { isIndirect: o = !1 } = {}) {
		let r = 0,
			i,
			s = () => (
				!i &&
					t > r &&
					(r++,
					(i = e()),
					!i &&
						t === r &&
						!o &&
						console.error(`makeLazy factory failed:
${e}`)),
				i
			);
		return (s.$$vencordLazyFailed = () => r === t), s;
	}
	function Dt(
		e,
		t = 5,
		o = `proxyLazy factory failed:
${e}`,
		r = "proxyLazy called on a primitive value.",
		i = !1
	) {
		let s = pn(e, t, { isIndirect: !0 }),
			l = !0;
		i || setTimeout(() => (l = !1), 0);
		let c = Object.assign(function () {}, {
				[Ho]() {
					if (!c[Go])
						if ((s.$$vencordLazyFailed() || (c[Go] = s()), c[Go]))
							typeof c[Go] == "function" &&
								(u.toString = c[Go].toString.bind(c[Go]));
						else throw new Error(typeof o == "string" ? o : o());
					return c[Go];
				},
				[Go]: void 0,
			}),
			u = new Proxy(c, {
				...EN,
				get(p, m, y) {
					if (m === Ho || m === Go) return Reflect.get(p, m, y);
					if (!i && l)
						return (
							console.warn(`Destructuring webpack finds/proxyInner/proxyLazy at top level is deprecated. For more information read https://github.com/Vendicated/Vencord/pull/2409#issue-2277161516
Consider not destructuring, using findProp or if you really need to destructure, using mapMangledModule instead.`),
							Dt(
								() => {
									let N = p[Ho]();
									return Reflect.get(N, m, N);
								},
								t,
								o,
								r,
								!0
							)
						);
					let v = p[Ho]();
					if (typeof v == "object" || typeof v == "function")
						return Reflect.get(v, m, v);
					throw new Error(r);
				},
			});
		return u;
	}
	function ON(e) {
		let t = { configurable: !0, enumerable: !1, writable: !1, value: e };
		return Object.create(String.prototype, { toString: t, valueOf: t });
	}
	var Ho,
		Go,
		EN,
		co = g(() => {
			"use strict";
			a();
			me();
			(Ho = Symbol.for("vencord.lazy.get")),
				(Go = Symbol.for("vencord.lazy.cached"));
			EN = {
				...Object.fromEntries(
					Object.getOwnPropertyNames(Reflect).map((e) => [
						e,
						(t, ...o) => Reflect[e](t[Ho](), ...o),
					])
				),
				set: (e, t, o) => {
					let r = e[Ho]();
					return Reflect.set(r, t, o, r);
				},
				ownKeys: (e) => {
					let t = Reflect.ownKeys(e[Ho]());
					for (let o of qr) t.includes(o) || t.push(o);
					return t;
				},
				getOwnPropertyDescriptor: (e, t) => {
					if (typeof t == "string" && qr.includes(t))
						return Reflect.getOwnPropertyDescriptor(e, t);
					let o = Reflect.getOwnPropertyDescriptor(e[Ho](), t);
					return o && Object.defineProperty(e, t, o), o;
				},
			};
		});
	function Kr(
		e,
		t = 5,
		o = `LazyComponent factory failed:
${e}`
	) {
		let r = pn(e, t, { isIndirect: !0 }),
			i = null,
			s = !1,
			l = (c) => {
				if (!r.$$vencordLazyFailed()) {
					let u = r();
					u != null && ((i = u), Object.assign(l, u));
				}
				return (
					i === null &&
						!s &&
						(r.$$vencordLazyFailed() && (s = !0),
						console.error(typeof o == "string" ? o : o())),
					i && n(i, { ...c })
				);
			};
		return (l[uo] = () => i), l;
	}
	var uo,
		qs = g(() => {
			"use strict";
			a();
			co();
			uo = Symbol.for("vencord.lazyComponent.inner");
		});
	var V,
		De = g(() => {
			"use strict";
			a();
			V = class {
				constructor(t, o = "white") {
					this.name = t;
					this.color = o;
				}
				static makeTitle(t, o) {
					return [
						"%c %c %s ",
						"",
						`background: ${t}; color: black; font-weight: bold; border-radius: 5px;`,
						o,
					];
				}
				_log(t, o, r, i = "") {
					console[t](
						`%c Vencord %c %c ${this.name} ${i}`,
						`background: ${o}; color: black; font-weight: bold; border-radius: 5px;`,
						"",
						`background: ${this.color}; color: black; font-weight: bold; border-radius: 5px;`,
						...r
					);
				}
				log(...t) {
					this._log("log", "#a6d189", t);
				}
				info(...t) {
					this._log("info", "#a6d189", t);
				}
				error(...t) {
					this._log("error", "#e78284", t);
				}
				errorCustomFmt(t, ...o) {
					this._log("error", "#e78284", o, t);
				}
				warn(...t) {
					this._log("warn", "#e5c890", t);
				}
				debug(...t) {
					this._log("debug", "#eebebe", t);
				}
			};
		});
	function Yt(e) {
		if (typeof e == "string") return e;
		let t = e.source.replaceAll("\\i", "[A-Za-z_$][\\w$]*");
		return new RegExp(t, e.flags);
	}
	function Ks(e, t) {
		let o = `Vencord.Plugins.plugins[${JSON.stringify(t)}]`;
		return typeof e != "function"
			? e.replaceAll("$self", o)
			: (...r) => e(...r).replaceAll("$self", o);
	}
	function jl(e, t) {
		if (e.get) {
			let o = e.get;
			e.get = function () {
				return t(o.call(this));
			};
		} else e.value && (e.value = t(e.value));
		return e;
	}
	function Ys(e, t) {
		let o = Object.getOwnPropertyDescriptors(e);
		(o.match = jl(o.match, Yt)),
			(o.replace = jl(o.replace, (r) => Ks(r, t))),
			Object.defineProperties(e, o);
	}
	function Jf(e) {
		let t = Object.getOwnPropertyDescriptors(e);
		(t.find = jl(t.find, Yt)), Object.defineProperties(e, t);
	}
	var Jo = g(() => {
		"use strict";
		a();
	});
	function _i(
		e = "Proxy inner value is undefined, setInnerValue was never called.",
		t = "proxyInner called on a primitive value. This can happen if you try to destructure a primitive at the same tick as the proxy was created.",
		o = !1
	) {
		let r = !0;
		o || setTimeout(() => (r = !1), 0);
		let i = Object.assign(function () {}, {
				[xo]: function () {
					if (i[At] == null) throw new Error(typeof e == "string" ? e : e());
					return i[At];
				},
				[At]: void 0,
			}),
			s = new Proxy(i, {
				...FN,
				get(u, p, m) {
					if (p === xo || p === At) return Reflect.get(u, p, m);
					if (r && !o && i[At] == null) {
						console.warn(`Destructuring webpack finds/proxyInner/proxyLazy at top level is deprecated. For more information read https://github.com/Vendicated/Vencord/pull/2409#issue-2277161516
Consider not destructuring, using findProp or if you really need to destructure, using mapMangledModule instead.`);
						let [v, N] = _i(e, t, !0);
						return (
							l.push((w) => {
								N(Reflect.get(w, p, w));
							}),
							v
						);
					}
					let y = u[xo]();
					if (typeof y == "object" || typeof y == "function")
						return Reflect.get(y, p, y);
					throw new Error(t);
				},
			}),
			l = [];
		function c(u) {
			(i[At] = u),
				l.forEach((p) => p(u)),
				typeof u == "function" &&
					(u[xo] == null || u[At] != null) &&
					(s.toString = u.toString.bind(u));
		}
		return [s, c];
	}
	var xo,
		At,
		FN,
		Zs = g(() => {
			"use strict";
			a();
			me();
			(xo = Symbol.for("vencord.proxyInner.get")),
				(At = Symbol.for("vencord.proxyInner.innerValue")),
				(FN = {
					...Object.fromEntries(
						Object.getOwnPropertyNames(Reflect).map((e) => [
							e,
							(t, ...o) => Reflect[e](t[xo](), ...o),
						])
					),
					set: (e, t, o) => {
						let r = e[xo]();
						return Reflect.set(r, t, o, r);
					},
					ownKeys: (e) => {
						let t = Reflect.ownKeys(e[xo]());
						for (let o of qr) t.includes(o) || t.push(o);
						return t;
					},
					getOwnPropertyDescriptor: (e, t) => {
						if (typeof t == "string" && qr.includes(t))
							return Reflect.getOwnPropertyDescriptor(e, t);
						let o = Reflect.getOwnPropertyDescriptor(e[xo](), t);
						return o && Object.defineProperty(e, t, o), o;
					},
				});
		});
	function _N(e, t, o) {
		return function (...r) {
			return [t.apply(this, r), 0];
		};
	}
	function BN(e, t, o) {
		return t;
	}
	var Y0,
		gr,
		ql = g(() => {
			"use strict";
			a();
			De();
			(Y0 = _N), (gr = BN);
		});
	var Vl = {};
	et(Vl, {
		ChunkIdsRegex: () => Xl,
		DefaultExtractAndLoadChunksRegex: () => rg,
		LazyComponentWebpack: () => J0,
		_cacheFind: () => ea,
		_cacheFindAll: () => Jl,
		_initWebpack: () => Xs,
		_resolveDiscordLoaded: () => Qs,
		cache: () => zo,
		cacheFind: () => ig,
		cacheFindAll: () => ko,
		cacheFindBulk: () => sg,
		cacheFindModuleFactory: () => Q0,
		cacheFindModuleId: () => Ui,
		extract: () => ta,
		extractAndLoadChunksLazy: () => Rn,
		factoryListeners: () => Js,
		filters: () => ne,
		find: () => _e,
		findAll: () => av,
		findBulk: () => lv,
		findByCode: () => fe,
		findByCodeLazy: () => tv,
		findByFactoryCode: () => Ql,
		findByProps: () => C,
		findByPropsLazy: () => ev,
		findComponent: () => Zr,
		findComponentByCode: () => ae,
		findComponentByCodeLazy: () => rv,
		findComponentByFields: () => Zl,
		findComponentLazy: () => nv,
		findExportedComponent: () => po,
		findExportedComponentLazy: () => iv,
		findLazy: () => V0,
		findModuleFactory: () => og,
		findModuleId: () => cv,
		findProp: () => Bi,
		findStore: () => K,
		findStoreLazy: () => ov,
		mapMangledModule: () => zt,
		mapMangledModuleLazy: () => sv,
		moduleListeners: () => Yl,
		onceDiscordLoaded: () => Yr,
		proxyLazyWebpack: () => X0,
		search: () => uv,
		searchFactories: () => Qr,
		stringMatches: () => eg,
		waitFor: () => An,
		waitForSubscriptions: () => Cn,
		webpackDependantLazy: () => Nn,
		webpackDependantLazyComponent: () => ng,
		webpackSearchHistory: () => Z0,
		wreq: () => Ht,
	});
	function Xs(e) {
		(Ht = e),
			e.c != null &&
				((zo = e.c),
				Reflect.defineProperty(e.c, Symbol.toStringTag, {
					value: "ModuleCache",
					configurable: !0,
					writable: !0,
					enumerable: !1,
				}));
	}
	function Vs(e) {
		if (e.$$vencordProps != null) {
			let t = e.$$vencordProps;
			return `${t[0]}(${t
				.slice(1)
				.map((o) => (o instanceof RegExp ? String(o) : JSON.stringify(o)))
				.join(", ")})`;
		}
		return String(e);
	}
	function tg(e) {
		let t = null,
			o = !1,
			r = (s) => (
				t === null &&
					!o &&
					((o = !0), Vf.error(typeof e == "string" ? e : e())),
				t && n(t, { ...s })
			);
		r[uo] = () => t;
		function i(s, l) {
			(t = l), Object.assign(r, s);
		}
		return [r, i];
	}
	function An(e, t, { isIndirect: o = !1 } = {}) {
		if (typeof e != "function")
			throw new Error("Invalid filter. Expected a function got " + typeof e);
		if (typeof t != "function")
			throw new Error("Invalid callback. Expected a function got " + typeof t);
		if (zo != null) {
			let { result: r, id: i, exportKey: s, factory: l } = ea(e);
			if (r != null) return t(r, { id: i, exportKey: s, factory: l });
		}
		Cn.set(e, t);
	}
	function _e(e, t = (r) => r, { isIndirect: o = !1 } = {}) {
		if (typeof e != "function")
			throw new Error("Invalid filter. Expected a function got " + typeof e);
		if (typeof t != "function")
			throw new Error(
				"Invalid find parse. Expected a function got " + typeof t
			);
		let [r, i] = _i(
			`Webpack find matched no module. Filter: ${Vs(e)}`,
			"Webpack find with proxy called on a primitive value. This can happen if you try to destructure a primitive in the top level definition of the find."
		);
		return An(e, (s) => i(t(s)), { isIndirect: !0 }), r[At] != null ? r[At] : r;
	}
	function Zr(e, t = (r) => r, { isIndirect: o = !1 } = {}) {
		if (typeof e != "function")
			throw new Error("Invalid filter. Expected a function got " + typeof e);
		if (typeof t != "function")
			throw new Error(
				"Invalid component parse. Expected a function got " + typeof t
			);
		let [r, i] = tg(`Webpack find matched no module. Filter: ${Vs(e)}`);
		return (
			An(e, (s) => i(s, t(s)), { isIndirect: !0 }),
			r[uo]() != null ? r[uo]() : r
		);
	}
	function po(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (l) => l,
			o = e,
			r = ne.byProps(...o),
			[i, s] = tg(`Webpack find matched no module. Filter: ${Vs(r)}`);
		return (
			An(r, (l) => s(l[o[0]], t(l[o[0]])), { isIndirect: !0 }),
			i[uo]() != null ? i[uo]() : i
		);
	}
	function ae(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return Zr(ne.componentByCode(...o), t, { isIndirect: !0 });
	}
	function Zl(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return Zr(ne.componentByFields(...o), t, { isIndirect: !0 });
	}
	function C(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return _e(ne.byProps(...o), t, { isIndirect: !0 });
	}
	function Bi(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return _e(ne.byProps(...o), (i) => t(i[o[0]]), { isIndirect: !0 });
	}
	function fe(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return _e(ne.byCode(...o), t, { isIndirect: !0 });
	}
	function K(e) {
		return _e(ne.byStoreName(e), (o) => o, { isIndirect: !0 });
	}
	function Ql(...e) {
		let t = typeof e.at(-1) == "function" ? e.pop() : (i) => i,
			o = e;
		return _e(ne.byFactoryCode(...o), t, { isIndirect: !0 });
	}
	function zt(e, t) {
		let o = {},
			r = {},
			i = {};
		for (let c in t) {
			let u = t[c],
				p = () =>
					`Webpack mapMangledModule ${l ? "mapper" : "factory"} filter matched no module. Filter: ${Vs(l ? u : s)}`;
			if (u.$$vencordIsComponentFilter) {
				let [m, y] = tg(p);
				(o[c] = m), (i[c] = y);
			} else {
				let [m, y] = _i(
					p,
					"Webpack find with proxy called on a primitive value. This may happen if you are trying to destructure a mapMangledModule primitive value on top level."
				);
				(o[c] = m), (r[c] = y);
			}
		}
		let s = ne.byFactoryCode(...(Array.isArray(e) ? e : [e])),
			l = !1;
		if (
			(An(
				s,
				(c) => {
					if (((l = !0), typeof c == "object"))
						for (let u in c) {
							let p = c[u];
							if (p != null)
								for (let m in t) {
									let y = t[m];
									y(p) &&
										(typeof p != "object" &&
											typeof p != "function" &&
											(o[m] = p),
										y.$$vencordIsComponentFilter ? i[m](p, p) : r[m](p));
								}
						}
				},
				{ isIndirect: !0 }
			),
			l)
		)
			for (let c in o) {
				let u = o[c];
				u[At] != null
					? (o[c] = u[At])
					: u[uo] != null && u[uo]() != null && (o[c] = u[uo]());
			}
		return o;
	}
	function og(e, { isIndirect: t = !1 } = {}) {
		let o = ne.byFactoryCode(...(Array.isArray(e) ? e : [e])),
			[r, i] = _i(
				`Webpack module factory find matched no module. Filter: ${Vs(o)}`,
				"Webpack find with proxy called on a primitive value. This can happen if you try to destructure a primitive in the top level definition of the find."
			);
		return (
			An(o, (s, { factory: l }) => i(l), { isIndirect: !0 }),
			r[At] != null ? r[At] : r
		);
	}
	function Nn(e, t) {
		return Dt(
			e,
			t,
			`Webpack dependant lazy factory failed:
${e}`,
			"Webpack dependant lazy called on a primitive value. This can happen if you try to destructure a primitive in the top level definition of the lazy."
		);
	}
	function ng(e, t) {
		return Kr(
			e,
			t,
			`Webpack dependant LazyComponent factory failed:
${e}`
		);
	}
	function Kl(e, t, ...o) {
		return Vf.warn(e, ...o), t;
	}
	function Rn(e, t = rg) {
		let o = og(e, { isIndirect: !0 });
		return pn(async () => {
			if (o[xo] != null && o[At] == null)
				return Kl(
					"extractAndLoadChunks: Couldn't find module factory",
					!1,
					"Code:",
					e,
					"Matcher:",
					t
				);
			let i = String(o).match(Yt(t));
			if (!i)
				return Kl(
					"extractAndLoadChunks: Couldn't find chunk loading in module factory code",
					!1,
					"Code:",
					e,
					"Matcher:",
					t
				);
			let [, s, l] = i;
			if (Number.isNaN(Number(l)))
				return Kl(
					"extractAndLoadChunks: Matcher didn't return a capturing group with the chunk ids array, or the entry point id returned as the second group wasn't a number",
					!1,
					"Code:",
					e,
					"Matcher:",
					t
				);
			if (s) {
				let c = Array.from(s.matchAll(Xl)).map((u) => Number(u[1]));
				await Promise.all(c.map((u) => Ht.e(u)));
			}
			return Ht.m[l] == null
				? Kl(
						"extractAndLoadChunks: Entry point is not loaded in the module factories, perhaps one of the chunks failed to load",
						!1,
						"Code:",
						e,
						"Matcher:",
						t
					)
				: (Ht(Number(l)), !0);
		});
	}
	function ig(e, t = !1) {
		let { result: o, factory: r } = ea(e);
		return t ? r : o;
	}
	function Jl(e) {
		if (typeof e != "function")
			throw new Error("Invalid filter. Expected a function got " + typeof e);
		let t = [];
		for (let o in zo) {
			let r = zo[o];
			if (!r?.loaded || r?.exports == null) continue;
			let i = Ht.m[o];
			if (e.$$vencordIsFactoryFilter) {
				e(Ht.m[o]) &&
					t.push({ result: r.exports, id: o, exportKey: null, factory: i });
				continue;
			}
			if (
				(e(r.exports) &&
					t.push({ result: r.exports, id: o, exportKey: null, factory: i }),
				typeof r.exports == "object")
			) {
				r.exports.default != null &&
					e(r.exports.default) &&
					t.push({
						result: r.exports.default,
						id: o,
						exportKey: "default ",
						factory: i,
					});
				for (let s in r.exports)
					if (s.length <= 3) {
						let l = r.exports[s];
						if (l != null && e(l)) {
							t.push({ result: l, id: o, exportKey: s, factory: i });
							break;
						}
					}
			}
		}
		return t;
	}
	function ko(e, t = !1) {
		return Jl(e).map(({ result: r, factory: i }) => (t ? i : r));
	}
	function Ui(...e) {
		return ea(ne.byFactoryCode(...e)).id;
	}
	function Qr(...e) {
		let t = ne.byFactoryCode(...e);
		return Jl(t).reduce((o, { factory: r, id: i }) => ((o[i] = r), o), {});
	}
	function ta(e) {
		let t = Ht.m[e];
		if (t == null) return null;
		let o = `
// [EXTRACTED] WebpackModule${String(e)}
// WARNING: This module was extracted to be more easily readable.
//          This module is NOT ACTUALLY USED! This means putting breakpoints will have NO EFFECT!!

0,${String(t)}
//# sourceURL=ExtractedWebpackModule${String(e)}
`;
		return (0, eval)(o);
	}
	function wo(e, t, o) {
		return (...r) => (
			Vf.warn(
				`Method ${e} is deprecated. Use ${t} instead. For more information read https://github.com/Vendicated/Vencord/pull/2409#issue-2277161516`
			),
			o(...r)
		);
	}
	var Vf,
		Qs,
		Yr,
		Ht,
		zo,
		Js,
		Yl,
		Cn,
		eg,
		ne,
		Z0,
		rg,
		Xl,
		ea,
		sg,
		Q0,
		X0,
		J0,
		V0,
		ev,
		tv,
		ov,
		nv,
		rv,
		iv,
		sv,
		av,
		lv,
		cv,
		uv,
		U = g(() => {
			"use strict";
			a();
			co();
			qs();
			De();
			Jo();
			Zs();
			ql();
			(Vf = new V("Webpack")), (Yr = new Promise((e) => (Qs = e)));
			(Js = new Set()),
				(Yl = new Set()),
				(Cn = new Map()),
				(eg = (e, t) =>
					t.every((o) =>
						typeof o == "string"
							? e.includes(o)
							: (o.global && (o.lastIndex = 0), o.test(e))
					)),
				(ne = {
					byProps: (...e) => {
						let t =
							e.length === 1
								? (o) => o?.[e[0]] !== void 0
								: (o) => e.every((r) => o?.[r] !== void 0);
						return (t.$$vencordProps = ["byProps", ...e]), t;
					},
					byCode: (...e) => {
						let t = e.map(Yt),
							o = (r) => (typeof r != "function" ? !1 : eg(String(r), t));
						return (o.$$vencordProps = ["byCode", ...e]), o;
					},
					byStoreName: (e) => {
						let t = (o) =>
							o?.constructor?.displayName === e ||
							o?.constructor?.persistKey === e;
						return (t.$$vencordProps = ["byStoreName", e]), t;
					},
					componentByFilter: (e) => ((e.$$vencordIsComponentFilter = !0), e),
					componentByCode: (...e) => {
						let t = ne.byCode(...e),
							o = (r) => {
								let i = r;
								for (; i != null; ) {
									if (t(i)) return !0;
									if (i.$$typeof)
										if (i.type) i = i.type;
										else if (i.render) i = i.render;
										else return !1;
									else return !1;
								}
								return !1;
							};
						return (
							(o.$$vencordProps = ["componentByCode", ...e]),
							(o.$$vencordIsComponentFilter = !0),
							o
						);
					},
					componentByFields: (...e) => {
						let t = ne.byProps(...e),
							o = (r) => r?.prototype?.render && t(r.prototype);
						return (
							(o.$$vencordProps = ["componentByFields", ...e]),
							(o.$$vencordIsComponentFilter = !0),
							o
						);
					},
					byFactoryCode: (...e) => {
						let t = ne.byCode(...e);
						return (
							(t.$$vencordProps = ["byFactoryCode", ...e]),
							(t.$$vencordIsFactoryFilter = !0),
							t
						);
					},
				}),
				(Z0 = []);
			(rg =
				/(?:(?:Promise\.all\(\[)?(\i\.e\("?[^)]+?"?\)[^\]]*?)(?:\]\))?|Promise\.resolve\(\))\.then\(\i\.bind\(\i,"?([^)]+?)"?\)\)/),
				(Xl = /\("([^"]+?)"\)/g);
			ea = gr("cacheFind", function (t) {
				if (typeof t != "function")
					throw new Error(
						"Invalid filter. Expected a function got " + typeof t
					);
				for (let o in zo) {
					let r = zo[o];
					if (!r?.loaded || r?.exports == null) continue;
					let i = Ht.m[o];
					if (t.$$vencordIsFactoryFilter) {
						if (t(Ht.m[o]))
							return { result: r.exports, id: o, exportKey: null, factory: i };
						continue;
					}
					if (t(r.exports))
						return { result: r.exports, id: o, exportKey: null, factory: i };
					if (typeof r.exports == "object") {
						if (r.exports.default != null && t(r.exports.default))
							return {
								result: r.exports.default,
								id: o,
								exportKey: "default ",
								factory: i,
							};
						for (let s in r.exports)
							if (s.length <= 3) {
								let l = r.exports[s];
								if (l != null && t(l))
									return { result: l, id: o, exportKey: s, factory: i };
							}
					}
				}
				return {};
			});
			(sg = gr("cacheFindBulk", function (...t) {
				if (!Array.isArray(t))
					throw new Error(
						"Invalid filters. Expected function[] got " + typeof t
					);
				let { length: o } = t;
				if (o === 0) throw new Error("Expected at least two filters.");
				if (o === 1) return [ig(t[0])];
				let r = 0,
					i = Array(o),
					s = [...t];
				e: for (let l in zo) {
					let c = zo[l];
					if (!(!c?.loaded || c?.exports == null))
						for (let u = 0; u < o; u++) {
							let p = s[u];
							if (p != null) {
								if (p.$$vencordIsFactoryFilter) {
									if (
										p(Ht.m[l]) &&
										((i[u] = c.exports), (s[u] = void 0), ++r === o)
									)
										break e;
									break;
								}
								if (p(c.exports)) {
									if (((i[u] = c.exports), (s[u] = void 0), ++r === o)) break e;
									break;
								}
								if (typeof c.exports != "object") break;
								if (c.exports.default != null && p(c.exports.default)) {
									if (((i[u] = c.exports.default), (s[u] = void 0), ++r === o))
										break e;
									continue;
								}
								for (let m in c.exports)
									if (m.length <= 3) {
										let y = c.exports[m];
										if (y != null && p(c.exports[l])) {
											if (((i[u] = y), (s[u] = void 0), ++r === o)) break e;
											break;
										}
									}
							}
						}
				}
				return i;
			})),
				(Q0 = gr("cacheFindModuleFactory", function (...t) {
					let o = Ui(...t);
					if (o != null) return Ht.m[o];
				}));
			(X0 = wo("proxyLazyWebpack", "webpackDependantLazy", Nn)),
				(J0 = wo("LazyComponentWebpack", "webpackDependantLazyComponent", ng)),
				(V0 = wo("findLazy", "find", _e)),
				(ev = wo("findByPropsLazy", "findByProps", C)),
				(tv = wo("findByCodeLazy", "findByCode", fe)),
				(ov = wo("findStoreLazy", "findStore", K)),
				(nv = wo("findComponentLazy", "findComponent", Zr)),
				(rv = wo("findComponentByCodeLazy", "findComponentByCode", ae)),
				(iv = wo("findExportedComponentLazy", "findExportedComponent", po)),
				(sv = wo("mapMangledModuleLazy", "mapMangledModule", zt)),
				(av = wo("findAll", "cacheFindAll", ko)),
				(lv = wo("findBulk", "cacheFindBulk", sg)),
				(cv = wo("findModuleId", "cacheFindModuleId", Ui)),
				(uv = wo("search", "searchFactories", Qr));
		});
	var ec,
		tc,
		pv = g(() => {
			"use strict";
			a();
			U();
			(ec = _e((e) => e.image && e.modal && !e.applicationIcon)),
				(tc = C("buttonWrapper", "buttonContent"));
		});
	function pt(e, t) {
		let o = Object.assign({ fallbackValue: null, deps: [], onError: null }, t),
			[r, i] = z({ value: o.fallbackValue, error: null, pending: !0 });
		return (
			ue(() => {
				let s = !0;
				return (
					r.pending || i({ ...r, pending: !0 }),
					e()
						.then((l) => {
							!s ||
								(i({ value: l, error: null, pending: !1 }), o.onSuccess?.(l));
						})
						.catch((l) => {
							!s || (i({ value: null, error: l, pending: !1 }), o.onError?.(l));
						}),
					() => void (s = !1)
				);
			}, o.deps),
			[r.value, r.error, r.pending]
		);
	}
	function Wo(e) {
		let t = $i((o) => o + 1, 0);
		return e ? t : t[1];
	}
	function oa({ interval: e = 1e3, deps: t = [] }) {
		let [o, r] = z(0),
			i = dt(() => Date.now(), t);
		return (
			ue(() => {
				let s = setInterval(() => r(Date.now() - i), e);
				return () => {
					r(0), clearInterval(s);
				};
			}, t),
			o
		);
	}
	var Be,
		UN,
		ct = g(() => {
			"use strict";
			a();
			b();
			me();
			qs();
			(Be = () => null),
				(UN = (e = !1) => {
					let t = q.useRef(null),
						[o, r] = z(!1);
					return [
						(s) => {
							t.current?.disconnect(),
								(t.current = null),
								s &&
									((Zf(s) && (r(!0), e)) ||
										((t.current = new IntersectionObserver((l) => {
											for (let c of l)
												c.target === s &&
													(c.isIntersecting && e
														? (r(!0),
															t.current?.disconnect(),
															(t.current = null))
														: r(c.isIntersecting));
										})),
										t.current.observe(s)));
						},
						o,
					];
				});
		});
	var Nt,
		M,
		Vt,
		te,
		hr,
		mt,
		na,
		Z,
		oc,
		Do,
		nc,
		Xr,
		rc,
		Jr,
		ic,
		mo,
		sc,
		Gi,
		Hi,
		zi,
		ra,
		ia,
		Vr,
		Zt,
		Wi,
		ei,
		S,
		dv = g(() => {
			"use strict";
			a();
			ct();
			U();
			(Nt = Be),
				(M = Be),
				(Vt = Be),
				(te = Be),
				(hr = Be),
				(mt = Be),
				(na = Be),
				(Z = Be),
				(oc = Be),
				(Do = Be),
				(nc = Be),
				(Xr = Be),
				(Jr = Be),
				(ic = Be),
				(mo = Be),
				(sc = Be),
				(Gi = Be),
				(Hi = Be),
				(zi = Be),
				(ra = Be),
				(Vr = ae("MASKED_LINK)")),
				(Zt = ae(".Messages.MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL.format")),
				(Wi = Zr(ne.byProps("Justify", "Align", "Wrap"))),
				(ei = po("OAuth2AuthorizeModal")),
				(S = C(
					"FormItem",
					"Button",
					(e) => (
						({
							useToken: ia,
							Card: Nt,
							Button: M,
							FormSwitch: Vt,
							Tooltip: te,
							TooltipContainer: hr,
							TextInput: mt,
							TextArea: na,
							Text: Z,
							Select: Do,
							SearchableSelect: nc,
							Slider: Xr,
							ButtonLooks: rc,
							TabBar: mo,
							Popout: Jr,
							Dialog: ic,
							Paginator: sc,
							ScrollerThin: Gi,
							Clickable: Hi,
							Avatar: zi,
							FocusLock: ra,
							Heading: oc,
						} = e),
						e
					)
				));
		});
	var E,
		Qt,
		mv = g(() => {
			"use strict";
			a();
			U();
			(E = C("MenuItem", "MenuSliderControl")),
				(Qt = zt('type:"CONTEXT_MENU_OPEN', {
					closeContextMenu: ne.byCode("CONTEXT_MENU_CLOSE"),
					openContextMenu: ne.byCode("renderLazy:"),
					openContextMenuLazy: (e) =>
						typeof e == "function" && String(e).length < 100,
				}));
		});
	var z,
		ue,
		dt,
		St,
		$i,
		ac,
		ti,
		q,
		fv = g(() => {
			"use strict";
			a();
			U();
			(ti = C("createPortal", "render")),
				(q = C(
					"useState",
					(e) => (
						({
							useEffect: ue,
							useState: z,
							useMemo: dt,
							useRef: St,
							useReducer: $i,
							useCallback: ac,
						} = e),
						e
					)
				));
		});
	var oi,
		Wt,
		sa,
		qe,
		yr,
		ji,
		kn,
		jt,
		le,
		D,
		eo,
		xe,
		to,
		oe,
		Le,
		Ie,
		dn,
		lc,
		cc,
		Oe,
		gv = g(() => {
			"use strict";
			a();
			U();
			(oi = C("connectStores")),
				(Wt = C("ChannelMessage", "SlashCommand")),
				(sa = C("openPrivateChannel")),
				(qe = K("PermissionStore")),
				(yr = K("GuildChannelStore")),
				(ji = K("ReadStateStore")),
				(kn = K("PresenceStore")),
				(jt = K("MessageStore")),
				(le = K("GuildStore")),
				(D = K("UserStore")),
				(eo = K("UserProfileStore")),
				(xe = K("SelectedChannelStore")),
				(to = K("SelectedGuildStore")),
				(oe = K("ChannelStore")),
				(Le = K("GuildMemberStore")),
				(Ie = K("RelationshipStore")),
				(dn = K("EmojiStore")),
				(lc = K("WindowStore")),
				(cc = K("DraftStore")),
				(Oe = fe("useStateFromStores"));
		});
	var hv = {};
	var yv = g(() => {
		"use strict";
		a();
	});
	var vv = {};
	var Sv = g(() => {
		"use strict";
		a();
	});
	var lg = {};
	et(lg, { DisplayProfile: () => ag });
	var ag,
		bv = g(() => {
			"use strict";
			a();
			ag = class {
				userId;
				banner;
				bio;
				pronouns;
				accentColor;
				themeColors;
				popoutAnimationParticleType;
				profileEffectId;
				_userProfile;
				_guildMemberProfile;
				canUsePremiumProfileCustomization;
				canEditThemes;
				premiumGuildSince;
				premiumSince;
				premiumType;
				primaryColor;
			};
		});
	var aa,
		Tv = g(() => {
			"use strict";
			a();
			U();
			aa = {
				FrecencyUserSettingsActionCreators: _e((e) =>
					e.ProtoClass?.typeName?.endsWith(".FrecencyUserSettings")
				),
				PreloadedUserSettingsActionCreators: _e((e) =>
					e.ProtoClass?.typeName?.endsWith(".PreloadedUserSettings")
				),
			};
		});
	function ft(e, t = xv.MESSAGE, o) {
		X.show(X.create(e, t, o));
	}
	var _,
		Vo,
		bt,
		Pt,
		vr,
		$N,
		ni,
		Se,
		Po,
		Ce,
		Tt,
		xv,
		GN,
		X,
		oo,
		ri,
		la,
		ii,
		Gt,
		en,
		ca,
		we,
		si,
		cg,
		Mo,
		uc,
		ug,
		pg,
		Rt,
		ua,
		HN,
		zN,
		WN,
		wv = g(() => {
			"use strict";
			a();
			U();
			(_ = C("dispatch", "subscribe", (e) => {
				Vencord.Plugins.subscribeAllPluginsFluxEvents(e);
				let t = () => {
					e.unsubscribe("CONNECTION_OPEN", t), Qs();
				};
				return e.subscribe("CONNECTION_OPEN", t), e;
			})),
				(Vo = C("dispatchToLastSubscribed")),
				(bt = zt('ME:"/users/@me"', {
					Endpoints: ne.byProps("USER", "ME"),
					UserFlags: ne.byProps("STAFF", "SPAMMER"),
					FriendsSections: (e) => e.PENDING === "PENDING" && e.ADD_FRIEND,
				})),
				(Pt = _e((e) => typeof e == "object" && e.del && e.put)),
				(vr = C("parseTwoDigitYear")),
				($N = C("highlight", "registerLanguage")),
				(ni = C("debounce", "cloneDeep")),
				(Se = _e((e) => e.Messages?.["en-US"])),
				(Po = C("fromTimestamp", "extractTimestamp")),
				(Ce = C("parseTopic")),
				(Tt = C("show", "close")),
				(xv = { MESSAGE: 0, SUCCESS: 1, FAILURE: 2, CUSTOM: 3 }),
				(GN = { TOP: 0, BOTTOM: 1 }),
				(X = {
					Type: xv,
					Position: GN,
					genId: () => (Math.random() || Math.random()).toString(36).slice(2),
				});
			An(ne.byProps("showToast"), (e) => {
				(X.show = e.showToast),
					(X.pop = e.popToast),
					(X.create = e.createToast);
			});
			(oo = { getUser: fe(".USER(") }),
				(ri = C("clearAll", "addFile")),
				(la = { promptToUpload: fe(".ATTACHMENT_TOO_MANY_ERROR_TITLE,") }),
				(ii = C("fetchAssetIds", "getAssetImage")),
				(Gt = zt('queryCommandEnabled("copy")', {
					copy: ne.byCode(".copy("),
					SUPPORTS_COPY: (e) => typeof e == "boolean",
				})),
				(en = zt("Transitioning to ", {
					transitionTo: ne.byCode("transitionTo -"),
					transitionToGuild: ne.byCode("transitionToGuild -"),
					back: ne.byCode("goBack()"),
					forward: ne.byCode("goForward()"),
				})),
				(ca = C("open", "saveAccountChanges")),
				(we = _e((e) => typeof e.ADMINISTRATOR == "bigint")),
				(si = fe("will be removed in v4")),
				(cg = fe("[zustand persist middleware]")),
				(Mo = C("editMessage", "sendMessage")),
				(uc = C("clearCache", "_channelMessages")),
				(ug = C("openUserProfileModal", "closeUserProfileModal")),
				(pg = C("resolveInvite")),
				(Rt = C("getGuildBannerURL", "getUserAvatarURL")),
				(ua = zt("expression-picker-last-active-view", {
					openExpressionPicker: ne.byCode(
						/setState\({activeView:(?:(?!null)\i),activeViewType:/
					),
					closeExpressionPicker: ne.byCode("setState({activeView:null"),
					toggleMultiExpressionPicker: ne.byCode(".EMOJI,"),
					toggleExpressionPicker: ne.byCode(
						/getState\(\)\.activeView===\i\?\i\(\):\i\(/
					),
					setExpressionPickerView: ne.byCode(
						/setState\({activeView:\i,lastActiveView:/
					),
					setSearchQuery: ne.byCode("searchQuery:"),
					useExpressionPickerStore: ne.byCode("Object.is"),
				})),
				(HN = zt('type:"POPOUT_WINDOW_OPEN"', {
					open: ne.byCode('type:"POPOUT_WINDOW_OPEN"'),
					close: ne.byCode('type:"POPOUT_WINDOW_CLOSE"'),
					setAlwaysOnTop: ne.byCode('type:"POPOUT_WINDOW_SET_ALWAYS_ON_TOP"'),
				})),
				(zN = C("useName", "getGlobalName")),
				(WN = zt(/=\i\.getUserProfile\(\i\),\i=\i\.getGuildMemberProfile\(/, {
					getDisplayProfile: ne.byCode(".getGuildMemberProfile("),
					useDisplayProfile: ne.byCode(/\[\i\.\i,\i\.\i],\(\)=>/),
				}));
		});
	var qi = {};
	et(qi, {
		Alerts: () => Tt,
		ApplicationAssetUtils: () => ii,
		Avatar: () => zi,
		Button: () => M,
		ButtonLooks: () => rc,
		ButtonWrapperClasses: () => tc,
		Card: () => Nt,
		ChannelStore: () => oe,
		Clickable: () => Hi,
		Clipboard: () => Gt,
		ComponentDispatch: () => Vo,
		ComponentTypes: () => hv,
		Constants: () => bt,
		ContextMenuApi: () => Qt,
		Dialog: () => ic,
		DisplayProfileUtils: () => WN,
		DraftStore: () => cc,
		DraftType: () => Wt,
		EmojiStore: () => dn,
		ExpressionPickerStore: () => ua,
		Flex: () => Wi,
		Flux: () => oi,
		FluxDispatcher: () => _,
		FocusLock: () => ra,
		Forms: () => S,
		GuildChannelStore: () => yr,
		GuildMemberStore: () => Le,
		GuildStore: () => le,
		Heading: () => oc,
		IconUtils: () => Rt,
		InviteActions: () => pg,
		MaskedLink: () => Vr,
		Menu: () => E,
		MenuTypes: () => vv,
		MessageActions: () => Mo,
		MessageCache: () => uc,
		MessageStore: () => jt,
		ModalImageClasses: () => ec,
		NavigationRouter: () => en,
		OAuth2AuthorizeModal: () => ei,
		Paginator: () => sc,
		Parser: () => Ce,
		PermissionStore: () => qe,
		PermissionsBits: () => we,
		Popout: () => Jr,
		PopoutActions: () => HN,
		PresenceStore: () => kn,
		PrivateChannelsStore: () => sa,
		React: () => q,
		ReactDOM: () => ti,
		ReadStateStore: () => ji,
		RelationshipStore: () => Ie,
		RestAPI: () => Pt,
		ScrollerThin: () => Gi,
		SearchableSelect: () => nc,
		Select: () => Do,
		SelectedChannelStore: () => xe,
		SelectedGuildStore: () => to,
		SettingsRouter: () => ca,
		Slider: () => Xr,
		SnowflakeUtils: () => Po,
		Switch: () => Vt,
		TabBar: () => mo,
		Text: () => Z,
		TextArea: () => na,
		TextInput: () => mt,
		Timestamp: () => Zt,
		Toasts: () => X,
		Tooltip: () => te,
		TooltipContainer: () => hr,
		UploadHandler: () => la,
		UploadManager: () => ri,
		UserProfileActions: () => ug,
		UserProfileStore: () => eo,
		UserSettingsActionCreators: () => aa,
		UserStore: () => D,
		UserUtils: () => oo,
		UsernameUtils: () => zN,
		UtilTypes: () => lg,
		WindowStore: () => lc,
		hljs: () => $N,
		i18n: () => Se,
		lodash: () => ni,
		moment: () => vr,
		showToast: () => ft,
		useCallback: () => ac,
		useEffect: () => ue,
		useMemo: () => dt,
		useReducer: () => $i,
		useRef: () => St,
		useState: () => z,
		useStateFromStores: () => Oe,
		useToken: () => ia,
		zustandCreate: () => si,
		zustandPersist: () => cg,
	});
	var b = g(() => {
		"use strict";
		a();
		pv();
		dv();
		mv();
		fv();
		gv();
		yv();
		Sv();
		bv();
		Tv();
		wv();
	});
	function pa(e, t) {
		return pc.openModalLazy(e, t);
	}
	function ge(e, t, o) {
		return pc.openModal(e, t, o);
	}
	function Dn(e, t) {
		return pc.closeModal(e, t);
	}
	function mn() {
		return pc.closeAllModals();
	}
	var Io,
		Te,
		Ee,
		Ae,
		ht,
		rt,
		Ki,
		dg,
		pc,
		Ke = g(() => {
			"use strict";
			a();
			U();
			ct();
			(Io = ((i) => (
				(i.SMALL = "small"),
				(i.MEDIUM = "medium"),
				(i.LARGE = "large"),
				(i.DYNAMIC = "dynamic"),
				i
			))(Io || {})),
				(Te = Be),
				(Ee = Be),
				(Ae = Be),
				(ht = Be),
				(rt = Be),
				(Ki = C(
					"ModalRoot",
					"ModalCloseButton",
					(e) => (
						({
							ModalRoot: Te,
							ModalHeader: Ee,
							ModalContent: Ae,
							ModalFooter: ht,
							ModalCloseButton: rt,
						} = e),
						e
					)
				)),
				(dg = ae(".MEDIA_MODAL_CLOSE", "responsive")),
				(pc = C("openModalLazy"));
		});
	async function ai(e) {
		let { invite: t } = await pg.resolveInvite(e, "Desktop Modal");
		if (!t) throw new Error("Invalid invite: " + e);
		return (
			_.dispatch({
				type: "INVITE_MODAL_OPEN",
				invite: t,
				code: e,
				context: "APP",
			}),
			new Promise((o) => {
				let r,
					i,
					s = !1;
				_.subscribe(
					"INVITE_ACCEPT",
					(i = () => {
						s = !0;
					})
				),
					_.subscribe(
						"INVITE_MODAL_CLOSE",
						(r = () => {
							_.unsubscribe("INVITE_MODAL_CLOSE", r),
								_.unsubscribe("INVITE_ACCEPT", i),
								o(s);
						})
					);
			})
		);
	}
	function fn() {
		return oe.getChannel(xe.getChannelId());
	}
	function li() {
		return le.getGuild(fn()?.guild_id);
	}
	function jN(e) {
		sa.openPrivateChannel(e);
	}
	function Sr() {
		return aa.PreloadedUserSettingsActionCreators.getCurrentValue()?.appearance
			?.theme;
	}
	function ci(e) {
		Vo.dispatchToLastSubscribed("INSERT_TEXT", { rawText: e, plainText: e });
	}
	function dc(e, t, o, r) {
		let i = {
			content: "",
			invalidEmojis: [],
			tts: !1,
			validNonShortcutEmojis: [],
			...t,
		};
		return Mo.sendMessage(e, i, o, r);
	}
	function Lo(e, t) {
		return ge((o) =>
			n(
				Te,
				{ ...o, className: ec.modal, size: "dynamic" },
				n(dg, {
					className: ec.image,
					original: e,
					placeholder: e,
					src: e,
					renderLinkComponent: (r) => n(Vr, { ...r }),
					renderForwardComponent: () => null,
					shouldHideMediaOptions: !1,
					shouldAnimate: !0,
					...t,
				})
			)
		);
	}
	async function Eo(e) {
		if (!(await oo.getUser(e))) throw new Error("No such user: " + e);
		let o = to.getGuildId();
		ug.openUserProfileModal({
			userId: e,
			guildId: o,
			channelId: xe.getChannelId(),
			analyticsLocation: {
				page: o ? "Guild Channel" : "DM Channel",
				section: "Profile Popout",
			},
		});
	}
	async function mg(e, t) {
		let o = eo.getUserProfile(e);
		if (o) return o;
		_.dispatch({ type: "USER_PROFILE_FETCH_START", userId: e });
		let { body: r } = await Pt.get({
			url: bt.Endpoints.USER_PROFILE(e),
			query: { with_mutual_guilds: !1, with_mutual_friends_count: !1, ...t },
			oldFormErrors: !0,
		});
		return (
			_.dispatch({ type: "USER_UPDATE", user: r.user }),
			await _.dispatch({ type: "USER_PROFILE_FETCH_SUCCESS", ...r }),
			t?.guild_id &&
				r.guild_member &&
				_.dispatch({
					type: "GUILD_MEMBER_PROFILE_UPDATE",
					guildId: t.guild_id,
					guildMember: r.guild_member,
				}),
			eo.getUserProfile(e)
		);
	}
	function Ln(e) {
		return e.discriminator === "0" ? e.username : e.tag;
	}
	var da,
		it = g(() => {
			"use strict";
			a();
			b();
			Ke();
			da = ((o) => (
				(o[(o.Dark = 1)] = "Dark"), (o[(o.Light = 2)] = "Light"), o
			))(da || {});
		});
	function mc(e) {
		return Boolean(e);
	}
	function En(e) {
		return e != null;
	}
	var Yi = g(() => {
		"use strict";
		a();
	});
	var ui,
		fc = g(() => {
			"use strict";
			a();
			({ localStorage: ui } = window);
		});
	var Pv,
		G,
		Ye = g(() => {
			"use strict";
			a();
			(Pv = ""), (G = {});
			for (let e of ["top", "bottom", "left", "right"])
				for (let t of [8, 16, 20]) {
					let o = `vc-m-${e}-${t}`;
					(G[`${e}${t}`] = o), (Pv += `.${o}{margin-${e}:${t}px;}`);
				}
			document.addEventListener(
				"DOMContentLoaded",
				() =>
					document.head.append(
						Object.assign(document.createElement("style"), {
							textContent: Pv,
							id: "vencord-margins",
						})
					),
				{ once: !0 }
			);
		});
	function Zi(e, t) {
		for (let o in t) {
			let r = t[o];
			typeof r == "object" && !Array.isArray(r)
				? ((e[o] ??= {}), Zi(e[o], r))
				: (e[o] ??= r);
		}
		return e;
	}
	var gc = g(() => {
		"use strict";
		a();
	});
	function pi(e) {
		let t = !1,
			o;
		return function () {
			return t ? o : ((t = !0), (o = e.apply(this, arguments)));
		};
	}
	var ma = g(() => {
		"use strict";
		a();
	});
	var Oo,
		di = g(() => {
			"use strict";
			a();
			Oo = class {
				constructor(t = 1 / 0) {
					this.maxSize = t;
				}
				queue = [];
				promise;
				next() {
					let t = this.queue.shift();
					t
						? (this.promise = Promise.resolve()
								.then(t)
								.finally(() => this.next()))
						: (this.promise = void 0);
				}
				run() {
					this.promise || this.next();
				}
				push(t) {
					this.size >= this.maxSize && this.queue.shift(),
						this.queue.push(t),
						this.run();
				}
				unshift(t) {
					this.size >= this.maxSize && this.queue.pop(),
						this.queue.unshift(t),
						this.run();
				}
				get size() {
					return this.queue.length;
				}
			};
		});
	function Mv(e, t, o) {
		return o === !1 ? (t ? e.slice(0, -1) : e) : e[0];
	}
	function ga(e, t, o = !1) {
		let r = vr.duration(e, t),
			i = e5.map((u) => ({ amount: r[u](), unit: u })),
			s = 0;
		e: for (let u = 0; u < i.length; u++)
			if (!(i[u].amount === 0 || !(u + 1 < i.length))) {
				for (let p = u + 1; p < i.length; p++)
					if (i[p].amount !== 0) continue e;
				s = i.length - (u + 1);
			}
		i = s === 0 ? i : i.slice(0, -s);
		let l = i.findIndex(({ unit: u }) => u === "days");
		if (l !== -1) {
			let u = i[l],
				p = u.amount % 7;
			p === 0 ? i.splice(l, 1) : (u.amount = p);
		}
		let c = "";
		for (; i.length; ) {
			let { amount: u, unit: p } = i.shift();
			c.length && (c += i.length ? ", " : " and "),
				(u > 0 || c.length) && (c += `${u} ${Mv(p, u === 1, o)}`);
		}
		return c.length ? c : `0 ${Mv(t, !1, o)}`;
	}
	function t5(e, t = (o) => o) {
		let { length: o } = e;
		if (o === 0) return "";
		if (o === 1) return t(e[0]);
		let r = "";
		for (let i = 0; i < o; i++)
			(r += t(e[i])), o - i > 2 ? (r += ", ") : o - i > 1 && (r += " and ");
		return r;
	}
	function fi(e, t) {
		let o = "```";
		return `${o}${t || ""}
${e.replaceAll("```", "\\`\\`\\`")}
${o}`;
	}
	function o5(e, ...t) {
		let o = String.raw({ raw: e }, ...t),
			r = o.match(/^[ \t]*(?=\S)/gm);
		if (!r) return o.trim();
		let i = r.reduce((s, l) => Math.min(s, l.length), 1 / 0);
		return o.replace(new RegExp(`^[ \\t]{${i}}`, "gm"), "").trim();
	}
	function n5(e) {
		return "``" + fa + e.replaceAll("`", fa + "`" + fa) + fa + "``";
	}
	var fg,
		qN,
		KN,
		YN,
		ZN,
		QN,
		XN,
		JN,
		VN,
		mi,
		e5,
		fa,
		On = g(() => {
			"use strict";
			a();
			b();
			(fg = (e) => e.split(/(?=[A-Z])/).map((t) => t.toLowerCase())),
				(qN = (e) => e.toLowerCase().split("_")),
				(KN = (e) => e.toLowerCase().split("-")),
				(YN = (e) => e.split(/(?=[A-Z])/).map((t) => t.toLowerCase())),
				(ZN = (e) => e.toLowerCase().split(" ")),
				(QN = (e) =>
					e.map((t, o) => (o ? t[0].toUpperCase() + t.slice(1) : t)).join("")),
				(XN = (e) => e.join("_").toUpperCase()),
				(JN = (e) => e.join("-").toLowerCase()),
				(VN = (e) => e.map((t) => t[0].toUpperCase() + t.slice(1)).join("")),
				(mi = (e) => e.map((t) => t[0].toUpperCase() + t.slice(1)).join(" ")),
				(e5 = [
					"years",
					"months",
					"weeks",
					"days",
					"hours",
					"minutes",
					"seconds",
				]);
			fa = "\u200B";
		});
	var Rv = g(() => {});
	function Fo(e) {
		return n(
			"div",
			{ ...e, className: H(e.className, "vc-error-card") },
			e.children
		);
	}
	var gi = g(() => {
		"use strict";
		a();
		Rv();
		me();
	});
	var c5,
		kv,
		Dv,
		yg,
		R,
		re = g(() => {
			"use strict";
			a();
			De();
			Ye();
			ct();
			b();
			gi();
			(c5 = "#e78284"),
				(kv = new V("React ErrorBoundary", c5)),
				(Dv = {}),
				(yg = Kr(
					() =>
						class extends q.PureComponent {
							state = { error: Dv, stack: "", message: "" };
							static getDerivedStateFromError(t) {
								let o = t?.stack ?? "",
									r = t?.message || String(t);
								if (t instanceof Error && o) {
									let i = o.indexOf(`
`);
									i !== -1 &&
										((r = o.slice(0, i)),
										(o = o
											.slice(i + 1)
											.replace(/https:\/\/\S+\/assets\//g, "")));
								}
								return { error: t, stack: o, message: r };
							}
							componentDidCatch(t, o) {
								this.props.onError?.({
									error: t,
									errorInfo: o,
									props: this.props.wrappedProps,
								}),
									kv.error(
										`A component threw an Error
`,
										t
									),
									kv.error("Component Stack", o.componentStack);
							}
							render() {
								if (this.state.error === Dv) return this.props.children;
								if (this.props.noop) return null;
								if (this.props.fallback)
									return n(this.props.fallback, {
										children: this.props.children,
										...this.state,
									});
								let t =
									this.props.message ||
									"An error occurred while rendering this Component. More info can be found below and in your console.";
								return n(
									Fo,
									{ style: { overflow: "hidden" } },
									n("h1", null, "Oh no!"),
									n("p", null, t),
									n(
										"code",
										null,
										this.state.message,
										!!this.state.stack &&
											n("pre", { className: G.top8 }, this.state.stack)
									)
								);
							}
						}
				));
			yg.wrap = (e, t) => (o) =>
				n(yg, { ...t, wrappedProps: o }, n(e, { ...o }));
			R = yg;
		});
	var Lv = g(() => {});
	function ha() {
		return n(
			"svg",
			{
				"aria-hidden": "true",
				height: "16",
				viewBox: "0 0 16 16",
				width: "16",
				style: { marginRight: "0.5em", transform: "translateY(2px)" },
			},
			n("path", {
				fill: "#db61a2",
				"fill-rule": "evenodd",
				d: "M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 008 13.393a20.561 20.561 0 003.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 01-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5zM8 14.25l-.345.666-.002-.001-.006-.003-.018-.01a7.643 7.643 0 01-.31-.17 22.075 22.075 0 01-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.08 22.08 0 01-3.744 2.584l-.018.01-.006.003h-.002L8 14.25zm0 0l.345.666a.752.752 0 01-.69 0L8 14.25z",
			})
		);
	}
	var yc = g(() => {
		"use strict";
		a();
	});
	function ya(e) {
		return n(
			M,
			{
				...e,
				look: M.Looks.LINK,
				color: M.Colors.TRANSPARENT,
				onClick: () =>
					VencordNative.native.openExternal(
						"https://github.com/sponsors/Vendicated"
					),
			},
			n(ha, null),
			"Donate"
		);
	}
	var vc = g(() => {
		"use strict";
		a();
		b();
		yc();
	});
	function pe(e) {
		return (
			(e.style ??= {}),
			(e.style.display = "flex"),
			(e.style.gap ??= "1em"),
			(e.style.flexDirection ||= e.flexDirection),
			delete e.flexDirection,
			n("div", { ...e }, e.children)
		);
	}
	var kt = g(() => {
		"use strict";
		a();
	});
	var Ev = g(() => {});
	var Sc,
		Ov = g(() => {
			"use strict";
			a();
			Sc = class {
				pathListeners = new Map();
				globalListeners = new Set();
				constructor(t, o = {}) {
					(this.plain = t),
						(this.store = this.makeProxy(t)),
						Object.assign(this, o);
				}
				makeProxy(t, o = t, r = "") {
					let i = this;
					return new Proxy(t, {
						get(s, l) {
							let c = s[l];
							return (
								!(l in s) &&
									i.getDefaultValue &&
									(c = i.getDefaultValue({
										target: s,
										key: l,
										root: o,
										path: r,
									})),
								typeof c == "object" && c !== null && !Array.isArray(c)
									? i.makeProxy(c, o, `${r}${r && "."}${l}`)
									: c
							);
						},
						set(s, l, c) {
							if (s[l] === c) return !0;
							Reflect.set(s, l, c);
							let u = `${r}${r && "."}${l}`;
							return (
								i.globalListeners.forEach((p) => p(c, u)),
								i.pathListeners.get(u)?.forEach((p) => p(c)),
								!0
							);
						},
					});
				}
				setData(t, o) {
					if (this.readOnly) throw new Error("SettingsStore is read-only");
					if (((this.plain = t), (this.store = this.makeProxy(t)), o)) {
						let r = t,
							i = o.split(".");
						for (let s of i) {
							if (!r) {
								console.warn(
									`Settings#setData: Path ${o} does not exist in new data. Not dispatching update`
								);
								return;
							}
							r = r[s];
						}
						this.pathListeners.get(o)?.forEach((s) => s(r));
					}
					this.markAsChanged();
				}
				addGlobalChangeListener(t) {
					this.globalListeners.add(t);
				}
				addChangeListener(t, o) {
					let r = this.pathListeners.get(t) ?? new Set();
					r.add(o), this.pathListeners.set(t, r);
				}
				removeGlobalChangeListener(t) {
					this.globalListeners.delete(t);
				}
				removeChangeListener(t, o) {
					let r = this.pathListeners.get(t);
					!r || (r.delete(o), r.size || this.pathListeners.delete(t));
				}
				markAsChanged() {
					this.globalListeners.forEach((t) => t(this.plain, ""));
				}
			};
		});
	var Fv = g(() => {});
	var bc,
		vg = g(() => {
			"use strict";
			a();
			Fv();
			F();
			re();
			me();
			b();
			bc = R.wrap(
				function ({
					title: t,
					body: o,
					richBody: r,
					color: i,
					icon: s,
					onClick: l,
					onClose: c,
					image: u,
					permanent: p,
					className: m,
					dismissOnClick: y,
				}) {
					let { timeout: v, position: N } = Mt([
							"notifications.timeout",
							"notifications.position",
						]).notifications,
						w = Oe([lc], () => lc.isFocused()),
						[I, A] = z(!1),
						[L, k] = z(0),
						$ = dt(() => Date.now(), [v, I, w]);
					ue(() => {
						if (I || !w || v === 0 || p) return void k(0);
						let Q = setInterval(() => {
							let ee = Date.now() - $;
							ee >= v ? c() : k(ee);
						}, 10);
						return () => clearInterval(Q);
					}, [v, I, w]);
					let j = L / v;
					return n(
						"button",
						{
							className: H("vc-notification-root", m),
							style:
								N === "bottom-right" ? { bottom: "1rem" } : { top: "3rem" },
							onClick: () => {
								l?.(), y !== !1 && c();
							},
							onContextMenu: (Q) => {
								Q.preventDefault(), Q.stopPropagation(), c();
							},
							onMouseEnter: () => A(!0),
							onMouseLeave: () => A(!1),
						},
						n(
							"div",
							{ className: "vc-notification" },
							s &&
								n("img", {
									className: "vc-notification-icon",
									src: s,
									alt: "",
								}),
							n(
								"div",
								{ className: "vc-notification-content" },
								n(
									"div",
									{ className: "vc-notification-header" },
									n("h2", { className: "vc-notification-title" }, t),
									n(
										"button",
										{
											className: "vc-notification-close-btn",
											onClick: (Q) => {
												Q.preventDefault(), Q.stopPropagation(), c();
											},
										},
										n(
											"svg",
											{
												width: "24",
												height: "24",
												viewBox: "0 0 24 24",
												role: "img",
												"aria-labelledby": "vc-notification-dismiss-title",
											},
											n(
												"title",
												{ id: "vc-notification-dismiss-title" },
												"Dismiss Notification"
											),
											n("path", {
												fill: "currentColor",
												d: "M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z",
											})
										)
									)
								),
								n(
									"div",
									null,
									r ?? n("p", { className: "vc-notification-p" }, o)
								)
							)
						),
						u &&
							n("img", { className: "vc-notification-img", src: u, alt: "" }),
						v !== 0 &&
							!p &&
							n("div", {
								className: "vc-notification-progressbar",
								style: {
									width: `${(1 - j) * 100}%`,
									backgroundColor: i || "var(--brand-500)",
								},
							})
					);
				},
				{ onError: ({ props: e }) => e.onClose() }
			);
		});
	var Tg = {};
	et(Tg, {
		classNameFactory: () => be,
		classNameToSelector: () => Bv,
		compileStyle: () => bg,
		disableStyle: () => _o,
		enableStyle: () => fo,
		isStyleEnabled: () => Sg,
		requireStyle: () => va,
		setStyleClassNames: () => p5,
		styleMap: () => _v,
		toggleStyle: () => u5,
	});
	function va(e) {
		let t = _v.get(e);
		if (!t) throw new Error(`Style "${e}" does not exist`);
		return t;
	}
	function fo(e) {
		let t = va(e);
		return t.dom?.isConnected
			? !1
			: (t.dom ||
					((t.dom = document.createElement("style")),
					(t.dom.dataset.vencordName = t.name)),
				bg(t),
				document.head.appendChild(t.dom),
				!0);
	}
	function _o(e) {
		let t = va(e);
		return t.dom?.isConnected ? (t.dom.remove(), (t.dom = null), !0) : !1;
	}
	var _v,
		u5,
		Sg,
		p5,
		bg,
		Bv,
		be,
		tt = g(() => {
			"use strict";
			a();
			_v = window.VencordStyles ??= new Map();
			(u5 = (e) => (Sg(e) ? _o(e) : fo(e))),
				(Sg = (e) => va(e).dom?.isConnected ?? !1),
				(p5 = (e, t, o = !0) => {
					let r = va(e);
					(r.classNames = t), o && Sg(r.name) && bg(r);
				}),
				(bg = (e) => {
					if (!e.dom) throw new Error("Style has no DOM element");
					e.dom.textContent = e.source.replace(/\[--(\w+)\]/g, (t, o) => {
						let r = e.classNames[o];
						return r ? Bv(r) : t;
					});
				}),
				(Bv = (e, t = "") =>
					e
						.split(" ")
						.map((o) => `.${t}${o}`)
						.join("")),
				(be =
					(e = "") =>
					(...t) => {
						let o = new Set();
						for (let r of t)
							r && typeof r == "string"
								? o.add(r)
								: Array.isArray(r)
									? r.forEach((i) => o.add(i))
									: r &&
										typeof r == "object" &&
										Object.entries(r).forEach(([i, s]) => s && o.add(i));
						return Array.from(o, (r) => e + r).join(" ");
					});
		});
	function xg({ text: e, color: t }) {
		return n(
			"div",
			{
				className: "vc-plugins-badge",
				style: {
					backgroundColor: t,
					justifySelf: "flex-end",
					marginLeft: "auto",
				},
			},
			e
		);
	}
	var Tc = g(() => {
		"use strict";
		a();
	});
	function Sa({ value: e, onChange: t, validate: o }) {
		let [r, i] = q.useState(e),
			[s, l] = q.useState();
		function c(u) {
			i(u);
			let p = o(u);
			p === !0 ? (l(void 0), t(u)) : l(p);
		}
		return n(f, null, n(mt, { type: "text", value: r, onChange: c, error: s }));
	}
	var xc = g(() => {
		"use strict";
		a();
		b();
	});
	function ba(e) {
		return n(
			"div",
			{ className: d5.markup },
			Ce.defaultRules.codeBlock.react(e, null, {})
		);
	}
	var d5,
		wc = g(() => {
			"use strict";
			a();
			U();
			b();
			d5 = C("markup", "codeContainer");
		});
	var Uv = g(() => {});
	function Pg({
		children: e,
		onMoreClick: t,
		buttons: o,
		moreTooltipText: r,
		onDropDownClick: i,
		headerText: s,
		defaultState: l = !1,
		forceOpen: c = !1,
	}) {
		let [u, p] = z(l || c);
		return n(
			f,
			null,
			n(
				"div",
				{
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "8px",
					},
				},
				n(
					Z,
					{
						tag: "h2",
						variant: "eyebrow",
						style: { color: "var(--header-primary)", display: "inline" },
					},
					s
				),
				n(
					"div",
					{ className: wg("center-flex") },
					o ?? null,
					t &&
						n(te, { text: r }, (m) =>
							n(
								"button",
								{ ...m, className: wg("btn"), onClick: t },
								n(
									"svg",
									{ width: "24", height: "24", viewBox: "0 0 24 24" },
									n("path", {
										fill: "var(--text-normal)",
										d: "M7 12.001C7 10.8964 6.10457 10.001 5 10.001C3.89543 10.001 3 10.8964 3 12.001C3 13.1055 3.89543 14.001 5 14.001C6.10457 14.001 7 13.1055 7 12.001ZM14 12.001C14 10.8964 13.1046 10.001 12 10.001C10.8954 10.001 10 10.8964 10 12.001C10 13.1055 10.8954 14.001 12 14.001C13.1046 14.001 14 13.1055 14 12.001ZM19 10.001C20.1046 10.001 21 10.8964 21 12.001C21 13.1055 20.1046 14.001 19 14.001C17.8954 14.001 17 13.1055 17 12.001C17 10.8964 17.8954 10.001 19 10.001Z",
									})
								)
							)
						),
					n(te, { text: u ? "Hide " + s : "Show " + s }, (m) =>
						n(
							"button",
							{
								...m,
								className: wg("btn"),
								onClick: () => {
									p((y) => !y), i?.(u);
								},
								disabled: c,
							},
							n(
								"svg",
								{
									width: "24",
									height: "24",
									viewBox: "0 0 24 24",
									transform: u ? "scale(1 -1)" : "scale(1 1)",
								},
								n("path", {
									fill: "var(--text-normal)",
									d: "M16.59 8.59003L12 13.17L7.41 8.59003L6 10L12 16L18 10L16.59 8.59003Z",
								})
							)
						)
					)
				)
			),
			u && e
		);
	}
	var wg,
		Mg = g(() => {
			"use strict";
			a();
			Uv();
			tt();
			b();
			wg = be("vc-expandableheader-");
		});
	var $v = g(() => {});
	function It({
		height: e = 24,
		width: t = 24,
		className: o,
		children: r,
		viewBox: i,
		...s
	}) {
		return n(
			"svg",
			{
				className: H(o, "vc-icon"),
				role: "img",
				width: t,
				height: e,
				viewBox: i,
				...s,
			},
			r
		);
	}
	function hi({ height: e = 24, width: t = 24, className: o }) {
		return n(
			It,
			{
				height: e,
				width: t,
				className: H(o, "vc-link-icon"),
				viewBox: "0 0 24 24",
			},
			n(
				"g",
				{ fill: "none", "fill-rule": "evenodd" },
				n("path", {
					fill: "currentColor",
					d: "M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z",
				}),
				n("rect", { width: t, height: e })
			)
		);
	}
	function Ta(e) {
		return n(
			It,
			{ ...e, className: H(e.className, "vc-copy-icon"), viewBox: "0 0 24 24" },
			n(
				"g",
				{ fill: "currentColor" },
				n("path", { d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1z" }),
				n("path", {
					d: "M15 5H8c-1.1 0-1.99.9-1.99 2L6 21c0 1.1.89 2 1.99 2H19c1.1 0 2-.9 2-2V11l-6-6zM8 21V7h6v5h5v9H8z",
				})
			)
		);
	}
	function Fn(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-open-external-icon"),
				viewBox: "0 0 24 24",
			},
			n("polygon", {
				fill: "currentColor",
				fillRule: "nonzero",
				points:
					"13 20 11 20 11 8 5.5 13.5 4.08 12.08 12 4.16 19.92 12.08 18.5 13.5 13 8",
			})
		);
	}
	function tn(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-image-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M21,19V5c0,-1.1 -0.9,-2 -2,-2H5c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2zM8.5,13.5l2.5,3.01L14.5,12l4.5,6H5l3.5,-4.5z",
			})
		);
	}
	function xa(e) {
		return n(
			It,
			{ ...e, className: H(e.className, "vc-info-icon"), viewBox: "0 0 24 24" },
			n("path", {
				fill: "currentColor",
				transform: "translate(2 2)",
				d: "M9,7 L11,7 L11,5 L9,5 L9,7 Z M10,18 C5.59,18 2,14.41 2,10 C2,5.59 5.59,2 10,2 C14.41,2 18,5.59 18,10 C18,14.41 14.41,18 10,18 L10,18 Z M10,4.4408921e-16 C4.4771525,-1.77635684e-15 4.4408921e-16,4.4771525 0,10 C-1.33226763e-15,12.6521649 1.0535684,15.195704 2.92893219,17.0710678 C4.80429597,18.9464316 7.3478351,20 10,20 C12.6521649,20 15.195704,18.9464316 17.0710678,17.0710678 C18.9464316,15.195704 20,12.6521649 20,10 C20,7.3478351 18.9464316,4.80429597 17.0710678,2.92893219 C15.195704,1.0535684 12.6521649,2.22044605e-16 10,0 L10,4.4408921e-16 Z M9,15 L11,15 L11,9 L9,9 L9,15 L9,15 Z",
			})
		);
	}
	function Ig(e) {
		return n(
			It,
			{
				"aria-label": Se.Messages.GUILD_OWNER,
				...e,
				className: H(e.className, "vc-owner-crown-icon"),
				role: "img",
				viewBox: "0 0 16 16",
			},
			n("path", {
				fill: "currentColor",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M13.6572 5.42868C13.8879 5.29002 14.1806 5.30402 14.3973 5.46468C14.6133 5.62602 14.7119 5.90068 14.6473 6.16202L13.3139 11.4954C13.2393 11.7927 12.9726 12.0007 12.6666 12.0007H3.33325C3.02725 12.0007 2.76058 11.792 2.68592 11.4954L1.35258 6.16202C1.28792 5.90068 1.38658 5.62602 1.60258 5.46468C1.81992 5.30468 2.11192 5.29068 2.34325 5.42868L5.13192 7.10202L7.44592 3.63068C7.46173 3.60697 7.48377 3.5913 7.50588 3.57559C7.5192 3.56612 7.53255 3.55663 7.54458 3.54535L6.90258 2.90268C6.77325 2.77335 6.77325 2.56068 6.90258 2.43135L7.76458 1.56935C7.89392 1.44002 8.10658 1.44002 8.23592 1.56935L9.09792 2.43135C9.22725 2.56068 9.22725 2.77335 9.09792 2.90268L8.45592 3.54535C8.46794 3.55686 8.48154 3.56651 8.49516 3.57618C8.51703 3.5917 8.53897 3.60727 8.55458 3.63068L10.8686 7.10202L13.6572 5.42868ZM2.66667 12.6673H13.3333V14.0007H2.66667V12.6673Z",
			})
		);
	}
	function Cg(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-screenshare-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M2 4.5C2 3.397 2.897 2.5 4 2.5H20C21.103 2.5 22 3.397 22 4.5V15.5C22 16.604 21.103 17.5 20 17.5H13V19.5H17V21.5H7V19.5H11V17.5H4C2.897 17.5 2 16.604 2 15.5V4.5ZM13.2 14.3375V11.6C9.864 11.6 7.668 12.6625 6 15C6.672 11.6625 8.532 8.3375 13.2 7.6625V5L18 9.6625L13.2 14.3375Z",
			})
		);
	}
	function wa(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-image-visible"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M5 21q-.825 0-1.413-.587Q3 19.825 3 19V5q0-.825.587-1.413Q4.175 3 5 3h14q.825 0 1.413.587Q21 4.175 21 5v14q0 .825-.587 1.413Q19.825 21 19 21Zm0-2h14V5H5v14Zm1-2h12l-3.75-5-3 4L9 13Zm-1 2V5v14Z",
			})
		);
	}
	function Pa(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-image-invisible"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "m21 18.15-2-2V5H7.85l-2-2H19q.825 0 1.413.587Q21 4.175 21 5Zm-1.2 4.45L18.2 21H5q-.825 0-1.413-.587Q3 19.825 3 19V5.8L1.4 4.2l1.4-1.4 18.4 18.4ZM6 17l3-4 2.25 3 .825-1.1L5 7.825V19h11.175l-2-2Zm7.425-6.425ZM10.6 13.4Z",
			})
		);
	}
	function Ag(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-microphone"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.99 11C14.99 12.66 13.66 14 12 14C10.34 14 9 12.66 9 11V5C9 3.34 10.34 2 12 2C13.66 2 15 3.34 15 5L14.99 11ZM12 16.1C14.76 16.1 17.3 14 17.3 11H19C19 14.42 16.28 17.24 13 17.72V21H11V17.72C7.72 17.23 5 14.41 5 11H6.7C6.7 14 9.24 16.1 12 16.1ZM12 4C11.2 4 11 4.66667 11 5V11C11 11.3333 11.2 12 12 12C12.8 12 13 11.3333 13 11V5C13 4.66667 12.8 4 12 4Z",
				fill: "currentColor",
			}),
			n("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.99 11C14.99 12.66 13.66 14 12 14C10.34 14 9 12.66 9 11V5C9 3.34 10.34 2 12 2C13.66 2 15 3.34 15 5L14.99 11ZM12 16.1C14.76 16.1 17.3 14 17.3 11H19C19 14.42 16.28 17.24 13 17.72V22H11V17.72C7.72 17.23 5 14.41 5 11H6.7C6.7 14 9.24 16.1 12 16.1Z",
				fill: "currentColor",
			})
		);
	}
	function Ma(e) {
		return n(
			It,
			{ ...e, className: H(e.className, "vc-cog-wheel"), viewBox: "0 0 24 24" },
			n("path", {
				clipRule: "evenodd",
				fill: "currentColor",
				d: "M19.738 10H22V14H19.739C19.498 14.931 19.1 15.798 18.565 16.564L20 18L18 20L16.565 18.564C15.797 19.099 14.932 19.498 14 19.738V22H10V19.738C9.069 19.498 8.203 19.099 7.436 18.564L6 20L4 18L5.436 16.564C4.901 15.799 4.502 14.932 4.262 14H2V10H4.262C4.502 9.068 4.9 8.202 5.436 7.436L4 6L6 4L7.436 5.436C8.202 4.9 9.068 4.502 10 4.262V2H14V4.261C14.932 4.502 15.797 4.9 16.565 5.435L18 3.999L20 5.999L18.564 7.436C19.099 8.202 19.498 9.069 19.738 10ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z",
			})
		);
	}
	function Pc(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-reply-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z",
			})
		);
	}
	function _n(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-delete-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z",
			}),
			n("path", {
				fill: "currentColor",
				d: "M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z",
			})
		);
	}
	function Ia(e) {
		return n(
			It,
			{ ...e, className: H(e.className, "vc-plus-icon"), viewBox: "0 0 18 18" },
			n("polygon", {
				"fill-rule": "nonzero",
				fill: "currentColor",
				points: "15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8",
			})
		);
	}
	function Ng(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-no-entry-sign-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", { d: "M0 0h24v24H0z", fill: "none" }),
			n("path", {
				fill: "currentColor",
				d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z",
			})
		);
	}
	function Rg(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-safety-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M4.27 5.22A2.66 2.66 0 0 0 3 7.5v2.3c0 5.6 3.3 10.68 8.42 12.95.37.17.79.17 1.16 0A14.18 14.18 0 0 0 21 9.78V7.5c0-.93-.48-1.78-1.27-2.27l-6.17-3.76a3 3 0 0 0-3.12 0L4.27 5.22ZM6 7.68l6-3.66V12H6.22C6.08 11.28 6 10.54 6 9.78v-2.1Zm6 12.01V12h5.78A11.19 11.19 0 0 1 12 19.7Z",
			})
		);
	}
	function kg(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-notes-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M8 3C7.44771 3 7 3.44772 7 4V5C7 5.55228 7.44772 6 8 6H16C16.5523 6 17 5.55228 17 5V4C17 3.44772 16.5523 3 16 3H15.1245C14.7288 3 14.3535 2.82424 14.1002 2.52025L13.3668 1.64018C13.0288 1.23454 12.528 1 12 1C11.472 1 10.9712 1.23454 10.6332 1.64018L9.8998 2.52025C9.64647 2.82424 9.27121 3 8.8755 3H8Z",
			}),
			n("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				fill: "currentColor",
				d: "M19 4.49996V4.99996C19 6.65681 17.6569 7.99996 16 7.99996H8C6.34315 7.99996 5 6.65681 5 4.99996V4.49996C5 4.22382 4.77446 3.99559 4.50209 4.04109C3.08221 4.27826 2 5.51273 2 6.99996V19C2 20.6568 3.34315 22 5 22H19C20.6569 22 22 20.6568 22 19V6.99996C22 5.51273 20.9178 4.27826 19.4979 4.04109C19.2255 3.99559 19 4.22382 19 4.49996ZM8 12C7.44772 12 7 12.4477 7 13C7 13.5522 7.44772 14 8 14H16C16.5523 14 17 13.5522 17 13C17 12.4477 16.5523 12 16 12H8ZM7 17C7 16.4477 7.44772 16 8 16H13C13.5523 16 14 16.4477 14 17C14 17.5522 13.5523 18 13 18H8C7.44772 18 7 17.5522 7 17Z",
			})
		);
	}
	function m5(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-folder-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M2 5a3 3 0 0 1 3-3h3.93a2 2 0 0 1 1.66.9L12 5h7a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z",
			})
		);
	}
	function Dg(e) {
		return n(
			It,
			{ ...e, className: H(e.className, "vc-log-icon"), viewBox: "0 0 24 24" },
			n("path", {
				fill: "currentColor",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M3.11 8H6v10.82c0 .86.37 1.68 1 2.27.46.43 1.02.71 1.63.84A1 1 0 0 0 9 22h10a4 4 0 0 0 4-4v-1a2 2 0 0 0-2-2h-1V5a3 3 0 0 0-3-3H4.67c-.87 0-1.7.32-2.34.9-.63.6-1 1.42-1 2.28 0 .71.3 1.35.52 1.75a5.35 5.35 0 0 0 .48.7l.01.01h.01L3.11 7l-.76.65a1 1 0 0 0 .76.35Zm1.56-4c-.38 0-.72.14-.97.37-.24.23-.37.52-.37.81a1.69 1.69 0 0 0 .3.82H6v-.83c0-.29-.13-.58-.37-.8C5.4 4.14 5.04 4 4.67 4Zm5 13a3.58 3.58 0 0 1 0 3H19a2 2 0 0 0 2-2v-1H9.66ZM3.86 6.35ZM11 8a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Zm-1 5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Z",
			})
		);
	}
	function Lg(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-restart-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "M4 12a8 8 0 0 1 14.93-4H15a1 1 0 1 0 0 2h6a1 1 0 0 0 1-1V3a1 1 0 1 0-2 0v3a9.98 9.98 0 0 0-18 6 10 10 0 0 0 16.29 7.78 1 1 0 0 0-1.26-1.56A8 8 0 0 1 4 12Z",
			})
		);
	}
	function Ca(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-paintbrush-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M15.35 7.24C15.9 6.67 16 5.8 16 5a3 3 0 1 1 3 3c-.8 0-1.67.09-2.24.65a1.5 1.5 0 0 0 0 2.11l1.12 1.12a3 3 0 0 1 0 4.24l-5 5a3 3 0 0 1-4.25 0l-5.76-5.75a3 3 0 0 1 0-4.24l4.04-4.04.97-.97a3 3 0 0 1 4.24 0l1.12 1.12c.58.58 1.52.58 2.1 0ZM6.9 9.9 4.3 12.54a1 1 0 0 0 0 1.42l2.17 2.17.83-.84a1 1 0 0 1 1.42 1.42l-.84.83.59.59 1.83-1.84a1 1 0 0 1 1.42 1.42l-1.84 1.83.17.17a1 1 0 0 0 1.42 0l2.63-2.62L6.9 9.9Z",
			})
		);
	}
	function Eg(e) {
		return n(
			It,
			{
				...e,
				className: H(e.className, "vc-pencil-icon"),
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z",
			})
		);
	}
	function Aa(e) {
		let t = Sr() === 2 ? h5 : y5;
		return n("img", { ...e, src: t });
	}
	function Og(e) {
		let t = Sr() === 2 ? g5 : f5;
		return n("img", { ...e, src: t });
	}
	var f5,
		g5,
		h5,
		y5,
		yt = g(() => {
			"use strict";
			a();
			$v();
			it();
			me();
			b();
			(f5 = "/assets/e1e96d89e192de1997f73730db26e94f.svg"),
				(g5 = "/assets/730f58bcfd5a57a5e22460c445a0c6cf.svg"),
				(h5 = "/assets/3ff98ad75ac94fa883af5ed62d17c459.svg"),
				(y5 = "/assets/6a853b4c87fce386cbfef4a2efbacb09.svg");
		});
	function He(e) {
		return (
			e.disabled &&
				((e.style ??= {}),
				(e.style.pointerEvents = "none"),
				(e["aria-disabled"] = !0)),
			n("a", { role: "link", target: "_blank", ...e }, e.children)
		);
	}
	var no = g(() => {
		"use strict";
		a();
	});
	var Gv = g(() => {});
	function Bg({ checked: e, onChange: t, disabled: o }) {
		return n(
			"div",
			null,
			n(
				"div",
				{
					className: H(Mc.container, "default-colors", e ? Mc.checked : void 0),
					style: { backgroundColor: e ? Fg : _g, opacity: o ? 0.3 : 1 },
				},
				n(
					"svg",
					{
						className: Mc.slider + " vc-switch-slider",
						viewBox: "0 0 28 20",
						preserveAspectRatio: "xMinYMid meet",
						"aria-hidden": "true",
						style: { transform: e ? "translateX(12px)" : "translateX(-3px)" },
					},
					n("rect", {
						fill: "white",
						x: "4",
						y: "0",
						height: "20",
						width: "20",
						rx: "10",
					}),
					n(
						"svg",
						{ viewBox: "0 0 20 20", fill: "none" },
						e
							? n(
									f,
									null,
									n("path", {
										fill: Fg,
										d: "M7.89561 14.8538L6.30462 13.2629L14.3099 5.25755L15.9009 6.84854L7.89561 14.8538Z",
									}),
									n("path", {
										fill: Fg,
										d: "M4.08643 11.0903L5.67742 9.49929L9.4485 13.2704L7.85751 14.8614L4.08643 11.0903Z",
									})
								)
							: n(
									f,
									null,
									n("path", {
										fill: _g,
										d: "M5.13231 6.72963L6.7233 5.13864L14.855 13.2704L13.264 14.8614L5.13231 6.72963Z",
									}),
									n("path", {
										fill: _g,
										d: "M13.2704 5.13864L14.8614 6.72963L6.72963 14.8614L5.13864 13.2704L13.2704 5.13864Z",
									})
								)
					)
				),
				n("input", {
					disabled: o,
					type: "checkbox",
					className: Mc.input,
					tabIndex: 0,
					checked: e,
					onChange: (r) => t(r.currentTarget.checked),
				})
			)
		);
	}
	var Fg,
		_g,
		Mc,
		Ug = g(() => {
			"use strict";
			a();
			Gv();
			me();
			U();
			(Fg = "var(--green-360)"),
				(_g = "var(--primary-400)"),
				(Mc = C("slider", "input", "container"));
		});
	var $g = {};
	et($g, {
		Badge: () => xg,
		CheckedTextInput: () => Sa,
		CodeBlock: () => ba,
		CogWheel: () => Ma,
		CopyIcon: () => Ta,
		DeleteIcon: () => _n,
		ErrorBoundary: () => R,
		ErrorCard: () => Fo,
		ExpandableHeader: () => Pg,
		Flex: () => pe,
		FolderIcon: () => m5,
		GithubIcon: () => Aa,
		Heart: () => ha,
		ImageIcon: () => tn,
		ImageInvisible: () => Pa,
		ImageVisible: () => wa,
		InfoIcon: () => xa,
		Link: () => He,
		LinkIcon: () => hi,
		LogIcon: () => Dg,
		Microphone: () => Ag,
		NoEntrySignIcon: () => Ng,
		NotesIcon: () => kg,
		OpenExternalIcon: () => Fn,
		OwnerCrownIcon: () => Ig,
		PaintbrushIcon: () => Ca,
		PencilIcon: () => Eg,
		PlusIcon: () => Ia,
		ReplyIcon: () => Pc,
		RestartIcon: () => Lg,
		SafetyIcon: () => Rg,
		ScreenshareIcon: () => Cg,
		Switch: () => Bg,
		WebsiteIcon: () => Og,
	});
	var Na = g(() => {
		"use strict";
		a();
		Tc();
		xc();
		wc();
		vc();
		re();
		gi();
		Mg();
		kt();
		yc();
		yt();
		no();
		Ug();
	});
	function v5() {
		let e = Mt().notifications;
		return n(
			"div",
			{ style: { padding: "1em 0" } },
			n(S.FormTitle, { tag: "h5" }, "Notification Style"),
			e.useNative !== "never" &&
				Notification?.permission === "denied" &&
				n(
					Fo,
					{ style: { padding: "1em" }, className: G.bottom8 },
					n(
						S.FormTitle,
						{ tag: "h5" },
						"Desktop Notification Permission denied"
					),
					n(
						S.FormText,
						null,
						"You have denied Notification Permissions. Thus, Desktop notifications will not work!"
					)
				),
			n(
				S.FormText,
				{ className: G.bottom8 },
				"Some plugins may show you notifications. These come in two styles:",
				n(
					"ul",
					null,
					n(
						"li",
						null,
						n("strong", null, "Vencord Notifications"),
						": These are in-app notifications"
					),
					n(
						"li",
						null,
						n("strong", null, "Desktop Notifications"),
						": Native Desktop notifications (like when you get a ping)"
					)
				)
			),
			n(Do, {
				placeholder: "Notification Style",
				options: [
					{
						label: "Only use Desktop notifications when Discord is not focused",
						value: "not-focused",
						default: !0,
					},
					{ label: "Always use Desktop notifications", value: "always" },
					{ label: "Always use Vencord notifications", value: "never" },
				],
				closeOnSelect: !0,
				select: (t) => (e.useNative = t),
				isSelected: (t) => t === e.useNative,
				serialize: Fi,
			}),
			n(
				S.FormTitle,
				{ tag: "h5", className: G.top16 + " " + G.bottom8 },
				"Notification Position"
			),
			n(Do, {
				isDisabled: e.useNative === "always",
				placeholder: "Notification Position",
				options: [
					{ label: "Bottom Right", value: "bottom-right", default: !0 },
					{ label: "Top Right", value: "top-right" },
				],
				select: (t) => (e.position = t),
				isSelected: (t) => t === e.position,
				serialize: Fi,
			}),
			n(
				S.FormTitle,
				{ tag: "h5", className: G.top16 + " " + G.bottom8 },
				"Notification Timeout"
			),
			n(
				S.FormText,
				{ className: G.bottom16 },
				"Set to 0s to never automatically time out"
			),
			n(Xr, {
				disabled: e.useNative === "always",
				markers: [0, 1e3, 2500, 5e3, 1e4, 2e4],
				minValue: 0,
				maxValue: 2e4,
				initialValue: e.timeout,
				onValueChange: (t) => (e.timeout = t),
				onValueRender: (t) => (t / 1e3).toFixed(2) + "s",
				onMarkerRender: (t) => t / 1e3 + "s",
				stickToMarkers: !1,
			}),
			n(
				S.FormTitle,
				{ tag: "h5", className: G.top16 + " " + G.bottom8 },
				"Notification Log Limit"
			),
			n(
				S.FormText,
				{ className: G.bottom16 },
				"The amount of notifications to save in the log until old ones are removed. Set to ",
				n("code", null, "0"),
				" to disable Notification log and ",
				n("code", null, "\u221E"),
				" to never automatically remove old Notifications"
			),
			n(Xr, {
				markers: [0, 25, 50, 75, 100, 200],
				minValue: 0,
				maxValue: 200,
				stickToMarkers: !0,
				initialValue: e.logLimit,
				onValueChange: (t) => (e.logLimit = t),
				onValueRender: (t) => (t === 200 ? "\u221E" : t),
				onMarkerRender: (t) => (t === 200 ? "\u221E" : t),
			})
		);
	}
	function Ic() {
		ge((e) =>
			n(
				Te,
				{ ...e, size: "medium" },
				n(
					Ee,
					null,
					n(
						Z,
						{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
						"Notification Settings"
					),
					n(rt, { onClick: e.onClose })
				),
				n(Ae, null, n(v5, null))
			)
		);
	}
	var Gg = g(() => {
		"use strict";
		a();
		F();
		Ye();
		me();
		Ke();
		b();
		Na();
	});
	var Hv,
		zv = g(() => {
			a();
			Hv = (e = 21) =>
				crypto
					.getRandomValues(new Uint8Array(e))
					.reduce(
						(t, o) => (
							(o &= 63),
							o < 36
								? (t += o.toString(36))
								: o < 62
									? (t += (o - 26).toString(36).toUpperCase())
									: o > 62
										? (t += "-")
										: (t += "_"),
							t
						),
						""
					);
		});
	async function jv(e) {
		if (e.noPersist) return;
		let t = he.notifications.logLimit;
		t !== 0 &&
			(await Wr(Cc, (o) => {
				let r = o ?? [],
					{
						onClick: i,
						onClose: s,
						richBody: l,
						permanent: c,
						noPersist: u,
						dismissOnClick: p,
						...m
					} = e;
				return (
					r.unshift({ ...m, timestamp: Date.now(), id: Hv() }),
					r.length > t && t !== 200 && (r.length = t),
					r
				);
			}),
			Ra.forEach((o) => o()));
	}
	async function S5(e) {
		let t = await Wv(),
			o = t.findIndex((r) => r.timestamp === e);
		o !== -1 && (t.splice(o, 1), await wt(Cc, t), Ra.forEach((r) => r()));
	}
	function b5() {
		let [e, t] = $i((s) => s + 1, 0);
		ue(() => (Ra.add(t), () => void Ra.delete(t)), []);
		let [o, r, i] = pt(Wv, { fallbackValue: [], deps: [e] });
		return [o, i];
	}
	function T5({ data: e }) {
		let [t, o] = z(!1),
			r = q.useRef(null);
		return (
			ue(() => {
				let i = r.current,
					s = () => {
						if (i.clientHeight === 0) return requestAnimationFrame(s);
						i.style.height = `${i.clientHeight}px`;
					};
				s();
			}, []),
			n(
				"div",
				{ className: Qi("wrapper", { removing: t }), ref: r },
				n(bc, {
					...e,
					permanent: !0,
					dismissOnClick: !1,
					onClose: () => {
						t || (o(!0), setTimeout(() => S5(e.timestamp), 200));
					},
					richBody: n(
						"div",
						{ className: Qi("body") },
						e.body,
						n(Zt, {
							timestamp: new Date(e.timestamp),
							className: Qi("timestamp"),
						})
					),
				})
			)
		);
	}
	function x5({ log: e, pending: t }) {
		return !e.length && !t
			? n(
					"div",
					{ className: Qi("container") },
					n("div", { className: Qi("empty") }),
					n(
						S.FormText,
						{ style: { textAlign: "center" } },
						"No notifications yet"
					)
				)
			: n(
					"div",
					{ className: Qi("container") },
					e.map((o) => n(T5, { data: o, key: o.id }))
				);
	}
	function w5({ modalProps: e, close: t }) {
		let [o, r] = b5();
		return n(
			Te,
			{ ...e, size: "large" },
			n(
				Ee,
				null,
				n(
					Z,
					{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
					"Notification Log"
				),
				n(rt, { onClick: t })
			),
			n(Ae, null, n(x5, { log: o, pending: r })),
			n(
				ht,
				null,
				n(
					pe,
					null,
					n(M, { onClick: Ic }, "Notification Settings"),
					n(
						M,
						{
							disabled: o.length === 0,
							color: M.Colors.RED,
							onClick: () => {
								Tt.show({
									title: "Are you sure?",
									body: `This will permanently remove ${o.length} notification${o.length === 1 ? "" : "s"}. This action cannot be undone.`,
									async onConfirm() {
										await wt(Cc, []), Ra.forEach((i) => i());
									},
									confirmText: "Do it!",
									confirmColor: "vc-notification-log-danger-btn",
									cancelText: "Nevermind",
								});
							},
						},
						"Clear Notification Log"
					)
				)
			)
		);
	}
	function ka() {
		let e = ge((t) => n(w5, { modalProps: t, close: () => Dn(e) }));
	}
	var Cc,
		Wv,
		Qi,
		Ra,
		Ac = g(() => {
			"use strict";
			a();
			$o();
			F();
			tt();
			kt();
			Gg();
			Ke();
			ct();
			b();
			zv();
			vg();
			(Cc = "notification-log"),
				(Wv = async () => (await lt(Cc)) ?? []),
				(Qi = be("vc-notification-log-")),
				(Ra = new Set());
		});
	function I5() {
		if (!Hg) {
			let e = document.createElement("div");
			(e.id = "vc-notification-container"),
				document.body.append(e),
				(Hg = ti.createRoot(e));
		}
		return Hg;
	}
	function C5(e, t) {
		let o = I5();
		return new Promise((r) => {
			o.render(
				n(bc, {
					key: t,
					...e,
					onClose: () => {
						e.onClose?.(), o.render(null), r();
					},
				})
			);
		});
	}
	function A5() {
		if (typeof Notification > "u") return !1;
		let { useNative: e } = he.notifications;
		return e === "always"
			? !0
			: e === "not-focused"
				? !document.hasFocus()
				: !1;
	}
	async function qv() {
		return (
			Notification.permission === "granted" ||
			(Notification.permission !== "denied" &&
				(await Notification.requestPermission()) === "granted")
		);
	}
	async function ze(e) {
		if ((jv(e), A5() && (await qv()))) {
			let {
					title: t,
					body: o,
					icon: r,
					image: i,
					onClick: s = null,
					onClose: l = null,
				} = e,
				c = new Notification(t, { body: o, icon: r, image: i });
			(c.onclick = s), (c.onclose = l);
		} else P5.push(() => C5(e, M5++));
	}
	var P5,
		Hg,
		M5,
		Kv = g(() => {
			"use strict";
			a();
			F();
			di();
			b();
			vg();
			Ac();
			(P5 = new Oo()), (M5 = 42);
		});
	var zg = {};
	et(zg, { requestPermission: () => qv, showNotification: () => ze });
	var Bn = g(() => {
		"use strict";
		a();
		Kv();
	});
	function oS(e, t) {
		return B5(e, t || {}, 0, 0);
	}
	function nS(e, t) {
		return O5(e, t);
	}
	var go,
		Co,
		Nc,
		Rc,
		kc,
		Kg,
		Xv,
		Jv,
		Vv,
		Yg,
		eS,
		N5,
		Yv,
		Zg,
		Un,
		Ze,
		gn,
		Tr,
		Ze,
		Ze,
		Ze,
		Ze,
		Ea,
		Ze,
		R5,
		k5,
		D5,
		L5,
		Wg,
		on,
		jg,
		Jg,
		tS,
		E5,
		br,
		O5,
		$n,
		Da,
		qg,
		Qg,
		Zv,
		La,
		Xg,
		Qv,
		F5,
		Vg,
		_5,
		B5,
		U5,
		$5,
		rS = g(() => {
			a();
			(go = Uint8Array),
				(Co = Uint16Array),
				(Nc = Uint32Array),
				(Rc = new go([
					0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
					4, 5, 5, 5, 5, 0, 0, 0, 0,
				])),
				(kc = new go([
					0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10,
					10, 11, 11, 12, 12, 13, 13, 0, 0,
				])),
				(Kg = new go([
					16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
				])),
				(Xv = function (e, t) {
					for (var o = new Co(31), r = 0; r < 31; ++r)
						o[r] = t += 1 << e[r - 1];
					for (var i = new Nc(o[30]), r = 1; r < 30; ++r)
						for (var s = o[r]; s < o[r + 1]; ++s) i[s] = ((s - o[r]) << 5) | r;
					return [o, i];
				}),
				(Jv = Xv(Rc, 2)),
				(Vv = Jv[0]),
				(Yg = Jv[1]);
			(Vv[28] = 258), (Yg[258] = 28);
			(eS = Xv(kc, 0)), (N5 = eS[0]), (Yv = eS[1]), (Zg = new Co(32768));
			for (Ze = 0; Ze < 32768; ++Ze)
				(Un = ((Ze & 43690) >>> 1) | ((Ze & 21845) << 1)),
					(Un = ((Un & 52428) >>> 2) | ((Un & 13107) << 2)),
					(Un = ((Un & 61680) >>> 4) | ((Un & 3855) << 4)),
					(Zg[Ze] = (((Un & 65280) >>> 8) | ((Un & 255) << 8)) >>> 1);
			(gn = function (e, t, o) {
				for (var r = e.length, i = 0, s = new Co(t); i < r; ++i)
					e[i] && ++s[e[i] - 1];
				var l = new Co(t);
				for (i = 0; i < t; ++i) l[i] = (l[i - 1] + s[i - 1]) << 1;
				var c;
				if (o) {
					c = new Co(1 << t);
					var u = 15 - t;
					for (i = 0; i < r; ++i)
						if (e[i])
							for (
								var p = (i << 4) | e[i],
									m = t - e[i],
									y = l[e[i] - 1]++ << m,
									v = y | ((1 << m) - 1);
								y <= v;
								++y
							)
								c[Zg[y] >>> u] = p;
				} else
					for (c = new Co(r), i = 0; i < r; ++i)
						e[i] && (c[i] = Zg[l[e[i] - 1]++] >>> (15 - e[i]));
				return c;
			}),
				(Tr = new go(288));
			for (Ze = 0; Ze < 144; ++Ze) Tr[Ze] = 8;
			for (Ze = 144; Ze < 256; ++Ze) Tr[Ze] = 9;
			for (Ze = 256; Ze < 280; ++Ze) Tr[Ze] = 7;
			for (Ze = 280; Ze < 288; ++Ze) Tr[Ze] = 8;
			Ea = new go(32);
			for (Ze = 0; Ze < 32; ++Ze) Ea[Ze] = 5;
			(R5 = gn(Tr, 9, 0)),
				(k5 = gn(Tr, 9, 1)),
				(D5 = gn(Ea, 5, 0)),
				(L5 = gn(Ea, 5, 1)),
				(Wg = function (e) {
					for (var t = e[0], o = 1; o < e.length; ++o) e[o] > t && (t = e[o]);
					return t;
				}),
				(on = function (e, t, o) {
					var r = (t / 8) | 0;
					return ((e[r] | (e[r + 1] << 8)) >> (t & 7)) & o;
				}),
				(jg = function (e, t) {
					var o = (t / 8) | 0;
					return (e[o] | (e[o + 1] << 8) | (e[o + 2] << 16)) >> (t & 7);
				}),
				(Jg = function (e) {
					return ((e + 7) / 8) | 0;
				}),
				(tS = function (e, t, o) {
					(t == null || t < 0) && (t = 0),
						(o == null || o > e.length) && (o = e.length);
					var r = new (
						e.BYTES_PER_ELEMENT == 2 ? Co : e.BYTES_PER_ELEMENT == 4 ? Nc : go
					)(o - t);
					return r.set(e.subarray(t, o)), r;
				}),
				(E5 = [
					"unexpected EOF",
					"invalid block type",
					"invalid length/literal",
					"invalid distance",
					"stream finished",
					"no stream handler",
					,
					"no callback",
					"invalid UTF-8 data",
					"extra field too long",
					"date not in range 1980-2099",
					"filename too long",
					"stream finishing",
					"invalid zip data",
				]),
				(br = function (e, t, o) {
					var r = new Error(t || E5[e]);
					if (
						((r.code = e),
						Error.captureStackTrace && Error.captureStackTrace(r, br),
						!o)
					)
						throw r;
					return r;
				}),
				(O5 = function (e, t, o) {
					var r = e.length;
					if (!r || (o && o.f && !o.l)) return t || new go(0);
					var i = !t || o,
						s = !o || o.i;
					o || (o = {}), t || (t = new go(r * 3));
					var l = function ($r) {
							var dr = t.length;
							if ($r > dr) {
								var mr = new go(Math.max(dr * 2, $r));
								mr.set(t), (t = mr);
							}
						},
						c = o.f || 0,
						u = o.p || 0,
						p = o.b || 0,
						m = o.l,
						y = o.d,
						v = o.m,
						N = o.n,
						w = r * 8;
					do {
						if (!m) {
							c = on(e, u, 1);
							var I = on(e, u + 1, 3);
							if (((u += 3), I))
								if (I == 1) (m = k5), (y = L5), (v = 9), (N = 5);
								else if (I == 2) {
									var $ = on(e, u, 31) + 257,
										j = on(e, u + 10, 15) + 4,
										Q = $ + on(e, u + 5, 31) + 1;
									u += 14;
									for (var ee = new go(Q), J = new go(19), B = 0; B < j; ++B)
										J[Kg[B]] = on(e, u + B * 3, 7);
									u += j * 3;
									for (
										var ie = Wg(J),
											se = (1 << ie) - 1,
											Fe = gn(J, ie, 1),
											B = 0;
										B < Q;

									) {
										var ve = Fe[on(e, u, se)];
										u += ve & 15;
										var A = ve >>> 4;
										if (A < 16) ee[B++] = A;
										else {
											var Qe = 0,
												Ne = 0;
											for (
												A == 16
													? ((Ne = 3 + on(e, u, 3)), (u += 2), (Qe = ee[B - 1]))
													: A == 17
														? ((Ne = 3 + on(e, u, 7)), (u += 3))
														: A == 18 && ((Ne = 11 + on(e, u, 127)), (u += 7));
												Ne--;

											)
												ee[B++] = Qe;
										}
									}
									var Re = ee.subarray(0, $),
										$e = ee.subarray($);
									(v = Wg(Re)),
										(N = Wg($e)),
										(m = gn(Re, v, 1)),
										(y = gn($e, N, 1));
								} else br(1);
							else {
								var A = Jg(u) + 4,
									L = e[A - 4] | (e[A - 3] << 8),
									k = A + L;
								if (k > r) {
									s && br(0);
									break;
								}
								i && l(p + L),
									t.set(e.subarray(A, k), p),
									(o.b = p += L),
									(o.p = u = k * 8),
									(o.f = c);
								continue;
							}
							if (u > w) {
								s && br(0);
								break;
							}
						}
						i && l(p + 131072);
						for (var Ge = (1 << v) - 1, ke = (1 << N) - 1, Pe = u; ; Pe = u) {
							var Qe = m[jg(e, u) & Ge],
								Ot = Qe >>> 4;
							if (((u += Qe & 15), u > w)) {
								s && br(0);
								break;
							}
							if ((Qe || br(2), Ot < 256)) t[p++] = Ot;
							else if (Ot == 256) {
								(Pe = u), (m = null);
								break;
							} else {
								var ut = Ot - 254;
								if (Ot > 264) {
									var B = Ot - 257,
										je = Rc[B];
									(ut = on(e, u, (1 << je) - 1) + Vv[B]), (u += je);
								}
								var To = y[jg(e, u) & ke],
									Bt = To >>> 4;
								To || br(3), (u += To & 15);
								var $e = N5[Bt];
								if (Bt > 3) {
									var je = kc[Bt];
									($e += jg(e, u) & ((1 << je) - 1)), (u += je);
								}
								if (u > w) {
									s && br(0);
									break;
								}
								i && l(p + 131072);
								for (var Ft = p + ut; p < Ft; p += 4)
									(t[p] = t[p - $e]),
										(t[p + 1] = t[p + 1 - $e]),
										(t[p + 2] = t[p + 2 - $e]),
										(t[p + 3] = t[p + 3 - $e]);
								p = Ft;
							}
						}
						(o.l = m),
							(o.p = Pe),
							(o.b = p),
							(o.f = c),
							m && ((c = 1), (o.m = v), (o.d = y), (o.n = N));
					} while (!c);
					return p == t.length ? t : tS(t, 0, p);
				}),
				($n = function (e, t, o) {
					o <<= t & 7;
					var r = (t / 8) | 0;
					(e[r] |= o), (e[r + 1] |= o >>> 8);
				}),
				(Da = function (e, t, o) {
					o <<= t & 7;
					var r = (t / 8) | 0;
					(e[r] |= o), (e[r + 1] |= o >>> 8), (e[r + 2] |= o >>> 16);
				}),
				(qg = function (e, t) {
					for (var o = [], r = 0; r < e.length; ++r)
						e[r] && o.push({ s: r, f: e[r] });
					var i = o.length,
						s = o.slice();
					if (!i) return [Vg, 0];
					if (i == 1) {
						var l = new go(o[0].s + 1);
						return (l[o[0].s] = 1), [l, 1];
					}
					o.sort(function (Q, ee) {
						return Q.f - ee.f;
					}),
						o.push({ s: -1, f: 25001 });
					var c = o[0],
						u = o[1],
						p = 0,
						m = 1,
						y = 2;
					for (o[0] = { s: -1, f: c.f + u.f, l: c, r: u }; m != i - 1; )
						(c = o[o[p].f < o[y].f ? p++ : y++]),
							(u = o[p != m && o[p].f < o[y].f ? p++ : y++]),
							(o[m++] = { s: -1, f: c.f + u.f, l: c, r: u });
					for (var v = s[0].s, r = 1; r < i; ++r) s[r].s > v && (v = s[r].s);
					var N = new Co(v + 1),
						w = Qg(o[m - 1], N, 0);
					if (w > t) {
						var r = 0,
							I = 0,
							A = w - t,
							L = 1 << A;
						for (
							s.sort(function (ee, J) {
								return N[J.s] - N[ee.s] || ee.f - J.f;
							});
							r < i;
							++r
						) {
							var k = s[r].s;
							if (N[k] > t) (I += L - (1 << (w - N[k]))), (N[k] = t);
							else break;
						}
						for (I >>>= A; I > 0; ) {
							var $ = s[r].s;
							N[$] < t ? (I -= 1 << (t - N[$]++ - 1)) : ++r;
						}
						for (; r >= 0 && I; --r) {
							var j = s[r].s;
							N[j] == t && (--N[j], ++I);
						}
						w = t;
					}
					return [new go(N), w];
				}),
				(Qg = function (e, t, o) {
					return e.s == -1
						? Math.max(Qg(e.l, t, o + 1), Qg(e.r, t, o + 1))
						: (t[e.s] = o);
				}),
				(Zv = function (e) {
					for (var t = e.length; t && !e[--t]; );
					for (
						var o = new Co(++t),
							r = 0,
							i = e[0],
							s = 1,
							l = function (u) {
								o[r++] = u;
							},
							c = 1;
						c <= t;
						++c
					)
						if (e[c] == i && c != t) ++s;
						else {
							if (!i && s > 2) {
								for (; s > 138; s -= 138) l(32754);
								s > 2 &&
									(l(s > 10 ? ((s - 11) << 5) | 28690 : ((s - 3) << 5) | 12305),
									(s = 0));
							} else if (s > 3) {
								for (l(i), --s; s > 6; s -= 6) l(8304);
								s > 2 && (l(((s - 3) << 5) | 8208), (s = 0));
							}
							for (; s--; ) l(i);
							(s = 1), (i = e[c]);
						}
					return [o.subarray(0, r), t];
				}),
				(La = function (e, t) {
					for (var o = 0, r = 0; r < t.length; ++r) o += e[r] * t[r];
					return o;
				}),
				(Xg = function (e, t, o) {
					var r = o.length,
						i = Jg(t + 2);
					(e[i] = r & 255),
						(e[i + 1] = r >>> 8),
						(e[i + 2] = e[i] ^ 255),
						(e[i + 3] = e[i + 1] ^ 255);
					for (var s = 0; s < r; ++s) e[i + s + 4] = o[s];
					return (i + 4 + r) * 8;
				}),
				(Qv = function (e, t, o, r, i, s, l, c, u, p, m) {
					$n(t, m++, o), ++i[256];
					for (
						var y = qg(i, 15),
							v = y[0],
							N = y[1],
							w = qg(s, 15),
							I = w[0],
							A = w[1],
							L = Zv(v),
							k = L[0],
							$ = L[1],
							j = Zv(I),
							Q = j[0],
							ee = j[1],
							J = new Co(19),
							B = 0;
						B < k.length;
						++B
					)
						J[k[B] & 31]++;
					for (var B = 0; B < Q.length; ++B) J[Q[B] & 31]++;
					for (
						var ie = qg(J, 7), se = ie[0], Fe = ie[1], ve = 19;
						ve > 4 && !se[Kg[ve - 1]];
						--ve
					);
					var Qe = (p + 5) << 3,
						Ne = La(i, Tr) + La(s, Ea) + l,
						Re =
							La(i, v) +
							La(s, I) +
							l +
							14 +
							3 * ve +
							La(J, se) +
							(2 * J[16] + 3 * J[17] + 7 * J[18]);
					if (Qe <= Ne && Qe <= Re) return Xg(t, m, e.subarray(u, u + p));
					var $e, Ge, ke, Pe;
					if (($n(t, m, 1 + (Re < Ne)), (m += 2), Re < Ne)) {
						($e = gn(v, N, 0)), (Ge = v), (ke = gn(I, A, 0)), (Pe = I);
						var Ot = gn(se, Fe, 0);
						$n(t, m, $ - 257),
							$n(t, m + 5, ee - 1),
							$n(t, m + 10, ve - 4),
							(m += 14);
						for (var B = 0; B < ve; ++B) $n(t, m + 3 * B, se[Kg[B]]);
						m += 3 * ve;
						for (var ut = [k, Q], je = 0; je < 2; ++je)
							for (var To = ut[je], B = 0; B < To.length; ++B) {
								var Bt = To[B] & 31;
								$n(t, m, Ot[Bt]),
									(m += se[Bt]),
									Bt > 15 &&
										($n(t, m, (To[B] >>> 5) & 127), (m += To[B] >>> 12));
							}
					} else ($e = R5), (Ge = Tr), (ke = D5), (Pe = Ea);
					for (var B = 0; B < c; ++B)
						if (r[B] > 255) {
							var Bt = (r[B] >>> 18) & 31;
							Da(t, m, $e[Bt + 257]),
								(m += Ge[Bt + 257]),
								Bt > 7 && ($n(t, m, (r[B] >>> 23) & 31), (m += Rc[Bt]));
							var Ft = r[B] & 31;
							Da(t, m, ke[Ft]),
								(m += Pe[Ft]),
								Ft > 3 && (Da(t, m, (r[B] >>> 5) & 8191), (m += kc[Ft]));
						} else Da(t, m, $e[r[B]]), (m += Ge[r[B]]);
					return Da(t, m, $e[256]), m + Ge[256];
				}),
				(F5 = new Nc([
					65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560,
					2117632,
				])),
				(Vg = new go(0)),
				(_5 = function (e, t, o, r, i, s) {
					var l = e.length,
						c = new go(r + l + 5 * (1 + Math.ceil(l / 7e3)) + i),
						u = c.subarray(r, c.length - i),
						p = 0;
					if (!t || l < 8)
						for (var m = 0; m <= l; m += 65535) {
							var y = m + 65535;
							y >= l && (u[p >> 3] = s), (p = Xg(u, p + 1, e.subarray(m, y)));
						}
					else {
						for (
							var v = F5[t - 1],
								N = v >>> 13,
								w = v & 8191,
								I = (1 << o) - 1,
								A = new Co(32768),
								L = new Co(I + 1),
								k = Math.ceil(o / 3),
								$ = 2 * k,
								j = function (de) {
									return (e[de] ^ (e[de + 1] << k) ^ (e[de + 2] << $)) & I;
								},
								Q = new Nc(25e3),
								ee = new Co(288),
								J = new Co(32),
								B = 0,
								ie = 0,
								m = 0,
								se = 0,
								Fe = 0,
								ve = 0;
							m < l;
							++m
						) {
							var Qe = j(m),
								Ne = m & 32767,
								Re = L[Qe];
							if (((A[Ne] = Re), (L[Qe] = Ne), Fe <= m)) {
								var $e = l - m;
								if ((B > 7e3 || se > 24576) && $e > 423) {
									(p = Qv(e, u, 0, Q, ee, J, ie, se, ve, m - ve, p)),
										(se = B = ie = 0),
										(ve = m);
									for (var Ge = 0; Ge < 286; ++Ge) ee[Ge] = 0;
									for (var Ge = 0; Ge < 30; ++Ge) J[Ge] = 0;
								}
								var ke = 2,
									Pe = 0,
									Ot = w,
									ut = (Ne - Re) & 32767;
								if ($e > 2 && Qe == j(m - ut))
									for (
										var je = Math.min(N, $e) - 1,
											To = Math.min(32767, m),
											Bt = Math.min(258, $e);
										ut <= To && --Ot && Ne != Re;

									) {
										if (e[m + ke] == e[m + ke - ut]) {
											for (
												var Ft = 0;
												Ft < Bt && e[m + Ft] == e[m + Ft - ut];
												++Ft
											);
											if (Ft > ke) {
												if (((ke = Ft), (Pe = ut), Ft > je)) break;
												for (
													var $r = Math.min(ut, Ft - 2), dr = 0, Ge = 0;
													Ge < $r;
													++Ge
												) {
													var mr = (m - ut + Ge + 32768) & 32767,
														Gr = A[mr],
														Jt = (mr - Gr + 32768) & 32767;
													Jt > dr && ((dr = Jt), (Re = mr));
												}
											}
										}
										(Ne = Re), (Re = A[Ne]), (ut += (Ne - Re + 32768) & 32767);
									}
								if (Pe) {
									Q[se++] = 268435456 | (Yg[ke] << 18) | Yv[Pe];
									var Hr = Yg[ke] & 31,
										O = Yv[Pe] & 31;
									(ie += Rc[Hr] + kc[O]),
										++ee[257 + Hr],
										++J[O],
										(Fe = m + ke),
										++B;
								} else (Q[se++] = e[m]), ++ee[e[m]];
							}
						}
						(p = Qv(e, u, s, Q, ee, J, ie, se, ve, m - ve, p)),
							!s && p & 7 && (p = Xg(u, p + 1, Vg));
					}
					return tS(c, 0, r + Jg(p) + i);
				}),
				(B5 = function (e, t, o, r, i) {
					return _5(
						e,
						t.level == null ? 6 : t.level,
						t.mem == null
							? Math.ceil(Math.max(8, Math.min(13, Math.log(e.length))) * 1.5)
							: 12 + t.mem,
						o,
						r,
						!i
					);
				});
			(U5 = typeof TextDecoder < "u" && new TextDecoder()), ($5 = 0);
			try {
				U5.decode(Vg, { stream: !0 }), ($5 = 1);
			} catch {}
		});
	async function iS() {
		let e = (await lt("Vencord_cloudSecret")) ?? {},
			t = eh();
		return e[t]
			? (await Wr(
					"Vencord_cloudSecret",
					(o) => ((o ??= {}), (o[`${t}:${Oa()}`] = o[t]), delete o[t], o)
				),
				e[t])
			: e[`${t}:${Oa()}`];
	}
	async function G5(e) {
		await Wr(
			"Vencord_cloudSecret",
			(t) => ((t ??= {}), (t[`${eh()}:${Oa()}`] = e), t)
		);
	}
	async function Lc() {
		await Wr(
			"Vencord_cloudSecret",
			(e) => ((e ??= {}), delete e[`${eh()}:${Oa()}`], e)
		);
	}
	async function th() {
		if ((await iS()) !== void 0) {
			he.cloud.authenticated = !0;
			return;
		}
		try {
			let o = await fetch(new URL("/v1/oauth/settings", xr()));
			var { clientId: e, redirectUri: t } = await o.json();
		} catch {
			ze({
				title: "Cloud Integration",
				body: "Setup failed (couldn't retrieve OAuth configuration).",
			}),
				(he.cloud.authenticated = !1);
			return;
		}
		ge((o) =>
			n(ei, {
				...o,
				scopes: ["identify"],
				responseType: "code",
				redirectUri: t,
				permissions: 0n,
				clientId: e,
				cancelCompletesFlow: !1,
				callback: async ({ location: r }) => {
					if (!r) {
						he.cloud.authenticated = !1;
						return;
					}
					try {
						let i = await fetch(r, { headers: { Accept: "application/json" } }),
							{ secret: s } = await i.json();
						s
							? (Dc.info("Authorized with secret"),
								await G5(s),
								ze({
									title: "Cloud Integration",
									body: "Cloud integrations enabled!",
								}),
								(he.cloud.authenticated = !0))
							: (ze({
									title: "Cloud Integration",
									body: "Setup failed (no secret returned?).",
								}),
								(he.cloud.authenticated = !1));
					} catch (i) {
						Dc.error("Failed to authorize", i),
							ze({
								title: "Cloud Integration",
								body: `Setup failed (${i.toString()}).`,
							}),
							(he.cloud.authenticated = !1);
					}
				},
			})
		);
	}
	async function Xi() {
		let e = await iS();
		return window.btoa(`${e}:${Oa()}`);
	}
	var Dc,
		xr,
		eh,
		Oa,
		oh = g(() => {
			"use strict";
			a();
			$o();
			Bn();
			F();
			b();
			De();
			Ke();
			(Dc = new V("Cloud", "#39b7e0")),
				(xr = () => new URL(he.cloud.url)),
				(eh = () => xr().origin),
				(Oa = () => {
					let e = D.getCurrentUser()?.id;
					if (!e) throw new Error("User not yet logged in");
					return e;
				});
		});
	function Ji() {
		window.VesktopNative.app.relaunch();
	}
	var Gn = g(() => {
		"use strict";
		a();
	});
	function Ec(e) {
		let t = document.createElement("a");
		(t.href = URL.createObjectURL(e)),
			(t.download = e.name),
			document.body.appendChild(t),
			t.click(),
			setImmediate(() => {
				URL.revokeObjectURL(t.href), document.body.removeChild(t);
			});
	}
	function Oc(e) {
		return new Promise((t) => {
			let o = document.createElement("input");
			(o.type = "file"),
				(o.style.display = "none"),
				(o.accept = e),
				(o.onchange = async () => {
					t(o.files?.[0] ?? null);
				}),
				document.body.appendChild(o),
				o.click(),
				setImmediate(() => document.body.removeChild(o));
		});
	}
	var Fc = g(() => {
		"use strict";
		a();
	});
	async function sS(e) {
		try {
			var t = JSON.parse(e);
		} catch (o) {
			throw (console.log(e), new Error("Failed to parse JSON: " + String(o)));
		}
		if ("settings" in t && "quickCss" in t)
			Object.assign(hn, t.settings),
				await VencordNative.settings.set(t.settings),
				await VencordNative.quickCss.set(t.quickCss);
		else
			throw new Error(
				"Invalid Settings. Is this even a Vencord Settings file?"
			);
	}
	async function aS({ minify: e } = {}) {
		let t = VencordNative.settings.get(),
			o = await VencordNative.quickCss.get();
		return JSON.stringify({ settings: t, quickCss: o }, null, e ? void 0 : 4);
	}
	async function lS() {
		let e = `vencord-settings-backup-${vr().format("YYYY-MM-DD")}.json`,
			t = await aS(),
			o = new TextEncoder().encode(t);
		Ec(new File([o], e, { type: "application/json" }));
	}
	async function uS(e = !0) {
		if (!1) {
			if (t)
				try {
				} catch (o) {}
		} else {
			let t = await Oc("application/json");
			if (!t) return;
			let o = new FileReader();
			(o.onload = async () => {
				try {
					await sS(o.result), e && H5();
				} catch (r) {
					new V("SettingsSync").error(r), e && z5(r);
				}
			}),
				o.readAsText(t);
		}
	}
	async function Vi(e) {
		let t = await aS({ minify: !0 });
		try {
			let o = await fetch(new URL("/v1/settings", xr()), {
				method: "PUT",
				headers: {
					Authorization: await Xi(),
					"Content-Type": "application/octet-stream",
				},
				body: oS(new TextEncoder().encode(t)),
			});
			if (!o.ok) {
				nn.error(`Failed to sync up, API returned ${o.status}`),
					ze({
						title: "Cloud Settings",
						body: `Could not synchronize settings to cloud (API returned ${o.status}).`,
						color: "var(--red-360)",
					});
				return;
			}
			let { written: r } = await o.json();
			(hn.cloud.settingsSyncVersion = r),
				VencordNative.settings.set(hn),
				nn.info("Settings uploaded to cloud successfully"),
				e &&
					ze({
						title: "Cloud Settings",
						body: "Synchronized settings to the cloud!",
						noPersist: !0,
					});
		} catch (o) {
			nn.error("Failed to sync up", o),
				ze({
					title: "Cloud Settings",
					body: `Could not synchronize settings to the cloud (${o.toString()}).`,
					color: "var(--red-360)",
				});
		}
	}
	async function _c(e = !0, t = !1) {
		try {
			let o = await fetch(new URL("/v1/settings", xr()), {
				method: "GET",
				headers: {
					Authorization: await Xi(),
					Accept: "application/octet-stream",
					"If-None-Match": he.cloud.settingsSyncVersion.toString(),
				},
			});
			if (o.status === 404)
				return (
					nn.info("No settings on the cloud"),
					e &&
						ze({
							title: "Cloud Settings",
							body: "There are no settings in the cloud.",
							noPersist: !0,
						}),
					!1
				);
			if (o.status === 304)
				return (
					nn.info("Settings up to date"),
					e &&
						ze({
							title: "Cloud Settings",
							body: "Your settings are up to date.",
							noPersist: !0,
						}),
					!1
				);
			if (!o.ok)
				return (
					nn.error(`Failed to sync down, API returned ${o.status}`),
					ze({
						title: "Cloud Settings",
						body: `Could not synchronize settings from the cloud (API returned ${o.status}).`,
						color: "var(--red-360)",
					}),
					!1
				);
			let r = Number(o.headers.get("etag")),
				i = he.cloud.settingsSyncVersion;
			if (!t && r < i) {
				e &&
					ze({
						title: "Cloud Settings",
						body: "Your local settings are newer than the cloud ones.",
						noPersist: !0,
					});
				return;
			}
			let s = await o.arrayBuffer(),
				l = new TextDecoder().decode(nS(new Uint8Array(s)));
			return (
				await sS(l),
				(hn.cloud.settingsSyncVersion = r),
				VencordNative.settings.set(hn),
				nn.info("Settings loaded from cloud successfully"),
				e &&
					ze({
						title: "Cloud Settings",
						body: "Your settings have been updated! Click here to restart to fully apply changes!",
						color: "var(--green-360)",
						onClick: () => location.reload(),
						noPersist: !0,
					}),
				!0
			);
		} catch (o) {
			return (
				nn.error("Failed to sync down", o),
				ze({
					title: "Cloud Settings",
					body: `Could not synchronize settings from the cloud (${o.toString()}).`,
					color: "var(--red-360)",
				}),
				!1
			);
		}
	}
	async function pS() {
		try {
			let e = await fetch(new URL("/v1/settings", xr()), {
				method: "DELETE",
				headers: { Authorization: await Xi() },
			});
			if (!e.ok) {
				nn.error(`Failed to delete, API returned ${e.status}`),
					ze({
						title: "Cloud Settings",
						body: `Could not delete settings (API returned ${e.status}).`,
						color: "var(--red-360)",
					});
				return;
			}
			nn.info("Settings deleted from cloud successfully"),
				ze({
					title: "Cloud Settings",
					body: "Settings deleted from cloud!",
					color: "var(--green-360)",
				});
		} catch (e) {
			nn.error("Failed to delete", e),
				ze({
					title: "Cloud Settings",
					body: `Could not delete settings (${e.toString()}).`,
					color: "var(--red-360)",
				});
		}
	}
	var cS,
		H5,
		z5,
		nn,
		Fa = g(() => {
			"use strict";
			a();
			Bn();
			F();
			b();
			rS();
			oh();
			De();
			Gn();
			Fc();
			(cS = (e, t) => X.show({ type: e, message: t, id: X.genId() })),
				(H5 = () =>
					cS(
						X.Type.SUCCESS,
						"Settings successfully imported. Restart to apply changes!"
					)),
				(z5 = (e) =>
					cS(X.Type.FAILURE, `Failed to import settings: ${String(e)}`));
			nn = new V("Cloud:Settings", "#39b7e0");
		});
	function h(e) {
		return e;
	}
	var T = g(() => {
		"use strict";
		a();
	});
	var rh = {};
	et(rh, {
		PlainSettings: () => hn,
		Settings: () => he,
		SettingsStore: () => ro,
		definePluginSettings: () => x,
		migratePluginSettings: () => rn,
		useSettings: () => Mt,
	});
	function Mt(e) {
		let [, t] = q.useReducer(() => ({}), {});
		return (
			q.useEffect(
				() =>
					e
						? (e.forEach((o) => ro.addChangeListener(o, t)),
							() => e.forEach((o) => ro.removeChangeListener(o, t)))
						: (ro.addGlobalChangeListener(t),
							() => ro.removeGlobalChangeListener(t)),
				[]
			),
			ro.store
		);
	}
	function rn(e, ...t) {
		let { plugins: o } = ro.plain;
		if (!(e in o)) {
			for (let r of t)
				if (r in o) {
					W5.info(`Migrating settings from old name ${r} to ${e}`),
						(o[e] = o[r]),
						delete o[r],
						ro.markAsChanged();
					break;
				}
		}
	}
	function x(e, t) {
		let o = {
			get store() {
				if (!o.pluginName)
					throw new Error(
						"Cannot access settings before plugin is initialized"
					);
				return he.plugins[o.pluginName];
			},
			get plain() {
				if (!o.pluginName)
					throw new Error(
						"Cannot access settings before plugin is initialized"
					);
				return hn.plugins[o.pluginName];
			},
			use: (r) =>
				Mt(r?.map((i) => `plugins.${o.pluginName}.${i}`)).plugins[o.pluginName],
			def: e,
			checks: t ?? {},
			pluginName: "",
			withPrivateSettings() {
				return this;
			},
		};
		return o;
	}
	var W5,
		j5,
		nh,
		q5,
		ro,
		hn,
		he,
		F = g(() => {
			"use strict";
			a();
			fr();
			Ov();
			fc();
			De();
			gc();
			Fa();
			T();
			b();
			Hn();
			(W5 = new V("Settings")),
				(j5 = {
					autoUpdate: !0,
					autoUpdateNotification: !0,
					useQuickCss: !0,
					themeLinks: [],
					eagerPatches: !1,
					enabledThemes: [],
					enableReactDevtools: !1,
					frameless: !1,
					transparent: !1,
					winCtrlQ: !1,
					macosVibrancyStyle: void 0,
					disableMinSize: !1,
					winNativeTitleBar: !1,
					plugins: {},
					notifications: {
						timeout: 5e3,
						position: "bottom-right",
						useNative: "not-focused",
						logLimit: 50,
					},
					cloud: {
						authenticated: !1,
						url: "https://api.vencord.dev/",
						settingsSync: !1,
						settingsSyncVersion: 0,
					},
				}),
				(nh = VencordNative.settings.get());
			Zi(nh, j5);
			(q5 = $t(async () => {
				he.cloud.settingsSync &&
					he.cloud.authenticated &&
					(await Vi(), delete ui.Vencord_settingsDirty);
			}, 6e4)),
				(ro = new Sc(nh, {
					readOnly: !0,
					getDefaultValue({ target: e, key: t, path: o }) {
						let r = e[t];
						if (!We) return r;
						if (o === "plugins" && t in We)
							return (e[t] = {
								enabled: We[t].required || We[t].enabledByDefault || !1,
							});
						if (o.startsWith("plugins.")) {
							let i = o.slice(8);
							if (i in We) {
								let s = We[i].options?.[t];
								if (!s) return r;
								if ("default" in s) return (e[t] = s.default);
								if (s.type === 4) {
									let l = s.options.find((c) => c.default);
									return l && (e[t] = l.value), l?.value;
								}
							}
						}
						return r;
					},
				}));
			ro.addGlobalChangeListener((e, t) => {
				(ro.plain.cloud.settingsSyncVersion = Date.now()),
					(ui.Vencord_settingsDirty = !0),
					q5(),
					VencordNative.settings.set(ro.plain, t);
			});
			(hn = nh), (he = ro.store);
		});
	var dS = g(() => {});
	var ah = {};
	et(ah, {
		currentNotice: () => _a,
		nextNotice: () => fS,
		noticesQueue: () => ih,
		popNotice: () => sh,
		showNotice: () => Ba,
	});
	function sh() {
		mS.dismiss();
	}
	function fS() {
		(_a = ih.shift()), _a && mS.show(..._a, "VencordNotice");
	}
	function Ba(e, t, o) {
		ih.push(["GENERIC", e, t, o]), _a || fS();
	}
	var mS,
		ih,
		_a,
		Bc = g(() => {
			"use strict";
			a();
			U();
			(mS = _e((e) => e.show && e.dismiss && !e.suppressAll)),
				(ih = []),
				(_a = null);
		});
	var gS = g(() => {});
	function Ua() {
		return `-${Po.fromTimestamp(Date.now())}`;
	}
	function Je(e, t) {
		let o = K5({ channelId: e, content: "", embeds: [] });
		return Mo.receiveMessage(e, Zi(t, o)), t;
	}
	function qt(e, t, o) {
		return e.find((r) => r.name === t)?.value || o;
	}
	var K5,
		lh = g(() => {
			"use strict";
			a();
			gc();
			U();
			b();
			K5 = fe('username:"Clyde"');
		});
	var es,
		zn,
		ch,
		uh = g(() => {
			"use strict";
			a();
			(es = ((y) => (
				(y[(y.SUB_COMMAND = 1)] = "SUB_COMMAND"),
				(y[(y.SUB_COMMAND_GROUP = 2)] = "SUB_COMMAND_GROUP"),
				(y[(y.STRING = 3)] = "STRING"),
				(y[(y.INTEGER = 4)] = "INTEGER"),
				(y[(y.BOOLEAN = 5)] = "BOOLEAN"),
				(y[(y.USER = 6)] = "USER"),
				(y[(y.CHANNEL = 7)] = "CHANNEL"),
				(y[(y.ROLE = 8)] = "ROLE"),
				(y[(y.MENTIONABLE = 9)] = "MENTIONABLE"),
				(y[(y.NUMBER = 10)] = "NUMBER"),
				(y[(y.ATTACHMENT = 11)] = "ATTACHMENT"),
				y
			))(es || {})),
				(zn = ((s) => (
					(s[(s.BUILT_IN = 0)] = "BUILT_IN"),
					(s[(s.BUILT_IN_TEXT = 1)] = "BUILT_IN_TEXT"),
					(s[(s.BUILT_IN_INTEGRATION = 2)] = "BUILT_IN_INTEGRATION"),
					(s[(s.BOT = 3)] = "BOT"),
					(s[(s.PLACEHOLDER = 4)] = "PLACEHOLDER"),
					s
				))(zn || {})),
				(ch = ((r) => (
					(r[(r.CHAT_INPUT = 1)] = "CHAT_INPUT"),
					(r[(r.USER = 2)] = "USER"),
					(r[(r.MESSAGE = 3)] = "MESSAGE"),
					r
				))(ch || {}));
		});
	var mh = {};
	et(mh, {
		ApplicationCommandInputType: () => zn,
		ApplicationCommandOptionType: () => es,
		ApplicationCommandType: () => ch,
		BUILT_IN: () => wr,
		OptionalMessageOption: () => Pr,
		RequiredMessageOption: () => $a,
		_handleCommand: () => Z5,
		_init: () => Y5,
		commands: () => ph,
		findOption: () => qt,
		generateId: () => Ua,
		prepareOption: () => dh,
		registerCommand: () => ts,
		sendBotMessage: () => Je,
		unregisterCommand: () => Ga,
	});
	function dh(e) {
		return (
			(e.displayName ||= e.name),
			(e.displayDescription ||= e.description),
			e.options?.forEach((t, o, r) => {
				t === hS ? (r[o] = Pr) : t === yS && (r[o] = $a),
					t.choices?.forEach((i) => (i.displayName ||= i.name)),
					dh(r[o]);
			}),
			e
		);
	}
	function Q5(e, t) {
		e.options?.forEach((o) => {
			if (o.type !== 1)
				throw new Error(
					"When specifying sub-command options, all options must be sub-commands."
				);
			let r = {
				...e,
				...o,
				type: 1,
				name: `${e.name} ${o.name}`,
				id: `${o.name}-${e.id}`,
				displayName: `${e.name} ${o.name}`,
				subCommandPath: [{ name: o.name, type: o.type, displayName: o.name }],
				rootCommand: e,
			};
			ts(r, t);
		});
	}
	function ts(e, t) {
		if (!wr) {
			console.warn(
				"[CommandsAPI]",
				`Not registering ${e.name} as the CommandsAPI hasn't been initialised.`,
				"Please restart to use commands"
			);
			return;
		}
		if (wr.some((o) => o.name === e.name))
			throw new Error(`Command '${e.name}' already exists.`);
		if (
			((e.isVencordCommand = !0),
			(e.id ??= `-${wr.length + 1}`),
			(e.applicationId ??= "-1"),
			(e.type ??= 1),
			(e.inputType ??= 1),
			(e.plugin ||= t),
			dh(e),
			e.options?.[0]?.type === 1)
		) {
			Q5(e, t);
			return;
		}
		(ph[e.name] = e), wr.push(e);
	}
	function Ga(e) {
		let t = wr.findIndex((o) => o.name === e);
		return t === -1 ? !1 : (wr.splice(t, 1), delete ph[e], !0);
	}
	var wr,
		ph,
		hS,
		yS,
		Pr,
		$a,
		Y5,
		Z5,
		jo = g(() => {
			"use strict";
			a();
			On();
			lh();
			uh();
			lh();
			uh();
			(ph = {}),
				(hS = Symbol("OptionalMessageOption")),
				(yS = Symbol("RequiredMessageOption")),
				(Pr = hS),
				($a = yS),
				(Y5 = function (e) {
					try {
						(wr = e),
							(Pr = e.find((t) => t.name === "shrug").options[0]),
							($a = e.find((t) => t.name === "me").options[0]);
					} catch {
						console.error("Failed to load CommandsApi");
					}
					return e;
				}),
				(Z5 = function (e, t, o) {
					if (!e.isVencordCommand) return e.execute(t, o);
					let r = (i) => {
						let s = `An Error occurred while executing command "${e.name}"`,
							l = i instanceof Error ? i.stack || i.message : String(i);
						console.error(s, i),
							Je(o.channel.id, {
								content: `${s}:
${fi(l)}`,
								author: { username: "Vencord" },
							});
					};
					try {
						let i = e.execute(t, o);
						return i instanceof Promise ? i.catch(r) : i;
					} catch (i) {
						return r(i);
					}
				});
		});
	var yn,
		os = g(() => {
			a();
			yn = "7fcd9c3f";
		});
	var yi,
		vS = g(() => {
			a();
			yi = "wearrrrr/Vencord";
		});
	var SS,
		Uc = g(() => {
			"use strict";
			a();
			os();
			vS();
			SS = `Vencord/${yn}${yi ? ` (https://github.com/${yi})` : ""}`;
		});
	function bS({
		option: e,
		pluginSettings: t,
		definedSettings: o,
		id: r,
		onChange: i,
		onError: s,
	}) {
		let l = t[r] ?? e.default,
			[c, u] = q.useState(l ?? !1),
			[p, m] = q.useState(null);
		q.useEffect(() => {
			s(p !== null);
		}, [p]);
		function y(v) {
			let N = e.isValid?.call(o, v) ?? !0;
			typeof N == "string"
				? m(N)
				: N
					? (m(null), u(v), i(v))
					: m("Invalid input provided.");
		}
		return n(
			S.FormSection,
			null,
			n(
				Vt,
				{
					value: c,
					onChange: y,
					note: e.description,
					disabled: e.disabled?.call(o) ?? !1,
					...e.componentProps,
					hideBorder: !0,
					style: { marginBottom: "0.5em" },
				},
				mi(fg(r))
			),
			p && n(S.FormText, { style: { color: "var(--text-danger)" } }, p)
		);
	}
	var TS = g(() => {
		"use strict";
		a();
		On();
		b();
	});
	function xS({ option: e, onChange: t, onError: o }) {
		return e.component({ setValue: t, setError: o, option: e });
	}
	var wS = g(() => {
		"use strict";
		a();
	});
	function fh({
		option: e,
		pluginSettings: t,
		definedSettings: o,
		id: r,
		onChange: i,
		onError: s,
	}) {
		function l(v) {
			return e.type === 2 ? BigInt(v) : Number(v);
		}
		let [c, u] = q.useState(`${t[r] ?? e.default ?? 0}`),
			[p, m] = q.useState(null);
		q.useEffect(() => {
			s(p !== null);
		}, [p]);
		function y(v) {
			let N = e.isValid?.call(o, v) ?? !0;
			m(null),
				typeof N == "string" ? m(N) : N || m("Invalid input provided."),
				e.type === 1 && BigInt(v) >= X5
					? (u(`${Number.MAX_SAFE_INTEGER}`), i(l(v)))
					: (u(v), i(l(v)));
		}
		return n(
			S.FormSection,
			null,
			n(S.FormTitle, null, e.description),
			n(mt, {
				type: "number",
				pattern: "-?[0-9]+",
				value: c,
				onChange: y,
				placeholder: e.placeholder ?? "Enter a number",
				disabled: e.disabled?.call(o) ?? !1,
				...e.componentProps,
			}),
			p && n(S.FormText, { style: { color: "var(--text-danger)" } }, p)
		);
	}
	var X5,
		PS = g(() => {
			"use strict";
			a();
			T();
			b();
			X5 = BigInt(Number.MAX_SAFE_INTEGER);
		});
	function MS({
		option: e,
		pluginSettings: t,
		definedSettings: o,
		onChange: r,
		onError: i,
		id: s,
	}) {
		let l = t[s] ?? e.options?.find((v) => v.default)?.value,
			[c, u] = q.useState(l ?? null),
			[p, m] = q.useState(null);
		q.useEffect(() => {
			i(p !== null);
		}, [p]);
		function y(v) {
			let N = e.isValid?.call(o, v) ?? !0;
			typeof N == "string"
				? m(N)
				: N
					? (m(null), u(v), r(v))
					: m("Invalid input provided.");
		}
		return n(
			S.FormSection,
			null,
			n(S.FormTitle, null, e.description),
			n(Do, {
				isDisabled: e.disabled?.call(o) ?? !1,
				options: e.options,
				placeholder: e.placeholder ?? "Select an option",
				maxVisibleItems: 5,
				closeOnSelect: !0,
				select: y,
				isSelected: (v) => v === c,
				serialize: (v) => String(v),
				...e.componentProps,
			}),
			p && n(S.FormText, { style: { color: "var(--text-danger)" } }, p)
		);
	}
	var IS = g(() => {
		"use strict";
		a();
		b();
	});
	function Bo(e, t, o = 1) {
		let r = [];
		for (let i = e; i <= t; i += o) r.push(Math.round(i * 100) / 100);
		return r;
	}
	function CS({
		option: e,
		pluginSettings: t,
		definedSettings: o,
		id: r,
		onChange: i,
		onError: s,
	}) {
		let l = t[r] ?? e.default,
			[c, u] = q.useState(null);
		q.useEffect(() => {
			s(c !== null);
		}, [c]);
		function p(m) {
			let y = e.isValid?.call(o, m) ?? !0;
			typeof y == "string"
				? u(y)
				: y
					? (u(null), i(m))
					: u("Invalid input provided.");
		}
		return n(
			S.FormSection,
			null,
			n(S.FormTitle, null, e.description),
			n(Xr, {
				disabled: e.disabled?.call(o) ?? !1,
				markers: e.markers,
				minValue: e.markers[0],
				maxValue: e.markers[e.markers.length - 1],
				initialValue: l,
				onValueChange: p,
				onValueRender: (m) => String(m.toFixed(2)),
				stickToMarkers: e.stickToMarkers ?? !0,
				...e.componentProps,
			})
		);
	}
	var gh = g(() => {
		"use strict";
		a();
		b();
	});
	function AS({
		option: e,
		pluginSettings: t,
		definedSettings: o,
		id: r,
		onChange: i,
		onError: s,
	}) {
		let [l, c] = q.useState(t[r] ?? e.default ?? null),
			[u, p] = q.useState(null);
		q.useEffect(() => {
			s(u !== null);
		}, [u]);
		function m(y) {
			let v = e.isValid?.call(o, y) ?? !0;
			p(typeof v == "string" ? v : v ? null : "Invalid input provided."),
				c(y),
				i(y);
		}
		return n(
			S.FormSection,
			null,
			n(S.FormTitle, null, e.description),
			n(mt, {
				type: "text",
				value: l,
				onChange: m,
				placeholder: e.placeholder ?? "Enter a value",
				disabled: e.disabled?.call(o) ?? !1,
				...e.componentProps,
			}),
			u && n(S.FormText, { style: { color: "var(--text-danger)" } }, u)
		);
	}
	var NS = g(() => {
		"use strict";
		a();
		b();
	});
	var ns = g(() => {
		"use strict";
		a();
		Tc();
		TS();
		wS();
		PS();
		IS();
		gh();
		NS();
	});
	var RS = g(() => {});
	function J5() {
		return n(Aa, {
			"aria-hidden": !0,
			className: "vc-settings-modal-link-icon",
		});
	}
	function V5() {
		return n(Og, {
			"aria-hidden": !0,
			className: "vc-settings-modal-link-icon",
		});
	}
	function kS({ text: e, href: t, Icon: o }) {
		return n(te, { text: e }, (r) => n(Vr, { ...r, href: t }, n(o, null)));
	}
	var $c,
		Gc,
		hh = g(() => {
			"use strict";
			a();
			RS();
			b();
			Na();
			($c = (e) => n(kS, { ...e, Icon: V5 })),
				(Gc = (e) => n(kS, { ...e, Icon: J5 }));
		});
	function LS(e) {
		let t = new tR({
			username: e.username,
			id: e.id ?? Ua(),
			avatar: e.avatar,
			bot: !0,
		});
		return _.dispatch({ type: "USER_UPDATE", user: t }), t;
	}
	function ES({
		plugin: e,
		onRestartNeeded: t,
		onClose: o,
		transitionState: r,
	}) {
		let [i, s] = q.useState([]),
			l = Mt().plugins[e.name],
			[c, u] = q.useState({}),
			[p, m] = q.useState({}),
			[y, v] = q.useState(null),
			N = () => Object.values(p).every(($) => !$),
			w = Boolean(l && e.options && !jr(e.options));
		q.useEffect(() => {
			(async () => {
				for (let $ of e.authors.slice(0, 6)) {
					let j = $.id
						? await oo.getUser(`${$.id}`).catch(() => LS({ username: $.name }))
						: LS({ username: $.name });
					s((Q) => [...Q, j]);
				}
			})();
		}, []);
		async function I() {
			if (!e.options) {
				o();
				return;
			}
			if (e.beforeSave) {
				let j = await Promise.resolve(e.beforeSave(c));
				if (j !== !0) {
					v(j);
					return;
				}
			}
			let $ = !1;
			for (let [j, Q] of Object.entries(c)) {
				let ee = e.options[j];
				(l[j] = Q), ee?.onChange?.(Q), ee?.restartNeeded && ($ = !0);
			}
			$ && t(), o();
		}
		function A() {
			if (!w || !e.options)
				return n(S.FormText, null, "There are no settings for this plugin.");
			{
				let $ = Object.entries(e.options).map(([j, Q]) => {
					if (Q.hidden) return null;
					function ee(ie) {
						u((se) => ({ ...se, [j]: ie }));
					}
					function J(ie) {
						m((se) => ({ ...se, [j]: ie }));
					}
					let B = oR[Q.type];
					return n(B, {
						id: j,
						key: j,
						option: Q,
						onChange: ee,
						onError: J,
						pluginSettings: l,
						definedSettings: e.settings,
					});
				});
				return n(
					pe,
					{ flexDirection: "column", style: { gap: 12, marginBottom: 16 } },
					$
				);
			}
		}
		function L($, j) {
			let Q = e.authors.length - j,
				ee = e.authors.length - Q,
				J = ee + e.authors.length - j;
			return n(
				te,
				{
					text: e.authors
						.slice(ee, J)
						.map((B) => B.name)
						.join(", "),
				},
				({ onMouseEnter: B, onMouseLeave: ie }) =>
					n(
						"div",
						{ className: yh.moreUsers, onMouseEnter: B, onMouseLeave: ie },
						"+",
						Q
					)
			);
		}
		let k = is[e.name];
		return n(
			Te,
			{ transitionState: r, size: "medium", className: "vc-text-selectable" },
			n(
				Ee,
				{ separator: !1 },
				n(
					Z,
					{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
					e.name
				),
				n(rt, { onClick: o })
			),
			n(
				Ae,
				null,
				n(
					S.FormSection,
					null,
					n(
						pe,
						{ className: DS("info") },
						n(S.FormText, { className: DS("description") }, e.description),
						!k.userPlugin &&
							n(
								"div",
								{ className: "vc-settings-modal-links" },
								n($c, {
									text: "View more info",
									href: `https://vencord.dev/plugins/${e.name}`,
								}),
								n(Gc, {
									text: "View source code",
									href: `https://github.com/${yi}/tree/main/src/plugins/${k.folderName}`,
								})
							)
					),
					n(
						S.FormTitle,
						{ tag: "h3", style: { marginTop: 8, marginBottom: 0 } },
						"Authors"
					),
					n(
						"div",
						{ style: { width: "fit-content", marginBottom: 8 } },
						n(eR, {
							users: i,
							count: e.authors.length,
							guildId: void 0,
							renderIcon: !1,
							max: 6,
							showDefaultAvatarsForNullUsers: !0,
							showUserPopout: !0,
							renderMoreUsers: L,
							renderUser: ($) =>
								n(
									Hi,
									{ className: yh.clickableAvatar, onClick: () => zc($) },
									n("img", {
										className: yh.avatar,
										src: $.getAvatarURL(void 0, 80, !0),
										alt: $.username,
										title: $.username,
									})
								),
						})
					)
				),
				!!e.settingsAboutComponent &&
					n(
						"div",
						{ className: H(G.bottom8, "vc-text-selectable") },
						n(
							S.FormSection,
							null,
							n(
								R,
								{
									message:
										"An error occurred while rendering this plugin's custom InfoComponent",
								},
								n(e.settingsAboutComponent, { tempSettings: c })
							)
						)
					),
				n(
					S.FormSection,
					{ className: G.bottom16 },
					n(S.FormTitle, { tag: "h3" }, "Settings"),
					A()
				)
			),
			w &&
				n(
					ht,
					null,
					n(
						pe,
						{ flexDirection: "column", style: { width: "100%" } },
						n(
							pe,
							{ style: { marginLeft: "auto" } },
							n(
								M,
								{
									onClick: o,
									size: M.Sizes.SMALL,
									color: M.Colors.PRIMARY,
									look: M.Looks.LINK,
								},
								"Cancel"
							),
							n(
								te,
								{
									text: "You must fix all errors before saving",
									shouldShow: !N(),
								},
								({ onMouseEnter: $, onMouseLeave: j }) =>
									n(
										M,
										{
											size: M.Sizes.SMALL,
											color: M.Colors.BRAND,
											onClick: I,
											onMouseEnter: $,
											onMouseLeave: j,
											disabled: !N(),
										},
										"Save & Close"
									)
							)
						),
						y &&
							n(
								Z,
								{
									variant: "text-md/semibold",
									style: { color: "var(--text-danger)" },
								},
								"Error while saving: ",
								y
							)
					)
				)
		);
	}
	function rs(e, t) {
		ge((o) => n(ES, { ...o, plugin: e, onRestartNeeded: () => t?.(e.name) }));
	}
	var DS,
		eR,
		yh,
		tR,
		oR,
		Hc = g(() => {
			"use strict";
			a();
			gS();
			jo();
			F();
			tt();
			re();
			kt();
			Uc();
			Ye();
			me();
			Ke();
			T();
			U();
			b();
			Hn();
			ns();
			vh();
			hh();
			(DS = be("vc-plugin-modal-")),
				(eR = ae("defaultRenderUser", "showDefaultAvatarsForNullUsers")),
				(yh = C(
					"moreUsers",
					"emptyUser",
					"avatarContainer",
					"clickableAvatar"
				)),
				(tR = _e(
					(e) => e?.prototype?.getAvatarURL && e?.prototype?.hasHadPremium
				));
			oR = { [0]: AS, [1]: fh, [2]: fh, [3]: bS, [4]: MS, [5]: CS, [6]: xS };
		});
	var OS = g(() => {});
	function Wc({
		disabled: e,
		isNew: t,
		name: o,
		infoButton: r,
		footer: i,
		author: s,
		enabled: l,
		setEnabled: c,
		description: u,
		onMouseEnter: p,
		onMouseLeave: m,
	}) {
		let y = St(null),
			v = St(null);
		return n(
			"div",
			{
				className: Mr("card", { "card-disabled": e }),
				onMouseEnter: p,
				onMouseLeave: m,
			},
			n(
				"div",
				{ className: Mr("header") },
				n(
					"div",
					{ className: Mr("name-author") },
					n(
						Z,
						{ variant: "text-md/bold", className: Mr("name") },
						n(
							"div",
							{ ref: v, className: Mr("title-container") },
							n(
								"div",
								{
									ref: y,
									className: Mr("title"),
									onMouseOver: () => {
										let N = y.current,
											w = v.current;
										N.style.setProperty(
											"--offset",
											`${w.clientWidth - N.scrollWidth}px`
										),
											N.style.setProperty(
												"--duration",
												`${Math.max(0.5, (N.scrollWidth - w.clientWidth) / 7)}s`
											);
									},
								},
								o
							)
						),
						t && n(xg, { text: "NEW", color: "#ED4245" })
					),
					!!s && n(Z, { variant: "text-md/normal", className: Mr("author") }, s)
				),
				r,
				n(Bg, { checked: l, onChange: c, disabled: e })
			),
			n(Z, { className: Mr("note"), variant: "text-sm/normal" }, u),
			i
		);
	}
	var Mr,
		Sh = g(() => {
			"use strict";
			a();
			OS();
			tt();
			Tc();
			Ug();
			b();
			Mr = be("vc-addon-");
		});
	var FS = g(() => {});
	var _S = g(() => {});
	var xh = {};
	et(xh, {
		UpdateLogger: () => bh,
		changes: () => Ha,
		checkForUpdates: () => Wa,
		getRepo: () => BS,
		isNewer: () => qc,
		isOutdated: () => za,
		maybePromptToUpdate: () => ja,
		update: () => Kc,
		updateError: () => Th,
	});
	async function jc(e) {
		let t = await e;
		if (t.ok) return t.value;
		throw ((Th = t.error), t.error);
	}
	async function Wa() {
		return (
			(Ha = await jc(VencordNative.updater.getUpdates())),
			Ha.some((e) => e.hash === yn)
				? ((qc = !0), (za = !1))
				: (za = Ha.length > 0)
		);
	}
	async function Kc() {
		if (!za) return !0;
		let e = await jc(VencordNative.updater.update());
		if (e && ((za = !1), !(await jc(VencordNative.updater.rebuild()))))
			throw new Error(
				"The Build failed. Please try manually building the new update"
			);
		return e;
	}
	async function ja(e, t = !1) {
		return;
		try {
			if (await Wa()) {
				let r = confirm(e);
				if (r && qc)
					return alert(
						"Your local copy has more recent commits. Please stash or reset them."
					);
				r && (await Kc(), Ji());
			}
		} catch (o) {
			bh.error(o),
				alert(
					"That also failed :( Try updating or re-installing with the installer!"
				);
		}
	}
	var bh,
		za,
		qc,
		Th,
		Ha,
		BS,
		vi = g(() => {
			"use strict";
			a();
			os();
			De();
			Gn();
			(bh = new V("Updater", "white")), (za = !1), (qc = !1);
			BS = () => jc(VencordNative.updater.getRepo());
		});
	function US() {
		ja(
			"Uh Oh! Failed to render this Page. However, there is an update available that might fix it. Would you like to update and restart now?"
		);
	}
	var $S = g(() => {
		"use strict";
		a();
		vi();
	});
	function qo({ title: e, children: t }) {
		return n(
			S.FormSection,
			null,
			n(
				Z,
				{ variant: "heading-lg/semibold", tag: "h2", className: G.bottom16 },
				e
			),
			t
		);
	}
	function vn(e, t) {
		return R.wrap(e, {
			message: `Failed to render the ${t} tab. If this issue persists, try using the installer to reinstall!`,
			onError: nR,
		});
	}
	var nR,
		Wn = g(() => {
			"use strict";
			a();
			FS();
			_S();
			re();
			$S();
			Ye();
			ma();
			b();
			nR = pi(US);
		});
	var Ih = {};
	et(Ih, {
		_usePatchContextMenu: () => sR,
		addContextMenuPatch: () => Ph,
		addGlobalContextMenuPatch: () => rR,
		findGroupChildrenByChildId: () => Ve,
		globalPatches: () => Yc,
		navPatches: () => qa,
		removeContextMenuPatch: () => Mh,
		removeGlobalContextMenuPatch: () => iR,
	});
	function Ph(e, t) {
		Array.isArray(e) || (e = [e]);
		for (let o of e) {
			let r = qa.get(o);
			r || ((r = new Set()), qa.set(o, r)), r.add(t);
		}
	}
	function rR(e) {
		Yc.add(e);
	}
	function Mh(e, t) {
		let r = (Array.isArray(e) ? e : [e]).map((i) => qa.get(i)?.delete(t) ?? !1);
		return Array.isArray(e) ? r : r[0];
	}
	function iR(e) {
		return Yc.delete(e);
	}
	function Ve(e, t) {
		for (let o of t) {
			if (o == null) continue;
			if (Array.isArray(o)) {
				let i = Ve(e, o);
				if (i !== null) return i;
			}
			if (
				(Array.isArray(e) && e.some((i) => o.props?.id === i)) ||
				o.props?.id === e
			)
				return t;
			let r = o.props?.children;
			if (r) {
				Array.isArray(r) || ((r = [r]), (o.props.children = r));
				let i = Ve(e, r);
				if (i !== null) return i;
			}
		}
		return null;
	}
	function sR(e) {
		(e = { ...e, children: wh(e.children) }),
			(e.contextMenuApiArguments ??= []);
		let t = qa.get(e.navId);
		if ((Array.isArray(e.children) || (e.children = [e.children]), t))
			for (let o of t)
				try {
					o(e.children, ...e.contextMenuApiArguments);
				} catch (r) {
					GS.error(`Patch for ${e.navId} errored,`, r);
				}
		for (let o of Yc)
			try {
				o(e.navId, e.children, ...e.contextMenuApiArguments);
			} catch (r) {
				GS.error("Global patch errored,", r);
			}
		return e;
	}
	function wh(e) {
		return Array.isArray(e)
			? e.map(wh)
			: (q.isValidElement(e) &&
					((e = q.cloneElement(e)),
					e?.props?.children &&
						(e.type !== E.MenuControlItem ||
							(e.type === E.MenuControlItem && e.props.control != null)) &&
						(e.props.children = wh(e.props.children))),
				e);
	}
	var GS,
		qa,
		Yc,
		ho = g(() => {
			"use strict";
			a();
			De();
			b();
			(GS = new V("ContextMenu")), (qa = new Map()), (Yc = new Set());
		});
	var Qc = {};
	et(Qc, {
		PMLogger: () => aR,
		addPatch: () => WS,
		isPluginEnabled: () => Ka,
		patches: () => as,
		plugins: () => lR,
		startAllPlugins: () => Ya,
		startDependenciesRecursive: () => jS,
		startPlugin: () => Nh,
		stopPlugin: () => uR,
		subscribeAllPluginsFluxEvents: () => cR,
		subscribePluginFluxEvents: () => Ah,
		unsubscribePluginFluxEvents: () => qS,
	});
	function Ka(e) {
		return (We[e]?.required || We[e]?.isDependency || Zc[e]?.enabled) ?? !1;
	}
	function WS(e, t) {
		let o = e;
		(o.plugin = t),
			!(o.predicate && !o.predicate()) &&
				(Jf(o),
				Array.isArray(o.replacement) || (o.replacement = [o.replacement]),
				(o.replacement = o.replacement.filter(({ predicate: r }) => !r || r())),
				as.push(o));
	}
	function jS(e) {
		let t = !1,
			o = [];
		return (
			e.dependencies?.forEach((r) => {
				if (!Zc[r].enabled) {
					let i = We[r];
					if ((jS(i), (Zc[r].enabled = !0), (i.isDependency = !0), i.patches)) {
						Lt.warn(`Enabling dependency ${r} requires restart.`), (t = !0);
						return;
					}
					Nh(i) || o.push(r);
				}
			}),
			{ restartNeeded: t, failures: o }
		);
	}
	function Ah(e, t) {
		if (e.flux && !Ch.has(e.name)) {
			Ch.add(e.name), Lt.debug("Subscribing to flux events of plugin", e.name);
			for (let [o, r] of Object.entries(e.flux)) {
				let i = (e.flux[o] = function () {
					try {
						let s = r.apply(e, arguments);
						return s instanceof Promise
							? s.catch((l) =>
									Lt.error(
										`${e.name}: Error while handling ${o}
`,
										l
									)
								)
							: s;
					} catch (s) {
						Lt.error(
							`${e.name}: Error while handling ${o}
`,
							s
						);
					}
				});
				t.subscribe(o, i);
			}
		}
	}
	function qS(e, t) {
		if (e.flux) {
			Ch.delete(e.name),
				Lt.debug("Unsubscribing from flux events of plugin", e.name);
			for (let [o, r] of Object.entries(e.flux)) t.unsubscribe(o, r);
		}
	}
	function cR(e) {
		HS = !0;
		for (let t in We) !Ka(t) || Ah(We[t], e);
	}
	var Lt,
		aR,
		lR,
		as,
		HS,
		Ch,
		zS,
		Zc,
		Ya,
		Nh,
		uR,
		Za = g(() => {
			"use strict";
			a();
			jo();
			ho();
			F();
			De();
			Jo();
			T();
			b();
			Hn();
			ql();
			(Lt = new V("PluginManager", "#a6d189")),
				(aR = Lt),
				(lR = We),
				(as = []),
				(HS = !1),
				(Ch = new Set()),
				(zS = Object.values(We)),
				(Zc = he.plugins);
			for (let e of zS)
				Ka(e.name) &&
					e.dependencies?.forEach((t) => {
						let o = We[t];
						if (!o) {
							let r = new Error(
								`Plugin ${e.name} has unresolved dependency ${t}`
							);
							Lt.warn(r);
							return;
						}
						(Zc[t].enabled = !0), (o.isDependency = !0);
					});
			for (let e of zS) {
				if (e.settings) {
					(e.settings.pluginName = e.name), (e.options ??= {});
					for (let [t, o] of Object.entries(e.settings.def)) {
						let r = e.settings.checks?.[t];
						e.options[t] = { ...o, ...r };
					}
				}
				if (e.patches && Ka(e.name)) for (let t of e.patches) WS(t, e.name);
			}
			Ya = gr("startAllPlugins", function (t) {
				Lt.info(`Starting plugins (stage ${t})`);
				for (let o in We)
					if (Ka(o)) {
						if ((We[o].startAt ?? "WebpackReady") !== t) continue;
						Nh(We[o]);
					}
			});
			(Nh = gr(
				"startPlugin",
				function (t) {
					let { name: o, commands: r, contextMenus: i } = t;
					if (t.start) {
						if ((Lt.info("Starting plugin", o), t.started))
							return Lt.warn(`${o} already started`), !1;
						try {
							t.start();
						} catch (s) {
							return (
								Lt.error(
									`Failed to start ${o}
`,
									s
								),
								!1
							);
						}
					}
					if (((t.started = !0), r?.length)) {
						Lt.debug("Registering commands of plugin", o);
						for (let s of r)
							try {
								ts(s, o);
							} catch (l) {
								return (
									Lt.error(
										`Failed to register command ${s.name}
`,
										l
									),
									!1
								);
							}
					}
					if ((HS && Ah(t, _), i)) {
						Lt.debug("Adding context menus patches of plugin", o);
						for (let s in i) Ph(s, i[s]);
					}
					return !0;
				},
				(e) => `startPlugin ${e.name}`
			)),
				(uR = gr(
					"stopPlugin",
					function (t) {
						let { name: o, commands: r, contextMenus: i } = t;
						if (t.stop) {
							if ((Lt.info("Stopping plugin", o), !t.started))
								return Lt.warn(`${o} already stopped`), !1;
							try {
								t.stop();
							} catch (s) {
								return (
									Lt.error(
										`Failed to stop ${o}
`,
										s
									),
									!1
								);
							}
						}
						if (((t.started = !1), r?.length)) {
							Lt.debug("Unregistering commands of plugin", o);
							for (let s of r)
								try {
									Ga(s.name);
								} catch (l) {
									return (
										Lt.error(
											`Failed to unregister command ${s.name}
`,
											l
										),
										!1
									);
								}
						}
						if ((qS(t, _), i)) {
							Lt.debug("Removing context menus patches of plugin", o);
							for (let s in i) Mh(s, i[s]);
						}
						return !0;
					},
					(e) => `stopPlugin ${e.name}`
				));
		});
	function dR(e) {
		X.show({
			message: e,
			type: X.Type.FAILURE,
			id: X.genId(),
			options: { position: X.Position.BOTTOM },
		});
	}
	function mR({ required: e }) {
		return n(
			Nt,
			{ className: Si("info-card", { "restart-card": e }) },
			e
				? n(
						f,
						null,
						n(S.FormTitle, { tag: "h5" }, "Restart required!"),
						n(
							S.FormText,
							{ className: Si("dep-text") },
							"Restart now to apply new plugins and their settings"
						),
						n(M, { onClick: () => location.reload() }, "Restart")
					)
				: n(
						f,
						null,
						n(S.FormTitle, { tag: "h5" }, "Plugin Management"),
						n(
							S.FormText,
							null,
							"Press the cog wheel or info icon to get more info on a plugin"
						),
						n(
							S.FormText,
							null,
							"Plugins with a cog wheel have settings you can modify!"
						)
					)
		);
	}
	function Xc({
		plugin: e,
		disabled: t,
		onRestartNeeded: o,
		onMouseEnter: r,
		onMouseLeave: i,
		isNew: s,
	}) {
		let l = he.plugins[e.name],
			c = () => l.enabled ?? !1;
		function u() {
			let p = c();
			if (!p) {
				let { restartNeeded: y, failures: v } =
					Rh.startDependenciesRecursive(e);
				if (v.length) {
					KS.error(
						`Failed to start dependencies for ${e.name}: ${v.join(", ")}`
					),
						Ba(
							"Failed to start dependencies: " + v.join(", "),
							"Close",
							() => null
						);
					return;
				} else if (y) {
					(l.enabled = !0), o(e.name);
					return;
				}
			}
			if (e.patches?.length) {
				(l.enabled = !p), o(e.name);
				return;
			}
			if (p && !e.started) {
				l.enabled = !p;
				return;
			}
			if (!(p ? Rh.stopPlugin(e) : Rh.startPlugin(e))) {
				l.enabled = !1;
				let y = `Error while ${p ? "stopping" : "starting"} plugin ${e.name}`;
				KS.error(y), dR(y);
				return;
			}
			l.enabled = !p;
		}
		return n(Wc, {
			name: e.name,
			description: e.description,
			isNew: s,
			enabled: c(),
			setEnabled: u,
			disabled: t,
			onMouseEnter: r,
			onMouseLeave: i,
			infoButton: n(
				"button",
				{
					role: "switch",
					onClick: () => rs(e, o),
					className: H(pR.button, Si("info-button")),
				},
				e.options && !jr(e.options) ? n(Ma, null) : n(xa, null)
			),
		});
	}
	function fR({ search: e }) {
		let t = Object.entries(ZS).filter(([r]) => r.toLowerCase().includes(e)),
			o = {
				desktop: "Discord Desktop app or Vesktop",
				discordDesktop: "Discord Desktop app",
				vencordDesktop: "Vesktop app",
				web: "Vesktop app and the Web version of Discord",
				dev: "Developer version of Vencord",
			};
		return n(
			Z,
			{ variant: "text-md/normal", className: G.top16 },
			t.length
				? n(
						f,
						null,
						n(S.FormText, null, "Are you looking for:"),
						n(
							"ul",
							null,
							t.map(([r, i]) =>
								n(
									"li",
									{ key: r },
									n("b", null, r),
									": Only available on the ",
									o[i]
								)
							)
						)
					)
				: "No plugins meet the search criteria."
		);
	}
	function kh() {
		let e = Mt(),
			t = q.useMemo(() => new Ws(), []);
		q.useEffect(
			() => () =>
				void (
					t.hasChanges &&
					Tt.show({
						title: "Restart required",
						body: n(
							f,
							null,
							n("p", null, "The following plugins require a restart:"),
							n(
								"div",
								null,
								t.map((w, I) =>
									n(f, null, I > 0 && ", ", Ce.parse("`" + w + "`"))
								)
							)
						),
						confirmText: "Restart now",
						cancelText: "Later!",
						onConfirm: () => location.reload(),
					})
				),
			[]
		);
		let o = q.useMemo(() => {
				let w = {};
				for (let I in We) {
					let A = We[I].dependencies;
					if (A) for (let L of A) (w[L] ??= []), w[L].push(I);
				}
				return w;
			}, []),
			r = dt(
				() => Object.values(We).sort((w, I) => w.name.localeCompare(I.name)),
				[]
			),
			[i, s] = q.useState({ value: "", status: 0 }),
			l = i.value.toLowerCase(),
			c = (w) => s((I) => ({ ...I, value: w })),
			u = (w) => s((I) => ({ ...I, status: w })),
			p = (w) => {
				let { status: I } = i,
					A = Vencord.Plugins.isPluginEnabled(w.name);
				return (A && I === 2) ||
					(!A && I === 1) ||
					(I === 3 && !m?.includes(w.name))
					? !1
					: l.length
						? w.name.toLowerCase().includes(l) ||
							w.description.toLowerCase().includes(l) ||
							w.tags?.some((L) => L.toLowerCase().includes(l))
						: !0;
			},
			[m] = pt(() =>
				lt("Vencord_existingPlugins").then((w) => {
					let I = Date.now() / 1e3,
						A = {},
						L = Object.values(r).map(($) => $.name),
						k = [];
					for (let { name: $ } of r)
						(A[$] = w?.[$] ?? I) + 60 * 60 * 24 * 2 > I && k.push($);
					return wt("Vencord_existingPlugins", A), ni.isEqual(k, L) ? [] : k;
				})
			),
			y = [],
			v = [],
			N = i.value.includes("API");
		for (let w of r) {
			if (w.hidden || (!w.options && w.name.endsWith("API") && !N) || !p(w))
				continue;
			if (w.required || o[w.name]?.some((A) => e.plugins[A].enabled)) {
				let A = w.required
					? "This plugin is required for Vencord to function."
					: gR(o[w.name]?.filter((L) => e.plugins[L].enabled));
				v.push(
					n(
						te,
						{ text: A, key: w.name },
						({ onMouseLeave: L, onMouseEnter: k }) =>
							n(Xc, {
								onMouseLeave: L,
								onMouseEnter: k,
								onRestartNeeded: ($) => t.handleChange($),
								disabled: !0,
								plugin: w,
								key: w.name,
							})
					)
				);
			} else
				y.push(
					n(Xc, {
						onRestartNeeded: (A) => t.handleChange(A),
						disabled: !1,
						plugin: w,
						isNew: m?.includes(w.name),
						key: w.name,
					})
				);
		}
		return n(
			qo,
			{ title: "Plugins" },
			n(mR, { required: t.hasChanges }),
			n(
				S.FormTitle,
				{ tag: "h5", className: H(G.top20, G.bottom8) },
				"Filters"
			),
			n(
				"div",
				{ className: H(G.bottom20, Si("filter-controls")) },
				n(mt, {
					autoFocus: !0,
					value: i.value,
					placeholder: "Search for a plugin...",
					onChange: c,
				}),
				n(
					"div",
					{ className: YS.inputWrapper },
					n(Do, {
						options: [
							{ label: "Show All", value: 0, default: !0 },
							{ label: "Show Enabled", value: 1 },
							{ label: "Show Disabled", value: 2 },
							{ label: "Show New", value: 3 },
						],
						serialize: String,
						select: u,
						isSelected: (w) => w === i.status,
						closeOnSelect: !0,
						className: YS.inputDefault,
					})
				)
			),
			n(S.FormTitle, { className: G.top20 }, "Plugins"),
			y.length || v.length
				? n(
						"div",
						{ className: Si("grid") },
						y.length
							? y
							: n(
									Z,
									{ variant: "text-md/normal" },
									"No plugins meet the search criteria."
								)
					)
				: n(fR, { search: l }),
			n(S.FormDivider, { className: G.top20 }),
			n(
				S.FormTitle,
				{ tag: "h5", className: H(G.top20, G.bottom8) },
				"Required Plugins"
			),
			n(
				"div",
				{ className: Si("grid") },
				v.length
					? v
					: n(
							Z,
							{ variant: "text-md/normal" },
							"No plugins meet the search criteria."
						)
			)
		);
	}
	function gR(e) {
		return n(
			q.Fragment,
			null,
			n(S.FormText, null, "This plugin is required by:"),
			e.map((t) => n(S.FormText, { className: Si("dep-text") }, t))
		);
	}
	var Rh,
		Si,
		KS,
		YS,
		pR,
		Dh = g(() => {
			"use strict";
			a();
			dS();
			$o();
			Bc();
			F();
			tt();
			yt();
			Hc();
			Sh();
			Wn();
			Yf();
			co();
			De();
			Ye();
			me();
			ct();
			U();
			b();
			Hn();
			(Rh = Dt(() => (Za(), q0(Qc)))),
				(Si = be("vc-plugins-")),
				(KS = new V("PluginSettings", "#a6d189")),
				(YS = C("inputWrapper", "inputDefault", "error")),
				(pR = C("button", "disabled", "enabled"));
		});
	function zc(e) {
		ge((t) =>
			n(
				Te,
				{ ...t },
				n(R, null, n(Ae, { className: ls("root") }, n(hR, { user: e })))
			)
		);
	}
	function hR({ user: e }) {
		Mt();
		let t = Oe([eo], () => eo.getUserProfile(e.id));
		ue(() => {
			!t && !e.bot && e.id && mg(e.id);
		}, [e.id]);
		let o = t?.connectedAccounts?.find((l) => l.type === "github")?.name,
			r = t?.connectedAccounts?.find((l) => l.type === "domain")?.name,
			i = dt(() => {
				let l = Object.values(We);
				return (
					Oi[e.id]
						? l.filter((u) => u.authors.includes(Oi[e.id]))
						: l.filter((u) => u.authors.some((p) => p.name === e.username))
				)
					.filter((u) => !u.name.endsWith("API"))
					.sort((u, p) => Number(u.required ?? !1) - Number(p.required ?? !1));
			}, [e.id, e.username]),
			s = n(He, { href: "https://vencord.dev/source" }, "contributed");
		return n(
			f,
			null,
			n(
				"div",
				{ className: ls("header") },
				n("img", {
					className: ls("avatar"),
					src: e.getAvatarURL(void 0, 512, !0),
					alt: "",
				}),
				n(S.FormTitle, { tag: "h2", className: ls("name") }, e.username),
				n(
					"div",
					{ className: H("vc-settings-modal-links", ls("links")) },
					r && n($c, { text: r, href: `https://${r}` }),
					o && n(Gc, { text: o, href: `https://github.com/${o}` })
				)
			),
			i.length
				? n(
						S.FormText,
						null,
						"This person has ",
						s,
						" to ",
						Qf(i.length, "plugin"),
						"!"
					)
				: n(
						S.FormText,
						null,
						"This person has not made any plugins. They likely ",
						s,
						" to Vencord in other ways!"
					),
			!!i.length &&
				n(
					"div",
					{ className: ls("plugins") },
					i.map((l) =>
						n(Xc, {
							key: l.name,
							plugin: l,
							disabled: l.required ?? !1,
							onRestartNeeded: () => ft("Restart to apply changes!"),
						})
					)
				)
		);
	}
	var ls,
		vh = g(() => {
			"use strict";
			a();
			Ev();
			F();
			tt();
			re();
			no();
			P();
			it();
			me();
			Ke();
			b();
			Hn();
			Dh();
			hh();
			ls = be("vc-author-modal-");
		});
	async function QS(e = !1) {
		Lh = {};
		let t = {};
		e && (t.cache = "no-cache"),
			(Lh = await fetch("https://badges.vencord.dev/badges.json", t).then((o) =>
				o.json()
			));
	}
	var yR,
		vR,
		Lh,
		Jc,
		XS = g(() => {
			"use strict";
			a();
			Lv();
			eu();
			vc();
			re();
			kt();
			yc();
			vh();
			P();
			De();
			Ye();
			me();
			Ke();
			T();
			b();
			(yR = "https://vencord.dev/assets/favicon.png"),
				(vR = {
					description: "Vencord Contributor",
					image: yR,
					position: 0,
					shouldShow: ({ userId: e }) => In(e),
					onClick: (e, { userId: t }) => zc(D.getUser(t)),
				}),
				(Lh = {});
			Jc = h({
				name: "BadgeAPI",
				description: "API to add badges to users.",
				authors: [d.Megu, d.Ven, d.TheSun],
				required: !0,
				patches: [
					{
						find: ".FULL_SIZE]:26",
						replacement: {
							match: /(?<=(\i)=\(0,\i\.\i\)\(\i\);)return 0===\i.length\?/,
							replace:
								"$1.unshift(...$self.getBadges(arguments[0].displayProfile));$&",
						},
					},
					{
						find: ".description,delay:",
						replacement: [
							{
								match: /alt:" ","aria-hidden":!0,src:(?=.{0,20}(\i)\.icon)/,
								replace: "...$1.props,$& $1.image??",
							},
							{
								match: /(?<=text:(\i)\.description,.{0,50})children:/,
								replace:
									"children:$1.component ? $self.renderBadgeComponent({ ...$1 }) :",
							},
							{
								match: /href:(\i)\.link/,
								replace:
									"...($1.onClick && { onClick: vcE => $1.onClick(vcE, $1) }),$&",
							},
						],
					},
				],
				toolboxActions: {
					async "Refetch Badges"() {
						await QS(!0),
							X.show({
								id: X.genId(),
								message: "Successfully refetched badges!",
								type: X.Type.SUCCESS,
							});
					},
				},
				async start() {
					Vencord.Api.Badges.addBadge(vR), await QS();
				},
				getBadges(e) {
					if (!e) return [];
					try {
						return (e.userId ??= e.user?.id), Eh(e);
					} catch (t) {
						return new V("BadgeAPI#hasBadges").error(t), [];
					}
				},
				renderBadgeComponent: R.wrap(
					(e) => {
						let t = e.component;
						return n(t, { ...e });
					},
					{ noop: !0 }
				),
				getDonorBadges(e) {
					return Lh[e]?.map((t) => ({
						image: t.badge,
						description: t.tooltip,
						position: 0,
						props: { style: { borderRadius: "50%", transform: "scale(0.9)" } },
						onClick() {
							let o = ge((r) =>
								n(
									R,
									{
										noop: !0,
										onError: () => {
											Dn(o),
												VencordNative.native.openExternal(
													"https://github.com/sponsors/Vendicated"
												);
										},
									},
									n(
										Ki.ModalRoot,
										{ ...r },
										n(
											Ki.ModalHeader,
											null,
											n(
												pe,
												{ style: { width: "100%", justifyContent: "center" } },
												n(
													S.FormTitle,
													{
														tag: "h2",
														style: {
															width: "100%",
															textAlign: "center",
															margin: 0,
														},
													},
													n(ha, null),
													"Vencord Donor"
												)
											)
										),
										n(
											Ki.ModalContent,
											null,
											n(
												pe,
												null,
												n("img", {
													role: "presentation",
													src: "https://cdn.discordapp.com/emojis/1026533070955872337.png",
													alt: "",
													style: { margin: "auto" },
												}),
												n("img", {
													role: "presentation",
													src: "https://cdn.discordapp.com/emojis/1026533090627174460.png",
													alt: "",
													style: { margin: "auto" },
												})
											),
											n(
												"div",
												{ style: { padding: "1em" } },
												n(
													S.FormText,
													null,
													"This Badge is a special perk for Vencord Donors"
												),
												n(
													S.FormText,
													{ className: G.top20 },
													"Please consider supporting the development of Vencord by becoming a donor. It would mean a lot!!"
												)
											)
										),
										n(
											Ki.ModalFooter,
											null,
											n(
												pe,
												{ style: { width: "100%", justifyContent: "center" } },
												n(ya, null)
											)
										)
									)
								)
							);
						},
					}));
				},
			});
		});
	var tu,
		JS = g(() => {
			"use strict";
			a();
			P();
			T();
			tu = h({
				name: "ChatInputButtonAPI",
				description: "API to add buttons to the chat input",
				authors: [d.Ven],
				patches: [
					{
						find: '"sticker")',
						replacement: {
							match:
								/return\(!\i\.\i&&(?=\(\i\.isDM.+?(\i)\.push\(.{0,50}"gift")/,
							replace:
								"$&(Vencord.Api.ChatButtons._injectButtons($1,arguments[0]),true)&&",
						},
					},
				],
			});
		});
	var ou,
		VS = g(() => {
			"use strict";
			a();
			P();
			T();
			ou = h({
				name: "CommandsAPI",
				authors: [d.Arjix],
				description: "Api required by anything that uses commands",
				patches: [
					{
						find: ',"tenor"',
						replacement: [
							{
								match: /(?<=\w=)(\w)(\.filter\(.{0,60}tenor)/,
								replace: "Vencord.Api.Commands._init($1)$2",
							},
						],
					},
					{
						find: "Unexpected value for option",
						replacement: {
							match: /,(\i)\.execute\((\i),(\i)\)/,
							replace: (e, t, o, r) =>
								`,Vencord.Api.Commands._handleCommand(${t}, ${o}, ${r})`,
						},
					},
					{
						find: ".source,children",
						replacement: {
							match:
								/(?<=:(.{1,3})\.displayDescription\}.{0,200}\.source,children:)[^}]+/,
							replace: "$1.plugin||($&)",
						},
					},
				],
			});
		});
	var nu,
		eb = g(() => {
			"use strict";
			a();
			P();
			T();
			nu = h({
				name: "ContextMenuAPI",
				description: "API for adding/removing items to/from context menus.",
				authors: [d.Nuckyz, d.Ven, d.Kyuuhachi],
				required: !0,
				patches: [
					{
						find: "\u266B (\u3064\uFF61\u25D5\u203F\u203F\u25D5\uFF61)\u3064 \u266A",
						replacement: {
							match: /(?=let{navId:)(?<=function \i\((\i)\).+?)/,
							replace: "$1=Vencord.Api.ContextMenu._usePatchContextMenu($1);",
						},
					},
					{
						find: ".Menu,{",
						all: !0,
						replacement: {
							match: /Menu,{(?<=\.jsxs?\)\(\i\.Menu,{)/g,
							replace:
								"$&contextMenuApiArguments:typeof arguments!=='undefined'?arguments:[],",
						},
					},
				],
			});
		});
	var ru,
		tb = g(() => {
			"use strict";
			a();
			P();
			T();
			ru = h({
				name: "MemberListDecoratorsAPI",
				description:
					"API to add decorators to member list (both in servers and DMs)",
				authors: [d.TheSun, d.Ven],
				patches: [
					{
						find: ".lostPermission)",
						replacement: [
							{
								match: /let\{[^}]*lostPermissionTooltipText:\i[^}]*\}=(\i),/,
								replace: "$&vencordProps=$1,",
							},
							{
								match:
									/\.Messages\.GUILD_OWNER(?=.+?decorators:(\i)\(\)).+?\1=?\(\)=>.+?children:\[/,
								replace:
									"$&...(typeof vencordProps=='undefined'?[]:Vencord.Api.MemberListDecorators.__getDecorators(vencordProps)),",
							},
						],
					},
					{
						find: "PrivateChannel.renderAvatar",
						replacement: {
							match: /decorators:(\i\.isSystemDM\(\))\?(.+?):null/,
							replace:
								"decorators:[...Vencord.Api.MemberListDecorators.__getDecorators(arguments[0]), $1?$2:null]",
						},
					},
				],
			});
		});
	var iu,
		ob = g(() => {
			"use strict";
			a();
			P();
			T();
			iu = h({
				name: "MessageAccessoriesAPI",
				description: "API to add message accessories.",
				authors: [d.Cyn],
				patches: [
					{
						find: ".Messages.REMOVE_ATTACHMENT_BODY",
						replacement: {
							match: /(?<=.container\)?,children:)(\[.+?\])/,
							replace:
								"Vencord.Api.MessageAccessories._modifyAccessories($1,this.props)",
						},
					},
				],
			});
		});
	var su,
		nb = g(() => {
			"use strict";
			a();
			P();
			T();
			su = h({
				name: "MessageDecorationsAPI",
				description: "API to add decorations to messages",
				authors: [d.TheSun],
				patches: [
					{
						find: '"Message Username"',
						replacement: {
							match:
								/\.Messages\.GUILD_COMMUNICATION_DISABLED_BOTTOM_SHEET_TITLE.+?}\),\i(?=\])/,
							replace:
								"$&,...Vencord.Api.MessageDecorations.__addDecorationsToMessage(arguments[0])",
						},
					},
				],
			});
		});
	var au,
		rb = g(() => {
			"use strict";
			a();
			P();
			T();
			au = h({
				name: "MessageEventsAPI",
				description: "Api required by anything using message events.",
				authors: [d.Arjix, d.hunt, d.Ven],
				patches: [
					{
						find: ".Messages.EDIT_TEXTAREA_HELP",
						replacement: {
							match:
								/(?<=,channel:\i\}\)\.then\().+?(?=return \i\.content!==this\.props\.message\.content&&\i\((.+?)\))/,
							replace: (e, t) =>
								`async ${e}if(await Vencord.Api.MessageEvents._handlePreEdit(${t}))return Promise.resolve({shoudClear:true,shouldRefocus:true});`,
						},
					},
					{
						find: ".handleSendMessage,onResize",
						replacement: {
							match:
								/(type:this\.props\.chatInputType.+?\.then\()(\i=>\{.+?let (\i)=\i\.\i\.parse\((\i),.+?let (\i)=\i\.\i\.getSendMessageOptionsForReply\(\i\);)(?<=\)\(({.+?})\)\.then.+?)/,
							replace: (e, t, o, r, i, s, l) =>
								`${t}async ${o}if(await Vencord.Api.MessageEvents._handlePreSend(${i}.id,${r},${l},${s}))return{shoudClear:true,shouldRefocus:true};`,
						},
					},
					{
						find: '("interactionUsernameProfile',
						replacement: {
							match:
								/let\{id:\i}=(\i),{id:\i}=(\i);return \i\.useCallback\((\i)=>\{/,
							replace: (e, t, o, r) =>
								`const vcMsg=${t},vcChan=${o};${e}Vencord.Api.MessageEvents._handleClick(vcMsg, vcChan, ${r});`,
						},
					},
				],
			});
		});
	var lu,
		ib = g(() => {
			"use strict";
			a();
			P();
			T();
			lu = h({
				name: "MessagePopoverAPI",
				description: "API to add buttons to message popovers.",
				authors: [d.KingFish, d.Ven, d.Nuckyz],
				patches: [
					{
						find: "Messages.MESSAGE_UTILITIES_A11Y_LABEL",
						replacement: {
							match:
								/\.jsx\)\((\i\.\i),\{label:\i\.\i\.Messages\.MESSAGE_ACTION_REPLY.{0,200}?"reply-self".{0,50}?\}\):null(?=,.+?message:(\i))/,
							replace:
								"$&,Vencord.Api.MessagePopover._buildPopoverElements($1,$2)",
						},
					},
				],
			});
		});
	var cu,
		sb = g(() => {
			"use strict";
			a();
			P();
			T();
			cu = h({
				name: "MessageUpdaterAPI",
				description: "API for updating and re-rendering messages.",
				authors: [d.Nuckyz],
				patches: [
					{
						find: "}renderEmbeds(",
						replacement: {
							match: /(?<=this.props,\i,\[)"message",/,
							replace: "",
						},
					},
				],
			});
		});
	var uu,
		ab = g(() => {
			"use strict";
			a();
			P();
			T();
			uu = h({
				name: "NoticesAPI",
				description: "Fixes notices being automatically dismissed",
				authors: [d.Ven],
				required: !0,
				patches: [
					{
						find: '"NoticeStore"',
						replacement: [
							{
								match: /(?<=!1;)\i=null;(?=.{0,80}getPremiumSubscription\(\))/g,
								replace: "if(Vencord.Api.Notices.currentNotice)return false;$&",
							},
							{
								match: /(?<=,NOTICE_DISMISS:function\(\i\){)return null!=(\i)/,
								replace:
									'if($1.id=="VencordNotice")return($1=null,Vencord.Api.Notices.nextNotice(),true);$&',
							},
						],
					},
				],
			});
		});
	var pu,
		lb = g(() => {
			"use strict";
			a();
			P();
			T();
			pu = h({
				name: "ServerListAPI",
				authors: [d.kemo],
				description: "Api required for plugins that modify the server list",
				patches: [
					{
						find: "Messages.DISCODO_DISABLED",
						replacement: {
							match:
								/(?<=Messages\.DISCODO_DISABLED.+?return)(\(.{0,75}?tutorialContainer.+?}\))(?=}function)/,
							replace:
								"[$1].concat(Vencord.Api.ServerList.renderAll(Vencord.Api.ServerList.ServerListRenderPosition.Above))",
						},
					},
					{
						find: "Messages.SERVERS,children",
						replacement: {
							match:
								/(?<=Messages\.SERVERS,children:).+?default:return null\}\}\)/,
							replace:
								"Vencord.Api.ServerList.renderAll(Vencord.Api.ServerList.ServerListRenderPosition.In).concat($&)",
						},
					},
				],
			});
		});
	var du,
		cb = g(() => {
			"use strict";
			a();
			P();
			T();
			du = h({
				name: "UserSettingsAPI",
				description:
					"Patches Discord's UserSettings to expose their group and name.",
				authors: [d.Nuckyz],
				patches: [
					{
						find: ",updateSetting:",
						replacement: [
							{
								match: /(?<=INFREQUENT_USER_ACTION.{0,20},)useSetting:/,
								replace:
									"userSettingsAPIGroup:arguments[0],userSettingsAPIName:arguments[1],$&",
							},
							{
								match:
									/updateSetting:.{0,100}SELECTIVELY_SYNCED_USER_SETTINGS_UPDATE/,
								replace:
									"userSettingsAPIGroup:arguments[0].userSettingsAPIGroup,userSettingsAPIName:arguments[0].userSettingsAPIName,$&",
							},
							{
								match: /updateSetting:.{0,60}USER_SETTINGS_OVERRIDE_CLEAR/,
								replace:
									"userSettingsAPIGroup:arguments[0].userSettingsAPIGroup,userSettingsAPIName:arguments[0].userSettingsAPIName,$&",
							},
						],
					},
				],
			});
		});
	var ub,
		mu,
		pb = g(() => {
			"use strict";
			a();
			F();
			P();
			De();
			T();
			(ub = x({
				disableAnalytics: {
					type: 3,
					description: "Disable Discord's tracking (analytics/'science')",
					default: !0,
					restartNeeded: !0,
				},
			})),
				(mu = h({
					name: "NoTrack",
					description:
						"Disable Discord's tracking (analytics/'science'), metrics and Sentry crash reporting",
					authors: [d.Cyn, d.Ven, d.Nuckyz, d.Arrow],
					required: !0,
					settings: ub,
					patches: [
						{
							find: "AnalyticsActionHandlers.handle",
							predicate: () => ub.store.disableAnalytics,
							replacement: { match: /^.+$/, replace: "()=>{}" },
						},
						{
							find: ".METRICS,",
							replacement: [
								{
									match: /this\._intervalId=/,
									replace: "this._intervalId=void 0&&",
								},
								{
									match: /(?:increment|distribution)\(\i(?:,\i)?\){/g,
									replace: "$&return;",
								},
							],
						},
						{
							find: ".installedLogHooks)",
							replacement: {
								match: "getDebugLogging(){",
								replace: "getDebugLogging(){return false;",
							},
						},
					],
					startAt: "Init",
					start() {
						Object.defineProperty(Function.prototype, "g", {
							configurable: !0,
							set(e) {
								Object.defineProperty(this, "g", {
									value: e,
									configurable: !0,
									enumerable: !0,
									writable: !0,
								});
								let { stack: t } = new Error();
								if (
									(console.log(t),
									this.c != null ||
										!t?.includes("http") ||
										!String(this).includes("exports:{}"))
								)
									return;
								let o = t.match(/http.+?(?=:\d+?:\d+?$)/m)?.[0];
								if (!o) return;
								let r = new XMLHttpRequest();
								if (
									(r.open("GET", o, !1),
									r.send(),
									!!r.responseText.includes(".DiscordSentry="))
								)
									throw (
										(new V("NoTrack", "#8caaee").info(
											"Disabling Sentry by erroring its WebpackInstance"
										),
										Reflect.deleteProperty(Function.prototype, "g"),
										Reflect.deleteProperty(window, "DiscordSentry"),
										new Error("Sentry successfully disabled"))
									);
							},
						}),
							Object.defineProperty(window, "DiscordSentry", {
								configurable: !0,
								set() {
									new V("NoTrack", "#8caaee").error(
										"Failed to disable Sentry. Falling back to deleting window.DiscordSentry"
									),
										Reflect.deleteProperty(Function.prototype, "g"),
										Reflect.deleteProperty(window, "DiscordSentry");
								},
							});
					},
				}));
		});
	function SR() {
		return n(
			qo,
			{ title: "Backup & Restore" },
			n(
				Nt,
				{ className: H("vc-settings-card", "vc-backup-restore-card") },
				n(
					pe,
					{ flexDirection: "column" },
					n("strong", null, "Warning"),
					n(
						"span",
						null,
						"Importing a settings file will overwrite your current settings."
					)
				)
			),
			n(
				Z,
				{ variant: "text-md/normal", className: G.bottom8 },
				"You can import and export your Vencord settings as a JSON file. This allows you to easily transfer your settings to another device, or recover your settings after reinstalling Vencord or Discord."
			),
			n(
				Z,
				{ variant: "text-md/normal", className: G.bottom8 },
				"Settings Export contains:",
				n(
					"ul",
					null,
					n("li", null, "\u2014 Custom QuickCSS"),
					n("li", null, "\u2014 Theme Links"),
					n("li", null, "\u2014 Plugin Settings")
				)
			),
			n(
				pe,
				null,
				n(M, { onClick: () => uS(), size: M.Sizes.SMALL }, "Import Settings"),
				n(M, { onClick: lS, size: M.Sizes.SMALL }, "Export Settings")
			)
		);
	}
	var db,
		mb = g(() => {
			"use strict";
			a();
			kt();
			Ye();
			me();
			Fa();
			b();
			Wn();
			db = vn(SR, "Backup & Restore");
		});
	function fb(e) {
		let t = {
			display: e.inline ? "inline-grid" : "grid",
			gridTemplateColumns: `repeat(${e.columns}, 1fr)`,
			gap: e.gap,
			...e.style,
		};
		return n("div", { ...e, style: t }, e.children);
	}
	var gb = g(() => {
		"use strict";
		a();
	});
	function bR(e) {
		try {
			return new URL(e), !0;
		} catch {
			return "Invalid URL";
		}
	}
	async function TR() {
		let e = await fetch(new URL("/v1/", xr()), {
			method: "DELETE",
			headers: { Authorization: await Xi() },
		});
		if (!e.ok) {
			Dc.error(`Failed to erase data, API returned ${e.status}`),
				ze({
					title: "Cloud Integrations",
					body: `Could not erase all data (API returned ${e.status}), please contact support.`,
					color: "var(--red-360)",
				});
			return;
		}
		(he.cloud.authenticated = !1),
			await Lc(),
			ze({
				title: "Cloud Integrations",
				body: "Successfully erased all data.",
				color: "var(--green-360)",
			});
	}
	function xR() {
		let { cloud: e } = Mt(["cloud.authenticated", "cloud.settingsSync"]),
			t = e.authenticated && e.settingsSync;
		return n(
			S.FormSection,
			{ title: "Settings Sync", className: G.top16 },
			n(
				S.FormText,
				{ variant: "text-md/normal", className: G.bottom20 },
				"Synchronize your settings to the cloud. This allows easy synchronization across multiple devices with minimal effort."
			),
			n(
				Vt,
				{
					key: "cloud-sync",
					disabled: !e.authenticated,
					value: e.settingsSync,
					onChange: (o) => {
						e.settingsSync = o;
					},
				},
				"Settings Sync"
			),
			n(
				"div",
				{ className: "vc-cloud-settings-sync-grid" },
				n(
					M,
					{ size: M.Sizes.SMALL, disabled: !t, onClick: () => Vi(!0) },
					"Sync to Cloud"
				),
				n(
					te,
					{
						text: "This will overwrite your local settings with the ones on the cloud. Use wisely!",
					},
					({ onMouseLeave: o, onMouseEnter: r }) =>
						n(
							M,
							{
								onMouseLeave: o,
								onMouseEnter: r,
								size: M.Sizes.SMALL,
								color: M.Colors.RED,
								disabled: !t,
								onClick: () => _c(!0, !0),
							},
							"Sync from Cloud"
						)
				),
				n(
					M,
					{
						size: M.Sizes.SMALL,
						color: M.Colors.RED,
						disabled: !t,
						onClick: () => pS(),
					},
					"Delete Cloud Settings"
				)
			)
		);
	}
	function wR() {
		let e = Mt(["cloud.authenticated", "cloud.url"]);
		return n(
			qo,
			{ title: "Vencord Cloud" },
			n(
				S.FormSection,
				{ title: "Cloud Settings", className: G.top16 },
				n(
					S.FormText,
					{ variant: "text-md/normal", className: G.bottom20 },
					"Vencord comes with a cloud integration that adds goodies like settings sync across devices. It ",
					n(
						He,
						{ href: "https://vencord.dev/cloud/privacy" },
						"respects your privacy"
					),
					", and the ",
					n(He, { href: "https://github.com/Vencord/Backend" }, "source code"),
					" is AGPL 3.0 licensed so you can host it yourself."
				),
				n(
					Vt,
					{
						key: "backend",
						value: e.cloud.authenticated,
						onChange: (t) => {
							t ? th() : (e.cloud.authenticated = t);
						},
						note: "This will request authorization if you have not yet set up cloud integrations.",
					},
					"Enable Cloud Integrations"
				),
				n(S.FormTitle, { tag: "h5" }, "Backend URL"),
				n(
					S.FormText,
					{ className: G.bottom8 },
					"Which backend to use when using cloud integrations."
				),
				n(Sa, {
					key: "backendUrl",
					value: e.cloud.url,
					onChange: async (t) => {
						(e.cloud.url = t), (e.cloud.authenticated = !1), Lc();
					},
					validate: bR,
				}),
				n(
					fb,
					{ columns: 2, gap: "1em", className: G.top8 },
					n(
						M,
						{
							size: M.Sizes.MEDIUM,
							disabled: !e.cloud.authenticated,
							onClick: async () => {
								await Lc(), (e.cloud.authenticated = !1), await th();
							},
						},
						"Reauthorise"
					),
					n(
						M,
						{
							size: M.Sizes.MEDIUM,
							color: M.Colors.RED,
							disabled: !e.cloud.authenticated,
							onClick: () =>
								Tt.show({
									title: "Are you sure?",
									body: "Once your data is erased, we cannot recover it. There's no going back!",
									onConfirm: TR,
									confirmText: "Erase it!",
									confirmColor: "vc-cloud-erase-data-danger-btn",
									cancelText: "Nevermind",
								}),
						},
						"Erase All Data"
					)
				),
				n(S.FormDivider, { className: G.top16 })
			),
			n(xR, null)
		);
	}
	var hb,
		yb = g(() => {
			"use strict";
			a();
			Bn();
			F();
			xc();
			gb();
			no();
			oh();
			Ye();
			Fa();
			b();
			Wn();
			hb = vn(wR, "Cloud");
		});
	var $H,
		vb = g(() => {
			"use strict";
			a();
			wc();
			fr();
			Ye();
			Jo();
			On();
			U();
			b();
			Wn();
			$H = $t(function ({ find: e, setModule: t, setError: o }) {
				let r = Qr(e),
					i = Object.keys(r),
					s = i.length;
				s === 0
					? o("No match. Perhaps that module is lazy loaded?")
					: s !== 1
						? o("Multiple matches. Please refine your filter")
						: t([i[0], r[i[0]]]);
			});
		});
	var Sb,
		bb = g(() => {
			"use strict";
			a();
			Dh();
			Wn();
			Sb = vn(kh, "Plugins");
		});
	var Tb = g(() => {});
	function jn(e) {
		let { Icon: t, action: o, text: r, disabled: i } = e;
		return n(
			"button",
			{ className: Oh("pill"), onClick: o, disabled: i },
			n(t, { className: Oh("img") }),
			r
		);
	}
	function fu(e) {
		return n(Nt, { className: Oh("card") }, e.children);
	}
	var Oh,
		Fh = g(() => {
			"use strict";
			a();
			Tb();
			tt();
			b();
			Oh = be("vc-settings-quickActions-");
		});
	function IR({ link: e }) {
		let [t, o, r] = pt(() =>
				fetch(e).then((s) => {
					if (s.status > 300) throw `${s.status} ${s.statusText}`;
					let l = s.headers.get("Content-Type");
					if (!l?.startsWith("text/css") && !l?.startsWith("text/plain"))
						throw "Not a CSS file. Remember to use the raw link!";
					return "Okay!";
				})
			),
			i = r
				? "Checking..."
				: o
					? `Error: ${o instanceof Error ? o.message : String(o)}`
					: "Valid!";
		return n(
			S.FormText,
			{
				style: {
					color: r
						? "var(--text-muted)"
						: o
							? "var(--text-danger)"
							: "var(--text-positive)",
				},
			},
			i
		);
	}
	function CR({ themeLinks: e }) {
		return e.length
			? n(
					f,
					null,
					n(S.FormTitle, { className: G.top20, tag: "h5" }, "Validator"),
					n(
						S.FormText,
						null,
						"This section will tell you whether your themes can successfully be loaded"
					),
					n(
						"div",
						null,
						e.map((t) =>
							n(
								Nt,
								{
									style: {
										padding: ".5em",
										marginBottom: ".5em",
										marginTop: ".5em",
									},
									key: t,
								},
								n(
									S.FormTitle,
									{ tag: "h5", style: { overflowWrap: "break-word" } },
									t
								),
								n(IR, { link: t })
							)
						)
					)
				)
			: null;
	}
	function AR({ theme: e, enabled: t, onChange: o, onDelete: r }) {
		return n(Wc, {
			name: e.name,
			description: e.description,
			author: e.author,
			enabled: t,
			setEnabled: o,
			infoButton: n(
				"div",
				{
					style: { cursor: "pointer", color: "var(--status-danger" },
					onClick: r,
				},
				n(_n, null)
			),
			footer: n(
				pe,
				{ flexDirection: "row", style: { gap: "0.2em" } },
				!!e.website && n(He, { href: e.website }, "Website"),
				!!(e.website && e.invite) && " \u2022 ",
				!!e.invite &&
					n(
						He,
						{
							href: `https://discord.gg/${e.invite}`,
							onClick: async (i) => {
								i.preventDefault(),
									e.invite != null &&
										ai(e.invite).catch(() => ft("Invalid or expired invite"));
							},
						},
						"Discord Server"
					)
			),
		});
	}
	function NR() {
		let e = Mt(["themeLinks", "enabledThemes"]),
			t = St(null),
			[o, r] = z(0),
			[i, s] = z(
				e.themeLinks.join(`
`)
			),
			[l, c] = z(null),
			[u, , p] = pt(VencordNative.themes.getThemesDir);
		ue(() => {
			m();
		}, []);
		async function m() {
			let A = await VencordNative.themes.getThemesList();
			c(A);
		}
		function y(A, L) {
			if (L) {
				if (e.enabledThemes.includes(A)) return;
				e.enabledThemes = [...e.enabledThemes, A];
			} else e.enabledThemes = e.enabledThemes.filter((k) => k !== A);
		}
		async function v(A) {
			if (
				(A.stopPropagation(),
				A.preventDefault(),
				!A.currentTarget?.files?.length)
			)
				return;
			let { files: L } = A.currentTarget,
				k = Array.from(L, ($) => {
					let { name: j } = $;
					if (!!j.endsWith(".css"))
						return new Promise((Q, ee) => {
							let J = new FileReader();
							(J.onload = () => {
								VencordNative.themes.uploadTheme(j, J.result).then(Q).catch(ee);
							}),
								J.readAsText($);
						});
				});
			await Promise.all(k), m();
		}
		function N() {
			return n(
				f,
				null,
				n(
					Nt,
					{ className: "vc-settings-card" },
					n(S.FormTitle, { tag: "h5" }, "Find Themes:"),
					n(
						"div",
						{
							style: {
								marginBottom: ".5em",
								display: "flex",
								flexDirection: "column",
							},
						},
						n(
							He,
							{
								style: { marginRight: ".5em" },
								href: "https://betterdiscord.app/themes",
							},
							"BetterDiscord Themes"
						),
						n(
							He,
							{ href: "https://github.com/search?q=discord+theme" },
							"GitHub"
						)
					),
					n(
						S.FormText,
						null,
						'If using the BD site, click on "Download" and place the downloaded .theme.css file into your themes folder.'
					)
				),
				n(
					S.FormSection,
					{ title: "Local Themes" },
					n(
						fu,
						null,
						n(
							f,
							null,
							n(jn, {
								text: n(
									"span",
									{ style: { position: "relative" } },
									"Upload Theme",
									n(PR, {
										ref: t,
										onChange: v,
										multiple: !0,
										filters: [{ extensions: ["css"] }],
									})
								),
								Icon: Ia,
							}),
							n(jn, { text: "Load missing Themes", action: m, Icon: Lg }),
							n(jn, {
								text: "Edit QuickCSS",
								action: () => VencordNative.quickCss.openEditor(),
								Icon: Ca,
							}),
							Vencord.Plugins.isPluginEnabled("ClientTheme") &&
								n(jn, {
									text: "Edit ClientTheme",
									action: () => rs(We.ClientTheme),
									Icon: Eg,
								})
						)
					),
					n(
						"div",
						{ className: MR("grid") },
						l?.map((A) =>
							n(AR, {
								key: A.fileName,
								enabled: e.enabledThemes.includes(A.fileName),
								onChange: (L) => y(A.fileName, L),
								onDelete: async () => {
									y(A.fileName, !1),
										await VencordNative.themes.deleteTheme(A.fileName),
										m();
								},
								theme: A,
							})
						)
					)
				)
			);
		}
		function w() {
			e.themeLinks = [
				...new Set(
					i
						.trim()
						.split(/\n+/)
						.map((A) => A.trim())
						.filter(Boolean)
				),
			];
		}
		function I() {
			return n(
				f,
				null,
				n(
					Nt,
					{ className: "vc-settings-card vc-text-selectable" },
					n(S.FormTitle, { tag: "h5" }, "Paste links to css files here"),
					n(S.FormText, null, "One link per line"),
					n(
						S.FormText,
						null,
						"Make sure to use direct links to files (raw or github.io)!"
					)
				),
				n(
					S.FormSection,
					{ title: "Online Themes", tag: "h5" },
					n(na, {
						value: i,
						onChange: s,
						className: "vc-settings-theme-links",
						placeholder: "Theme Links",
						spellCheck: !1,
						onBlur: w,
						rows: 10,
					}),
					n(CR, { themeLinks: e.themeLinks })
				)
			);
		}
		return n(
			qo,
			{ title: "Themes" },
			n(
				mo,
				{
					type: "top",
					look: "brand",
					className: "vc-settings-tab-bar",
					selectedItem: o,
					onItemSelect: r,
				},
				n(
					mo.Item,
					{ className: "vc-settings-tab-bar-item", id: 0 },
					"Local Themes"
				),
				n(
					mo.Item,
					{ className: "vc-settings-tab-bar-item", id: 1 },
					"Online Themes"
				)
			),
			o === 0 && N(),
			o === 1 && I()
		);
	}
	var PR,
		MR,
		xb,
		wb = g(() => {
			"use strict";
			a();
			F();
			tt();
			kt();
			yt();
			no();
			Hc();
			it();
			Ye();
			Gn();
			ct();
			U();
			b();
			Hn();
			Sh();
			Fh();
			Wn();
			(PR = Zl("activateUploadDialogue", "setRef")),
				(MR = be("vc-settings-theme-"));
			xb = vn(NR, "Themes");
		});
	var gu = g(() => {
		"use strict";
		a();
		F();
		gi();
		kt();
		no();
		Ye();
		me();
		Ke();
		Gn();
		ct();
		vi();
		b();
		os();
		Wn();
	});
	function kR() {
		let [e, , t] = pt(VencordNative.settings.getSettingsDir, {
				fallbackValue: "Loading...",
			}),
			o = Mt(),
			r = q.useMemo(() => (Math.random() > 0.5 ? Pb : Mb), []),
			i = navigator.platform.toLowerCase().startsWith("win"),
			s = navigator.platform.toLowerCase().startsWith("mac"),
			l = !1,
			c = [
				{
					key: "useQuickCss",
					title: "Enable Custom CSS",
					note: "Loads your Custom CSS",
				},
				!1,
				!1,
				!1,
				!1,
				!1,
			];
		return n(
			qo,
			{ title: "Vencord Settings" },
			n(DR, { image: r }),
			n(
				S.FormSection,
				{ title: "Quick Actions" },
				n(
					fu,
					null,
					n(jn, { Icon: Dg, text: "Notification Log", action: ka }),
					n(jn, {
						Icon: Ca,
						text: "Edit QuickCSS",
						action: () => VencordNative.quickCss.openEditor(),
					}),
					!1,
					!1,
					n(jn, {
						Icon: Aa,
						text: "View Source Code",
						action: () =>
							VencordNative.native.openExternal("https://github.com/" + yi),
					})
				)
			),
			n(S.FormDivider, null),
			n(
				S.FormSection,
				{ className: G.top16, title: "Settings", tag: "h5" },
				n(
					S.FormText,
					{ className: G.bottom20, style: { color: "var(--text-muted)" } },
					"Hint: You can change the position of this settings section in the",
					" ",
					n(
						M,
						{
							look: M.Looks.BLANK,
							style: { color: "var(--text-link)", display: "inline-block" },
							onClick: () => rs(Vencord.Plugins.plugins.Settings),
						},
						"settings of the Settings plugin"
					),
					"!"
				),
				c.map(
					(u) =>
						u &&
						n(
							Vt,
							{
								key: u.key,
								value: o[u.key],
								onChange: (p) => (o[u.key] = p),
								note: u.note,
							},
							u.title
						)
				)
			),
			l &&
				n(
					f,
					null,
					n(
						S.FormTitle,
						{ tag: "h5" },
						"Window vibrancy style (requires restart)"
					),
					n(Do, {
						className: G.bottom20,
						placeholder: "Window vibrancy style",
						options: [
							{ label: "No vibrancy", value: void 0 },
							{ label: "Under Page (window tinting)", value: "under-page" },
							{ label: "Content", value: "content" },
							{ label: "Window", value: "window" },
							{ label: "Selection", value: "selection" },
							{ label: "Titlebar", value: "titlebar" },
							{ label: "Header", value: "header" },
							{ label: "Sidebar", value: "sidebar" },
							{ label: "Tooltip", value: "tooltip" },
							{ label: "Menu", value: "menu" },
							{ label: "Popover", value: "popover" },
							{
								label: "Fullscreen UI (transparent but slightly muted)",
								value: "fullscreen-ui",
							},
							{ label: "HUD (Most transparent)", value: "hud" },
						],
						select: (u) => (o.macosVibrancyStyle = u),
						isSelected: (u) => o.macosVibrancyStyle === u,
						serialize: Fi,
					})
				),
			n(
				S.FormSection,
				{ className: G.top16, title: "Vencord Notifications", tag: "h5" },
				n(
					pe,
					null,
					n(M, { onClick: Ic }, "Notification Settings"),
					n(M, { onClick: ka }, "View Notification Log")
				)
			)
		);
	}
	function DR({ image: e }) {
		return n(
			Nt,
			{ className: RR("card", "donate") },
			n(
				"div",
				null,
				n(S.FormTitle, { tag: "h5" }, "Support the Project"),
				n(
					S.FormText,
					null,
					"Please consider supporting the development of Vencord by donating!"
				),
				n(ya, { style: { transform: "translateX(-1em)" } })
			),
			n("img", {
				role: "presentation",
				src: e,
				alt: "",
				height: 128,
				style: {
					imageRendering: e === Mb ? "pixelated" : void 0,
					marginLeft: "auto",
					transform: e === Pb ? "rotate(10deg)" : void 0,
				},
			})
		);
	}
	var RR,
		Pb,
		Mb,
		Ib,
		Cb = g(() => {
			"use strict";
			a();
			Ac();
			F();
			tt();
			vc();
			Hc();
			Uc();
			Ye();
			me();
			Gn();
			ct();
			b();
			Na();
			Gg();
			Fh();
			Wn();
			(RR = be("vc-settings-")),
				(Pb = "https://cdn.discordapp.com/emojis/1026533090627174460.png"),
				(Mb = "https://media.discordapp.net/stickers/1039992459209490513.png");
			Ib = vn(kR, "Vencord Settings");
		});
	var Ab,
		cs,
		_h = g(() => {
			"use strict";
			a();
			F();
			mb();
			yb();
			vb();
			bb();
			wb();
			gu();
			Cb();
			P();
			T();
			b();
			os();
			(Ab = x({
				settingsLocation: {
					type: 4,
					description: "Where to put the Vencord settings section",
					options: [
						{ label: "At the very top", value: "top" },
						{
							label: "Above the Nitro section",
							value: "aboveNitro",
							default: !0,
						},
						{ label: "Below the Nitro section", value: "belowNitro" },
						{ label: "Above Activity Settings", value: "aboveActivity" },
						{ label: "Below Activity Settings", value: "belowActivity" },
						{ label: "At the very bottom", value: "bottom" },
					],
				},
			})),
				(cs = h({
					name: "Settings",
					description: "Adds Settings UI and debug info",
					authors: [d.Ven, d.Megu],
					required: !0,
					settings: Ab,
					patches: [
						{
							find: ".versionHash",
							replacement: [
								{
									match:
										/\[\(0,\i\.jsxs?\)\((.{1,10}),(\{[^{}}]+\{.{0,20}.versionHash,.+?\})\)," "/,
									replace: (e, t, o) => (
										(o = o.replace(/children:\[.+\]/, "")),
										`${e},$self.makeInfoElements(${t}, ${o})`
									),
								},
								{
									match: /copyValue:\i\.join\(" "\)/,
									replace: "$& + $self.getInfoString()",
								},
							],
						},
						{
							find: "Messages.ACTIVITY_SETTINGS",
							replacement: [
								{
									match:
										/(?<=section:(.{0,50})\.DIVIDER\}\))([,;])(?=.{0,200}(\i)\.push.{0,100}label:(\i)\.header)/,
									replace: (e, t, o, r, i) =>
										`${o} $self.addSettings(${r}, ${i}, ${t}) ${o}`,
								},
								{
									match:
										/({(?=.+?function (\i).{0,120}(\i)=\i\.useMemo.{0,30}return \i\.useMemo\(\(\)=>\i\(\3).+?function\(\){return )\2(?=})/,
									replace: (e, t, o) => `${t}$self.wrapSettingsHook(${o})`,
								},
							],
						},
						{
							find: "Messages.USER_SETTINGS_ACTIONS_MENU_LABEL",
							replacement: {
								match:
									/(?<=function\((\i),\i\)\{)(?=let \i=Object.values\(\i.\i\).*?(\i\.\i)\.open\()/,
								replace: "$2.open($1);return;",
							},
						},
					],
					customSections: [],
					makeSettingsCategories(e) {
						return [
							{
								section: e.HEADER,
								label: "Vencord",
								className: "vc-settings-header",
							},
							{
								section: "VencordSettings",
								label: "Vencord",
								element: Ib,
								className: "vc-settings",
							},
							{
								section: "VencordPlugins",
								label: "Plugins",
								element: Sb,
								className: "vc-plugins",
							},
							{
								section: "VencordThemes",
								label: "Themes",
								element: xb,
								className: "vc-themes",
							},
							!1,
							{
								section: "VencordCloud",
								label: "Cloud",
								element: hb,
								className: "vc-cloud",
							},
							{
								section: "VencordSettingsSync",
								label: "Backup & Restore",
								element: db,
								className: "vc-backup-restore",
							},
							!1,
							...this.customSections.map((t) => t(e)),
							{ section: e.DIVIDER },
						].filter(Boolean);
					},
					isRightSpot({ header: e, settingsChilds: t }) {
						let o = t?.[0];
						if (o === "LOGOUT" || o === "SOCIAL_LINKS") return !0;
						let { settingsLocation: r } = Ab.store;
						if (r === "bottom") return o === "LOGOUT";
						if (r === "belowActivity") return o === "CHANGELOG";
						if (!e) return;
						let i = {
							top: Se.Messages.USER_SETTINGS,
							aboveNitro: Se.Messages.BILLING_SETTINGS,
							belowNitro: Se.Messages.APP_SETTINGS,
							aboveActivity: Se.Messages.ACTIVITY_SETTINGS,
						};
						return e === i[r];
					},
					patchedSettings: new WeakSet(),
					addSettings(e, t, o) {
						this.patchedSettings.has(e) ||
							!this.isRightSpot(t) ||
							(this.patchedSettings.add(e),
							e.push(...this.makeSettingsCategories(o)));
					},
					wrapSettingsHook(e) {
						return (...t) => {
							let o = e(...t);
							return (
								this.patchedSettings.has(o) ||
									o.unshift(
										...this.makeSettingsCategories({
											HEADER: "HEADER",
											DIVIDER: "DIVIDER",
											CUSTOM: "CUSTOM",
										})
									),
								o
							);
						};
					},
					get electronVersion() {
						return (
							VencordNative.native.getVersions().electron ||
							window.armcord?.electron ||
							null
						);
					},
					get chromiumVersion() {
						try {
							return (
								VencordNative.native.getVersions().chrome ||
								navigator.userAgentData?.brands?.find(
									(e) => e.brand === "Chromium" || e.brand === "Google Chrome"
								)?.version ||
								null
							);
						} catch {
							return null;
						}
					},
					get additionalInfo() {
						return " (Web)";
					},
					getInfoRows() {
						let {
								electronVersion: e,
								chromiumVersion: t,
								additionalInfo: o,
							} = this,
							r = [`Vencord ${yn}${o}`];
						return (
							e && r.push(`Electron ${e}`), t && r.push(`Chromium ${t}`), r
						);
					},
					getInfoString() {
						return (
							`
` +
							this.getInfoRows().join(`
`)
						);
					},
					makeInfoElements(e, t) {
						return this.getInfoRows().map((o, r) => n(e, { key: r, ...t }, o));
					},
				}));
		});
	var Bh = {};
	et(Bh, {
		_modifyAccessories: () => LR,
		accessories: () => hu,
		addAccessory: () => bi,
		removeAccessory: () => Qa,
	});
	function bi(e, t, o) {
		hu.set(e, { callback: t, position: o });
	}
	function Qa(e) {
		hu.delete(e);
	}
	function LR(e, t) {
		for (let o of hu.values()) {
			let r = o.callback(t);
			if (r != null) {
				if (!Array.isArray(r)) r = [r];
				else if (r.length === 0) continue;
				e.splice(
					o.position != null
						? o.position < 0
							? e.length + o.position
							: o.position
						: e.length,
					0,
					...r.filter((i) => i != null)
				);
			}
		}
		return e;
	}
	var hu,
		Xa = g(() => {
			"use strict";
			a();
			hu = new Map();
		});
	var $h = {};
	et($h, {
		UserSettings: () => Uh,
		getUserSetting: () => Nb,
		getUserSettingLazy: () => Uo,
	});
	function Nb(e, t) {
		if (!Vencord.Plugins.isPluginEnabled("UserSettingsAPI"))
			throw new Error(
				"Cannot use UserSettingsAPI without setting as dependency."
			);
		for (let o in Uh) {
			let r = Uh[o];
			if (r.userSettingsAPIGroup === e && r.userSettingsAPIName === t) return r;
		}
		throw new Error(`UserSettingsAPI: Setting ${e}.${t} not found.`);
	}
	function Uo(e, t) {
		return Dt(() => Nb(e, t));
	}
	var Uh,
		Ir = g(() => {
			"use strict";
			a();
			co();
			U();
			Uh = Ql('"textAndImages","renderSpoilers"');
		});
	async function kb() {
		let { RELEASE_CHANNEL: e } = window.GLOBAL_ENV,
			t = (() =>
				"armcord" in window
					? `ArmCord v${window.armcord.version}`
					: `${typeof unsafeWindow < "u" ? "UserScript" : "Web"} (${navigator.userAgent})`)(),
			o = {
				Vencord: `v1.9.8 \u2022 [${yn}](<https://github.com/Vendicated/Vencord/commit/${yn}>)${cs.additionalInfo} - ${Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(1725234243248)}`,
				Client: `${e} ~ ${t}`,
				Platform: window.navigator.platform,
			},
			r = {
				"NoRPC enabled": Vencord.Plugins.isPluginEnabled("NoRPC"),
				"Activity Sharing disabled": Xf(() => !UR.getSetting(), !1),
				"Vencord DevBuild": !1,
				"Has UserPlugins": Object.values(is).some((s) => s.userPlugin),
				"More than two weeks out of date": 1725234243248 < Date.now() - 12096e5,
			},
			i = `>>> ${Object.entries(o).map(([s, l]) => `**${s}**: ${l}`).join(`
`)}`;
		return (
			(i +=
				`
` +
				Object.entries(r)
					.filter(([, s]) => s)
					.map(([s]) => `\u26A0\uFE0F ${s}`).join(`
`)),
			i.trim()
		);
	}
	function Db() {
		let e = (s) => s.endsWith("API") || We[s].required,
			t = Object.keys(We).filter(
				(s) => Vencord.Plugins.isPluginEnabled(s) && !e(s)
			),
			o = t.filter((s) => !is[s].userPlugin),
			r = t.filter((s) => is[s].userPlugin),
			i = `**Enabled Plugins (${o.length}):**
${fi(o.join(", "))}`;
		return (
			r.length &&
				(i += `**Enabled UserPlugins (${r.length}):**
${fi(r.join(", "))}`),
			i
		);
	}
	var ER,
		OR,
		FR,
		Rb,
		_R,
		BR,
		UR,
		ij,
		$R,
		yu,
		Lb = g(() => {
			"use strict";
			a();
			Xa();
			F();
			Ir();
			re();
			kt();
			no();
			gu();
			P();
			it();
			De();
			Ye();
			me();
			Gn();
			ma();
			On();
			T();
			vi();
			b();
			os();
			Hn();
			_h();
			(ER = "1015060230222131221"),
				(OR = "1017176847865352332"),
				(FR = /```js\n(.+?)```/s),
				(Rb = [Ei, "1024286218801926184", "1033680203433660458"]),
				(_R = [
					"1026534353167208489",
					"1026504932959977532",
					"1042507929485586532",
				]),
				(BR = async function () {}.constructor),
				(UR = Uo("status", "showCurrentGame"));
			(ij = pi(Wa)),
				($R = x({}).withPrivateSettings()),
				(yu = h({
					name: "SupportHelper",
					required: !0,
					description: "Helps us provide support to you",
					authors: [d.Ven],
					dependencies: [
						"CommandsAPI",
						"UserSettingsAPI",
						"MessageAccessoriesAPI",
					],
					settings: $R,
					patches: [
						{
							find: ".BEGINNING_DM.format",
							replacement: {
								match:
									/BEGINNING_DM\.format\(\{.+?\}\),(?=.{0,100}userId:(\i\.getRecipientId\(\)))/,
								replace: "$& $self.ContributorDmWarningCard({ userId: $1 }),",
							},
						},
					],
					commands: [
						{
							name: "vencord-debug",
							description: "Send Vencord debug info",
							predicate: (e) =>
								In(D.getCurrentUser()?.id) || Rb.includes(e.channel.id),
							execute: async () => ({ content: await kb() }),
						},
						{
							name: "vencord-plugins",
							description: "Send Vencord plugin list",
							predicate: (e) =>
								In(D.getCurrentUser()?.id) || Rb.includes(e.channel.id),
							execute: () => ({ content: Db() }),
						},
					],
					flux: {
						async CHANNEL_SELECT({ channelId: e }) {
							if (e !== Ei) return;
							let t = D.getCurrentUser()?.id;
							if (!t || In(t)) return;
							let o = Le.getSelfMember(ER)?.roles;
							!o || _R.some((r) => o.includes(r));
						},
					},
					ContributorDmWarningCard: R.wrap(
						({ userId: e }) =>
							!In(e) || Ie.isFriend(e) || In(D.getCurrentUser()?.id)
								? null
								: n(
										Nt,
										{ className: `vc-plugins-restart-card ${G.top8}` },
										"Please do not private message Vencord plugin developers for support!",
										n("br", null),
										"Instead, use the Vencord support channel: ",
										Ce.parse(
											"https://discord.com/channels/1015060230222131221/1026515880080842772"
										),
										!oe.getChannel(Ei) && " (Click the link to join)"
									),
						{ noop: !0 }
					),
					start() {
						bi("vencord-debug", (e) => {
							let t = [];
							if (
								e.channel.id === Ei &&
								((e.message.content.includes("/vencord-debug") ||
									e.message.content.includes("/vencord-plugins")) &&
									t.push(
										n(
											M,
											{
												key: "vc-dbg",
												onClick: async () =>
													dc(e.channel.id, { content: await kb() }),
											},
											"Run /vencord-debug"
										),
										n(
											M,
											{
												key: "vc-plg-list",
												onClick: async () =>
													dc(e.channel.id, { content: Db() }),
											},
											"Run /vencord-plugins"
										)
									),
								e.message.author.id === OR)
							) {
								let r = FR.exec(
									e.message.content || e.message.embeds[0]?.rawDescription || ""
								);
								r &&
									t.push(
										n(
											M,
											{
												key: "vc-run-snippet",
												onClick: async () => {
													try {
														await BR(r[1])(), ft("Success!", X.Type.SUCCESS);
													} catch (i) {
														new V(this.name).error(
															"Error while running snippet:",
															i
														),
															ft("Failed to run snippet :(", X.Type.FAILURE);
													}
												},
											},
											"Run Snippet"
										)
									);
							}
							return t.length ? n(pe, null, t) : null;
						});
					},
				}));
		});
	var vu,
		Eb = g(() => {
			"use strict";
			a();
			P();
			T();
			vu = h({
				name: "AlwaysAnimate",
				description: "Animates anything that can be animated",
				authors: [d.FieryFlames],
				patches: [
					{
						find: "canAnimate:",
						all: !0,
						noWarn: !0,
						replacement: {
							match: /canAnimate:.+?([,}].*?\))/g,
							replace: (e, t) =>
								t.match(/}=.+/) == null ? `canAnimate:!0${t}` : e,
						},
					},
					{
						find: ".Messages.GUILD_OWNER,",
						replacement: {
							match: /(?<=\.activityEmoji,.+?animate:)\i/,
							replace: "!0",
						},
					},
					{
						find: ".animatedBannerHoverLayer,onMouseEnter:",
						replacement: {
							match: /(?<=guildBanner:\i,animate:)\i(?=}\))/,
							replace: "!0",
						},
					},
				],
			});
		});
	var Gh,
		Su,
		Ob = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(Gh = x({
				domain: {
					type: 3,
					default: !0,
					description: "Remove the untrusted domain popup when opening links",
					restartNeeded: !0,
				},
				file: {
					type: 3,
					default: !0,
					description:
						"Remove the 'Potentially Dangerous Download' popup when opening links",
					restartNeeded: !0,
				},
			})),
				(Su = h({
					name: "AlwaysTrust",
					description:
						"Removes the annoying untrusted domain and suspicious file popup",
					authors: [d.zt, d.Trwy],
					patches: [
						{
							find: '="MaskedLinkStore",',
							replacement: {
								match: /(?<=isTrustedDomain\(\i\){)return \i\(\i\)/,
								replace: "return true",
							},
							predicate: () => Gh.store.domain,
						},
						{
							find: "bitbucket.org",
							replacement: {
								match: /function \i\(\i\){(?=.{0,60}\.parse\(\i\))/,
								replace: "$&return null;",
							},
							predicate: () => Gh.store.file,
						},
					],
					settings: Gh,
				}));
		});
	var GR,
		HR,
		zR,
		Cr,
		bu,
		Fb = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			T();
			U();
			(GR = ae(".actionBarIcon)")),
				(HR = C("popFirstFile", "update")),
				(zR = /\.tar\.\w+$/),
				(Cr = x({
					anonymiseByDefault: {
						description: "Whether to anonymise file names by default",
						type: 3,
						default: !0,
					},
					method: {
						description: "Anonymising method",
						type: 4,
						options: [
							{ label: "Random Characters", value: 0, default: !0 },
							{ label: "Consistent", value: 1 },
							{ label: "Timestamp", value: 2 },
						],
					},
					randomisedLength: {
						description: "Random characters length",
						type: 1,
						default: 7,
						disabled: () => Cr.store.method !== 0,
					},
					consistent: {
						description: "Consistent filename",
						type: 0,
						default: "image",
						disabled: () => Cr.store.method !== 1,
					},
				})),
				(bu = h({
					name: "AnonymiseFileNames",
					authors: [d.fawn],
					description: "Anonymise uploaded file names",
					patches: [
						{
							find: "instantBatchUpload:function",
							replacement: {
								match: /uploadFiles:(\i),/,
								replace:
									"uploadFiles:(...args)=>(args[0].uploads.forEach(f=>f.filename=$self.anonymise(f)),$1(...args)),",
							},
						},
						{
							find: 'addFilesTo:"message.attachments"',
							replacement: {
								match: /(\i.uploadFiles\((\i),)/,
								replace: "$2.forEach(f=>f.filename=$self.anonymise(f)),$1",
							},
						},
						{
							find: ".Messages.ATTACHMENT_UTILITIES_SPOILER",
							replacement: {
								match:
									/(?<=children:\[)(?=.{10,80}tooltip:.{0,100}\i\.\i\.Messages\.ATTACHMENT_UTILITIES_SPOILER)/,
								replace:
									"arguments[0].canEdit!==false?$self.renderIcon(arguments[0]):null,",
							},
						},
					],
					settings: Cr,
					renderIcon: R.wrap(
						({ upload: e, channelId: t, draftType: o }) => {
							let r = e.anonymise ?? Cr.store.anonymiseByDefault;
							return n(
								GR,
								{
									tooltip: r
										? "Using anonymous file name"
										: "Using normal file name",
									onClick: () => {
										(e.anonymise = !r), HR.update(t, e.id, o, {});
									},
								},
								r
									? n(
											"svg",
											{
												xmlns: "http://www.w3.org/2000/svg",
												viewBox: "0 0 24 24",
											},
											n("path", {
												fill: "currentColor",
												d: "M17.06 13C15.2 13 13.64 14.33 13.24 16.1C12.29 15.69 11.42 15.8 10.76 16.09C10.35 14.31 8.79 13 6.94 13C4.77 13 3 14.79 3 17C3 19.21 4.77 21 6.94 21C9 21 10.68 19.38 10.84 17.32C11.18 17.08 12.07 16.63 13.16 17.34C13.34 19.39 15 21 17.06 21C19.23 21 21 19.21 21 17C21 14.79 19.23 13 17.06 13M6.94 19.86C5.38 19.86 4.13 18.58 4.13 17S5.39 14.14 6.94 14.14C8.5 14.14 9.75 15.42 9.75 17S8.5 19.86 6.94 19.86M17.06 19.86C15.5 19.86 14.25 18.58 14.25 17S15.5 14.14 17.06 14.14C18.62 14.14 19.88 15.42 19.88 17S18.61 19.86 17.06 19.86M22 10.5H2V12H22V10.5M15.53 2.63C15.31 2.14 14.75 1.88 14.22 2.05L12 2.79L9.77 2.05L9.72 2.04C9.19 1.89 8.63 2.17 8.43 2.68L6 9H18L15.56 2.68L15.53 2.63Z",
											})
										)
									: n(
											"svg",
											{
												xmlns: "http://www.w3.org/2000/svg",
												viewBox: "0 0 24 24",
												style: { transform: "scale(-1,1)" },
											},
											n("path", {
												fill: "currentColor",
												d: "M22.11 21.46L2.39 1.73L1.11 3L6.31 8.2L6 9H7.11L8.61 10.5H2V12H10.11L13.5 15.37C13.38 15.61 13.3 15.85 13.24 16.1C12.29 15.69 11.41 15.8 10.76 16.09C10.35 14.31 8.79 13 6.94 13C4.77 13 3 14.79 3 17C3 19.21 4.77 21 6.94 21C9 21 10.68 19.38 10.84 17.32C11.18 17.08 12.07 16.63 13.16 17.34C13.34 19.39 15 21 17.06 21C17.66 21 18.22 20.86 18.72 20.61L20.84 22.73L22.11 21.46M6.94 19.86C5.38 19.86 4.13 18.58 4.13 17C4.13 15.42 5.39 14.14 6.94 14.14C8.5 14.14 9.75 15.42 9.75 17C9.75 18.58 8.5 19.86 6.94 19.86M17.06 19.86C15.5 19.86 14.25 18.58 14.25 17C14.25 16.74 14.29 16.5 14.36 16.25L17.84 19.73C17.59 19.81 17.34 19.86 17.06 19.86M22 12H15.2L13.7 10.5H22V12M17.06 13C19.23 13 21 14.79 21 17C21 17.25 20.97 17.5 20.93 17.73L19.84 16.64C19.68 15.34 18.66 14.32 17.38 14.17L16.29 13.09C16.54 13.03 16.8 13 17.06 13M12.2 9L7.72 4.5L8.43 2.68C8.63 2.17 9.19 1.89 9.72 2.04L9.77 2.05L12 2.79L14.22 2.05C14.75 1.88 15.32 2.14 15.54 2.63L15.56 2.68L18 9H12.2Z",
											})
										)
							);
						},
						{ noop: !0 }
					),
					anonymise(e) {
						if ((e.anonymise ?? Cr.store.anonymiseByDefault) === !1)
							return e.filename;
						let t = e.filename,
							r = zR.exec(t)?.index ?? t.lastIndexOf("."),
							i = r !== -1 ? t.slice(r) : "";
						switch (Cr.store.method) {
							case 0:
								let s =
									"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
								return (
									Array.from(
										{ length: Cr.store.randomisedLength },
										() => s[Math.floor(Math.random() * s.length)]
									).join("") + i
								);
							case 1:
								return Cr.store.consistent + i;
							case 2:
								return Date.now() + i;
						}
					},
				}));
		});
	async function _b(e, t) {
		return (await ii.fetchAssetIds(e, [t]))[0];
	}
	async function jR(e) {
		let t = {};
		return await WR(t, e), t.application;
	}
	var WR,
		Bb,
		us,
		Tu,
		Ub = g(() => {
			"use strict";
			a();
			Bc();
			no();
			P();
			T();
			U();
			b();
			WR = fe("APPLICATION_RPC(", "Client ID");
			Bb = {};
			Tu = h({
				name: "WebRichPresence (arRPC)",
				description:
					"Client plugin for arRPC to enable RPC on Discord Web (experimental)",
				authors: [d.Ducko],
				reporterTestable: 2,
				settingsAboutComponent: () =>
					n(
						f,
						null,
						n(S.FormTitle, { tag: "h3" }, "How to use arRPC"),
						n(
							S.FormText,
							null,
							n(
								He,
								{ href: "https://github.com/OpenAsar/arrpc/tree/main#server" },
								"Follow the instructions in the GitHub repo"
							),
							" to get the server running, and then enable the plugin."
						)
					),
				async handleEvent(e) {
					let t = JSON.parse(e.data),
						{ activity: o } = t,
						r = o?.assets;
					if (
						(r?.large_image &&
							(r.large_image = await _b(o.application_id, r.large_image)),
						r?.small_image &&
							(r.small_image = await _b(o.application_id, r.small_image)),
						o)
					) {
						let i = o.application_id;
						Bb[i] ||= await jR(i);
						let s = Bb[i];
						o.name ||= s.name;
					}
					_.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...t });
				},
				async start() {
					if ("armcord" in window) return;
					if (
						(us && us.close(),
						(us = new WebSocket("ws://127.0.0.1:1337")),
						(us.onmessage = this.handleEvent),
						!(await new Promise((t) =>
							setTimeout(() => t(us.readyState === WebSocket.OPEN), 1e3)
						)))
					) {
						Ba("Failed to connect to arRPC, is it running?", "Retry", () => {
							sh(), this.start();
						});
						return;
					}
					X.show({
						message: "Connected to arRPC",
						type: X.Type.SUCCESS,
						id: X.genId(),
						options: { duration: 1e3, position: X.Position.BOTTOM },
					});
				},
				stop() {
					_.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null }),
						us?.close();
				},
			});
		});
	var $b,
		xu,
		Gb = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			($b = x({
				source: {
					description: "Source to replace ban GIF with (Video or Gif)",
					type: 0,
					default: "https://i.imgur.com/wp5q52C.mp4",
					restartNeeded: !0,
				},
			})),
				(xu = h({
					name: "BANger",
					description:
						"Replaces the GIF in the ban dialogue with a custom one.",
					authors: [d.Xinto, d.Glitch],
					settings: $b,
					patches: [
						{
							find: "BAN_CONFIRM_TITLE.",
							replacement: {
								match: /src:\i\("?\d+"?\)/g,
								replace: "src:$self.source",
							},
						},
					],
					get source() {
						return $b.store.source;
					},
				}));
		});
	var Hb,
		zb,
		qR,
		Wb,
		jb = g(() => {
			"use strict";
			a();
			re();
			U();
			b();
			zh();
			(Hb = K("ChannelRTCStore")),
				(zb = C("a", "animated", "useTransition")),
				(qR = ae('("guildsnav")')),
				(Wb = R.wrap(
					(e) => {
						let t = Oe([ps], () => ps.getExpandedFolders()),
							o = Oe([Hb], () => Hb.isFullscreenInContext()),
							r = n(qR, {
								...e,
								isBetterFolders: !0,
								betterFoldersExpandedIds: t,
							}),
							i = !!t.size,
							s = document.querySelector(
								e.className
									.split(" ")
									.map((c) => `.${c}`)
									.join("")
							),
							l = { display: o ? "none" : "flex" };
						return !s || !Et.store.sidebarAnim
							? i
								? n("div", { style: l }, r)
								: null
							: n(
									zb.Transition,
									{
										items: i,
										from: { width: 0 },
										enter: { width: s.getBoundingClientRect().width },
										leave: { width: 0 },
										config: { duration: 200 },
									},
									(c, u) =>
										u && n(zb.animated.div, { style: { ...c, ...l } }, r)
								);
					},
					{ noop: !0 }
				));
		});
	function ZR(e) {
		return YR.getGuildFolders().find((t) => t.guildIds.includes(e));
	}
	function jh() {
		for (let e of ps.getExpandedFolders()) qh.toggleGuildFolderExpand(e);
	}
	var KR,
		YR,
		ps,
		qh,
		qb,
		Wh,
		Et,
		wu,
		zh = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			U();
			b();
			jb();
			(KR = _e((e) => e.prototype?.moveNextTo)),
				(YR = K("SortedGuildStore")),
				(ps = K("ExpandedGuildFolderStore")),
				(qh = C("move", "toggleGuildFolderExpand")),
				(qb = null),
				(Wh = !1);
			(Et = x({
				sidebar: {
					type: 3,
					description: "Display servers from folder on dedicated sidebar",
					restartNeeded: !0,
					default: !0,
				},
				sidebarAnim: {
					type: 3,
					description: "Animate opening the folder sidebar",
					default: !0,
				},
				closeAllFolders: {
					type: 3,
					description:
						"Close all folders when selecting a server not in a folder",
					default: !1,
				},
				closeAllHomeButton: {
					type: 3,
					description: "Close all folders when clicking on the home button",
					restartNeeded: !0,
					default: !1,
				},
				closeOthers: {
					type: 3,
					description: "Close other folders when opening a folder",
					default: !1,
				},
				forceOpen: {
					type: 3,
					description:
						"Force a folder to open when switching to a server of that folder",
					default: !1,
				},
				keepIcons: {
					type: 3,
					description:
						"Keep showing guild icons in the primary guild bar folder when it's open in the BetterFolders sidebar",
					restartNeeded: !0,
					default: !1,
				},
				showFolderIcon: {
					type: 4,
					description:
						"Show the folder icon above the folder guilds in the BetterFolders sidebar",
					options: [
						{ label: "Never", value: 0 },
						{ label: "Always", value: 1, default: !0 },
						{ label: "When more than one folder is expanded", value: 2 },
					],
					restartNeeded: !0,
				},
			})),
				(wu = h({
					name: "BetterFolders",
					description:
						"Shows server folders on dedicated sidebar and adds folder related improvements",
					authors: [d.juby, d.AutumnVN, d.Nuckyz],
					settings: Et,
					patches: [
						{
							find: '("guildsnav")',
							predicate: () => Et.store.sidebar,
							replacement: [
								{
									match:
										/let{disableAppDownload:\i=\i\.isPlatformEmbedded,isOverlay:.+?(?=}=\i,)/,
									replace: "$&,isBetterFolders",
								},
								{
									match:
										/\[(\i)\]=(\(0,\i\.\i\).{0,40}getGuildsTree\(\).+?}\))(?=,)/,
									replace: (e, t, o) =>
										`[betterFoldersOriginalTree]=${o},${t}=$self.getGuildTree(!!arguments[0].isBetterFolders,betterFoldersOriginalTree,arguments[0].betterFoldersExpandedIds)`,
								},
								{
									match:
										/lastTargetNode:\i\[\i\.length-1\].+?Fragment.+?\]}\)\]/,
									replace:
										"$&.filter($self.makeGuildsBarGuildListFilter(!!arguments[0].isBetterFolders))",
								},
								{
									match: /unreadMentionsIndicatorBottom,.+?}\)\]/,
									replace:
										"$&.filter($self.makeGuildsBarTreeFilter(!!arguments[0].isBetterFolders))",
								},
								{
									match:
										/(?<=\.Messages\.SERVERS.+?switch\((\i)\.type\){case \i\.\i\.FOLDER:.+?folderNode:\i,)/,
									replace:
										'isBetterFolders:typeof isBetterFolders!=="undefined"?isBetterFolders:false,',
								},
							],
						},
						{
							find: ".toggleGuildFolderExpand(",
							predicate: () =>
								Et.store.sidebar && Et.store.showFolderIcon !== 1,
							replacement: [
								{
									match: /(\],\(\)=>)(\i\.\i)\.isFolderExpanded\(\i\)\)/,
									replace: (e, t, o) => `${t}${o}.getExpandedFolders())`,
								},
								{
									match: /(?<=folderNode:(\i),expanded:)\i(?=,)/,
									replace: (e, t) =>
										`typeof ${e}==="boolean"?${e}:${e}.has(${t}.id),betterFoldersExpandedIds:${e} instanceof Set?${e}:void 0`,
								},
							],
						},
						{
							find: ".FOLDER_ITEM_GUILD_ICON_MARGIN);",
							predicate: () => Et.store.sidebar,
							replacement: [
								{
									predicate: () => Et.store.keepIcons,
									match:
										/(?<=let{folderNode:\i,setNodeRef:\i,.+?expanded:(\i),.+?;)(?=let)/,
									replace: (e, t) =>
										`${t}=!!arguments[0].isBetterFolders&&${t};`,
								},
								{
									predicate: () => !Et.store.keepIcons,
									match:
										/(?<=\.Messages\.SERVER_FOLDER_PLACEHOLDER.+?useTransition\)\()/,
									replace: "!!arguments[0].isBetterFolders&&",
								},
								{
									predicate: () => !Et.store.keepIcons,
									match:
										/expandedFolderBackground,.+?,(?=\i\(\(\i,\i,\i\)=>{let{key.{0,45}ul)(?<=selected:\i,expanded:(\i),.+?)/,
									replace: (e, t) =>
										`${e}!arguments[0].isBetterFolders&&${t}?null:`,
								},
								{
									predicate: () => Et.store.showFolderIcon !== 1,
									match: /(?<=\.wrapper,children:\[)/,
									replace:
										"$self.shouldShowFolderIconAndBackground(!!arguments[0].isBetterFolders,arguments[0].betterFoldersExpandedIds)&&",
								},
								{
									predicate: () => Et.store.showFolderIcon !== 1,
									match: /(?<=\.expandedFolderBackground.+?}\),)(?=\i,)/,
									replace:
										"!$self.shouldShowFolderIconAndBackground(!!arguments[0].isBetterFolders,arguments[0].betterFoldersExpandedIds)?null:",
								},
							],
						},
						{
							find: "APPLICATION_LIBRARY,render:",
							predicate: () => Et.store.sidebar,
							replacement: {
								match: /(?<=({className:\i\.guilds,themeOverride:\i})\))/,
								replace: ",$self.FolderSideBar($1)",
							},
						},
						{
							find: ".Messages.DISCODO_DISABLED",
							predicate: () => Et.store.closeAllHomeButton,
							replacement: {
								match: /(?<=onClick:\(\)=>{)(?=.{0,300}"discodo")/,
								replace: "$self.closeFolders();",
							},
						},
					],
					flux: {
						CHANNEL_SELECT(e) {
							if (
								!(!Et.store.closeAllFolders && !Et.store.forceOpen) &&
								qb !== e.guildId
							) {
								qb = e.guildId;
								let t = ZR(e.guildId);
								t?.folderId
									? Et.store.forceOpen &&
										!ps.isFolderExpanded(t.folderId) &&
										qh.toggleGuildFolderExpand(t.folderId)
									: Et.store.closeAllFolders && jh();
							}
						},
						TOGGLE_GUILD_FOLDER_EXPAND(e) {
							Et.store.closeOthers &&
								!Wh &&
								((Wh = !0),
								_.wait(() => {
									let t = ps.getExpandedFolders();
									if (t.size > 1)
										for (let o of t)
											o !== e.folderId && qh.toggleGuildFolderExpand(o);
									Wh = !1;
								}));
						},
						LOGOUT() {
							jh();
						},
					},
					getGuildTree(e, t, o) {
						return dt(() => {
							if (!e || o == null) return t;
							let r = new KR();
							return (
								(r.root.children = t.root.children.filter((i) => o.has(i.id))),
								(r.nodes = Object.fromEntries(
									Object.entries(t.nodes).filter(
										([i, s]) => o.has(s.id) || o.has(s.parentId)
									)
								)),
								r
							);
						}, [e, t, o]);
					},
					makeGuildsBarGuildListFilter(e) {
						return (t) =>
							e ? t?.props?.["aria-label"] === Se.Messages.SERVERS : !0;
					},
					makeGuildsBarTreeFilter(e) {
						return (t) => (e ? t?.props?.onScroll != null : !0);
					},
					shouldShowFolderIconAndBackground(e, t) {
						if (!e) return !0;
						switch (Et.store.showFolderIcon) {
							case 0:
								return !1;
							case 1:
								return !0;
							case 2:
								return (t?.size ?? 0) > 1;
							default:
								return !0;
						}
					},
					FolderSideBar: (e) => n(Wb, { ...e }),
					closeFolders: jh,
				}));
		});
	var Pu,
		Kb = g(() => {
			"use strict";
			a();
			P();
			T();
			Pu = h({
				name: "BetterGifAltText",
				authors: [d.Ven],
				description:
					"Change GIF alt text from simply being 'GIF' to containing the gif tags / filename",
				patches: [
					{
						find: '"onCloseImage",',
						replacement: {
							match: /(return.{0,10}\.jsx.{0,50}isWindowFocused)/,
							replace: "$self.altify(e);$1",
						},
					},
					{
						find: ".Messages.GIF,",
						replacement: {
							match: /alt:(\i)=(\i\.\i\.Messages\.GIF)(?=,[^}]*\}=(\i))/,
							replace: "alt_$$:$1=$self.altify($3)||$2",
						},
					},
				],
				altify(e) {
					if (((e.alt ??= "GIF"), e.alt !== "GIF")) return e.alt;
					let t = e.original || e.src;
					try {
						t = decodeURI(t);
					} catch {}
					let o = t
						.slice(t.lastIndexOf("/") + 1)
						.replace(/\d/g, "")
						.replace(/.gif$/, "")
						.split(/[,\-_ ]+/g)
						.slice(0, 20)
						.join(" ");
					return (
						o.length > 300 && (o = o.slice(0, 300) + "..."),
						o && (e.alt += ` - ${o}`),
						e.alt
					);
				},
			});
		});
	var Mu,
		Yb = g(() => {
			"use strict";
			a();
			P();
			T();
			Mu = h({
				name: "BetterGifPicker",
				description:
					"Makes the gif picker open the favourite category by default",
				authors: [d.Samwich],
				patches: [
					{
						find: '"state",{resultType:',
						replacement: [
							{
								match: /(?<="state",{resultType:)null/,
								replace: '"Favorites"',
							},
						],
					},
				],
			});
		});
	var Iu,
		Cu,
		Zb = g(() => {
			"use strict";
			a();
			F();
			P();
			Jo();
			T();
			(Iu = x({
				hide: {
					type: 3,
					description: "Hide notes",
					default: !1,
					restartNeeded: !0,
				},
				noSpellCheck: {
					type: 3,
					description: "Disable spellcheck in notes",
					disabled: () => Iu.store.hide,
					default: !1,
				},
			})),
				(Cu = h({
					name: "BetterNotesBox",
					description:
						"Hide notes or disable spellcheck (Configure in settings!!)",
					authors: [d.Ven],
					settings: Iu,
					patches: [
						{
							find: "hideNote:",
							all: !0,
							noWarn: !0,
							predicate: () => Iu.store.hide,
							replacement: {
								match: /hideNote:.+?(?=([,}].*?\)))/g,
								replace: (e, t) => {
									if (t.match(/}=.+/)) {
										let r = e.match(Yt(/hideNote:(\i)=!?\d/));
										return r ? `hideNote:${r[1]}=!0` : e;
									}
									return "hideNote:!0";
								},
							},
						},
						{
							find: "Messages.NOTE_PLACEHOLDER",
							replacement: {
								match: /\.NOTE_PLACEHOLDER,/,
								replace: "$&spellCheck:!$self.noSpellCheck,",
							},
						},
					],
					get noSpellCheck() {
						return Iu.store.noSpellCheck;
					},
				}));
		});
	function XR() {
		return n(
			"svg",
			{
				role: "img",
				width: "18",
				height: "18",
				fill: "none",
				viewBox: "0 0 24 24",
			},
			n("path", {
				fill: "currentColor",
				d: "m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z",
			})
		);
	}
	function JR() {
		return n(
			"svg",
			{ width: "18", height: "18", viewBox: "0 0 24 24" },
			n("path", {
				fill: "currentColor",
				d: "M 12,0 C 5.3733333,0 0,5.3733333 0,12 c 0,6.626667 5.3733333,12 12,12 1.106667,0 2,-0.893333 2,-2 0,-0.52 -0.2,-0.986667 -0.52,-1.346667 -0.306667,-0.346666 -0.506667,-0.813333 -0.506667,-1.32 0,-1.106666 0.893334,-2 2,-2 h 2.36 C 21.013333,17.333333 24,14.346667 24,10.666667 24,4.7733333 18.626667,0 12,0 Z M 4.6666667,12 c -1.1066667,0 -2,-0.893333 -2,-2 0,-1.1066667 0.8933333,-2 2,-2 1.1066666,0 2,0.8933333 2,2 0,1.106667 -0.8933334,2 -2,2 z M 8.666667,6.6666667 c -1.106667,0 -2.0000003,-0.8933334 -2.0000003,-2 0,-1.1066667 0.8933333,-2 2.0000003,-2 1.106666,0 2,0.8933333 2,2 0,1.1066666 -0.893334,2 -2,2 z m 6.666666,0 c -1.106666,0 -2,-0.8933334 -2,-2 0,-1.1066667 0.893334,-2 2,-2 1.106667,0 2,0.8933333 2,2 0,1.1066666 -0.893333,2 -2,2 z m 4,5.3333333 c -1.106666,0 -2,-0.893333 -2,-2 0,-1.1066667 0.893334,-2 2,-2 1.106667,0 2,0.8933333 2,2 0,1.106667 -0.893333,2 -2,2 z",
			})
		);
	}
	var Qb,
		QR,
		Xb,
		Au,
		Jb = g(() => {
			"use strict";
			a();
			F();
			Ir();
			yt();
			P();
			it();
			T();
			U();
			b();
			(Qb = C("open", "selectRole", "updateGuild")),
				(QR = Uo("appearance", "developerMode"));
			(Xb = x({
				roleIconFileFormat: {
					type: 4,
					description: "File format to use when viewing role icons",
					options: [
						{ label: "png", value: "png", default: !0 },
						{ label: "webp", value: "webp" },
						{ label: "jpg", value: "jpg" },
					],
				},
			})),
				(Au = h({
					name: "BetterRoleContext",
					description:
						"Adds options to copy role color / edit role / view role icon when right clicking roles in the user profile",
					authors: [d.Ven, d.goodbee],
					dependencies: ["UserSettingsAPI"],
					settings: Xb,
					start() {
						QR.updateSetting(!0);
					},
					contextMenus: {
						"dev-context"(e, { id: t }) {
							let o = li();
							if (!o) return;
							let r = le.getRole(o.id, t);
							!r ||
								(r.colorString &&
									e.push(
										n(E.MenuItem, {
											id: "vc-copy-role-color",
											label: "Copy Role Color",
											action: () => Gt.copy(r.colorString),
											icon: JR,
										})
									),
								r.icon &&
									e.push(
										n(E.MenuItem, {
											id: "vc-view-role-icon",
											label: "View Role Icon",
											action: () => {
												Lo(
													`${location.protocol}//${window.GLOBAL_ENV.CDN_HOST}/role-icons/${r.id}/${r.icon}.${Xb.store.roleIconFileFormat}`
												);
											},
											icon: tn,
										})
									),
								qe.getGuildPermissionProps(o).canManageRoles &&
									e.push(
										n(E.MenuItem, {
											id: "vc-edit-role",
											label: "Edit Role",
											action: async () => {
												await Qb.open(o.id, "ROLES"), Qb.selectRole(t);
											},
											icon: XR,
										})
									));
						},
					},
				}));
		});
	var ds,
		Nu,
		Vb = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			b();
			(ds = x({
				bothStyles: {
					type: 3,
					description: "Show both role dot and coloured names",
					restartNeeded: !0,
					default: !1,
				},
				copyRoleColorInProfilePopout: {
					type: 3,
					description:
						"Allow click on role dot in profile popout to copy role color",
					restartNeeded: !0,
					default: !1,
				},
			})),
				(Nu = h({
					name: "BetterRoleDot",
					authors: [d.Ven, d.AutumnVN],
					description:
						"Copy role colour on RoleDot (accessibility setting) click. Also allows using both RoleDot and coloured names simultaneously",
					settings: ds,
					patches: [
						{
							find: ".dotBorderBase",
							replacement: {
								match: /,viewBox:"0 0 20 20"/,
								replace:
									"$&,onClick:()=>$self.copyToClipBoard(arguments[0].color),style:{cursor:'pointer'}",
							},
						},
						{
							find: '"dot"===',
							all: !0,
							noWarn: !0,
							predicate: () => ds.store.bothStyles,
							replacement: {
								match: /"(?:username|dot)"===\i(?!\.\i)/g,
								replace: "true",
							},
						},
						{
							find: ".ADD_ROLE_A11Y_LABEL",
							all: !0,
							predicate: () =>
								ds.store.copyRoleColorInProfilePopout && !ds.store.bothStyles,
							noWarn: !0,
							replacement: { match: /"dot"===\i/, replace: "true" },
						},
						{
							find: ".roleVerifiedIcon",
							all: !0,
							predicate: () =>
								ds.store.copyRoleColorInProfilePopout && !ds.store.bothStyles,
							noWarn: !0,
							replacement: { match: /"dot"===\i/, replace: "true" },
						},
					],
					copyToClipBoard(e) {
						Gt.copy(e),
							X.show({
								message: "Copied to Clipboard!",
								type: X.Type.SUCCESS,
								id: X.genId(),
								options: { duration: 1e3, position: X.Position.BOTTOM },
							});
					},
				}));
		});
	var e2,
		t2,
		o2,
		n2,
		r2,
		i2,
		s2,
		a2,
		l2,
		c2 = g(() => {
			"use strict";
			a();
			ct();
			U();
			(e2 = (e) =>
				n(
					"svg",
					{ ...e, fill: "currentColor", viewBox: "0 0 16 16" },
					n("path", {
						d: "M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z",
					})
				)),
				(t2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 512 512" },
						n("path", {
							d: "M188.8,255.93A67.2,67.2,0,1,0,256,188.75,67.38,67.38,0,0,0,188.8,255.93Z",
						}),
						n("path", {
							d: "M476.75,217.79s0,0,0,.05a206.63,206.63,0,0,0-7-28.84h-.11a202.16,202.16,0,0,1,7.07,29h0a203.5,203.5,0,0,0-7.07-29H314.24c19.05,17,31.36,40.17,31.36,67.05a86.55,86.55,0,0,1-12.31,44.73L231,478.45a2.44,2.44,0,0,1,0,.27V479h0v-.26A224,224,0,0,0,256,480c6.84,0,13.61-.39,20.3-1a222.91,222.91,0,0,0,29.78-4.74C405.68,451.52,480,362.4,480,255.94A225.25,225.25,0,0,0,476.75,217.79Z",
						}),
						n("path", {
							d: "M256,345.5c-33.6,0-61.6-17.91-77.29-44.79L76,123.05l-.14-.24A224,224,0,0,0,207.4,474.55l0-.05,77.69-134.6A84.13,84.13,0,0,1,256,345.5Z",
						}),
						n("path", {
							d: "M91.29,104.57l77.35,133.25A89.19,89.19,0,0,1,256,166H461.17a246.51,246.51,0,0,0-25.78-43.94l.12.08A245.26,245.26,0,0,1,461.17,166h.17a245.91,245.91,0,0,0-25.66-44,2.63,2.63,0,0,1-.35-.26A223.93,223.93,0,0,0,91.14,104.34l.14.24Z",
						})
					)),
				(o2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 24 24" },
						n("path", {
							d: "M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.8-.28-1.48-.78-.68-.5-1.22-1.17-.53-.66-.92-1.44-.38-.77-.58-1.6-.2-.83-.2-1.67 0-1 .32-1.96.33-.97.87-1.8.14.95.55 1.77.41.82 1.02 1.5.6.68 1.38 1.21.78.54 1.64.9.86.36 1.77.56.92.2 1.8.2 1.12 0 2.18-.24 1.06-.23 2.06-.72l.2-.1.2-.05zm-15.5-1.27q0 1.1.27 2.15.27 1.06.78 2.03.51.96 1.24 1.77.74.82 1.66 1.4-1.47-.2-2.8-.74-1.33-.55-2.48-1.37-1.15-.83-2.08-1.9-.92-1.07-1.58-2.33T.36 14.94Q0 13.54 0 12.06q0-.81.32-1.49.31-.68.83-1.23.53-.55 1.2-.96.66-.4 1.35-.66.74-.27 1.5-.39.78-.12 1.55-.12.7 0 1.42.1.72.12 1.4.35.68.23 1.32.57.63.35 1.16.83-.35 0-.7.07-.33.07-.65.23v-.02q-.63.28-1.2.74-.57.46-1.05 1.04-.48.58-.87 1.26-.38.67-.65 1.39-.27.71-.42 1.44-.15.72-.15 1.38zM11.96.06q1.7 0 3.33.39 1.63.38 3.07 1.15 1.43.77 2.62 1.93 1.18 1.16 1.98 2.7.49.94.76 1.96.28 1 .28 2.08 0 .89-.23 1.7-.24.8-.69 1.48-.45.68-1.1 1.22-.64.53-1.45.88-.54.24-1.11.36-.58.13-1.16.13-.42 0-.97-.03-.54-.03-1.1-.12-.55-.1-1.05-.28-.5-.19-.84-.5-.12-.09-.23-.24-.1-.16-.1-.33 0-.15.16-.35.16-.2.35-.5.2-.28.36-.68.16-.4.16-.95 0-1.06-.4-1.96-.4-.91-1.06-1.64-.66-.74-1.52-1.28-.86-.55-1.79-.89-.84-.3-1.72-.44-.87-.14-1.76-.14-1.55 0-3.06.45T.94 7.55q.71-1.74 1.81-3.13 1.1-1.38 2.52-2.35Q6.68 1.1 8.37.58q1.7-.52 3.58-.52Z",
						})
					)),
				(n2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 512 512" },
						n("path", {
							d: "M130.22 127.548C130.38 127.558 130.3 127.558 130.22 127.548V127.548ZM481.64 172.898C471.03 147.398 449.56 119.898 432.7 111.168C446.42 138.058 454.37 165.048 457.4 185.168C457.405 185.306 457.422 185.443 457.45 185.578C429.87 116.828 383.098 89.1089 344.9 28.7479C329.908 5.05792 333.976 3.51792 331.82 4.08792L331.7 4.15792C284.99 30.1109 256.365 82.5289 249.12 126.898C232.503 127.771 216.219 131.895 201.19 139.035C199.838 139.649 198.736 140.706 198.066 142.031C197.396 143.356 197.199 144.87 197.506 146.323C197.7 147.162 198.068 147.951 198.586 148.639C199.103 149.327 199.76 149.899 200.512 150.318C201.264 150.737 202.096 150.993 202.954 151.071C203.811 151.148 204.676 151.045 205.491 150.768L206.011 150.558C221.511 143.255 238.408 139.393 255.541 139.238C318.369 138.669 352.698 183.262 363.161 201.528C350.161 192.378 326.811 183.338 304.341 187.248C392.081 231.108 368.541 381.784 246.951 376.448C187.487 373.838 149.881 325.467 146.421 285.648C146.421 285.648 157.671 243.698 227.041 243.698C234.541 243.698 255.971 222.778 256.371 216.698C256.281 214.698 213.836 197.822 197.281 181.518C188.434 172.805 184.229 168.611 180.511 165.458C178.499 163.75 176.392 162.158 174.201 160.688C168.638 141.231 168.399 120.638 173.51 101.058C148.45 112.468 128.96 130.508 114.8 146.428H114.68C105.01 134.178 105.68 93.7779 106.25 85.3479C106.13 84.8179 99.022 89.0159 98.1 89.6579C89.5342 95.7103 81.5528 102.55 74.26 110.088C57.969 126.688 30.128 160.242 18.76 211.318C14.224 231.701 12 255.739 12 263.618C12 398.318 121.21 507.508 255.92 507.508C376.56 507.508 478.939 420.281 496.35 304.888C507.922 228.192 481.64 173.82 481.64 172.898Z",
						})
					)),
				(r2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 512 512" },
						n("path", {
							d: "M483.049 159.706c10.855-24.575 21.424-60.438 21.424-87.871 0-72.722-79.641-98.371-209.673-38.577-107.632-7.181-211.221 73.67-237.098 186.457 30.852-34.862 78.271-82.298 121.977-101.158C125.404 166.85 79.128 228.002 43.992 291.725 23.246 329.651 0 390.94 0 436.747c0 98.575 92.854 86.5 180.251 42.006 31.423 15.43 66.559 15.573 101.695 15.573 97.124 0 184.249-54.294 216.814-146.022H377.927c-52.509 88.593-196.819 52.996-196.819-47.436H509.9c6.407-43.581-1.655-95.715-26.851-141.162zM64.559 346.877c17.711 51.15 53.703 95.871 100.266 123.304-88.741 48.94-173.267 29.096-100.266-123.304zm115.977-108.873c2-55.151 50.276-94.871 103.98-94.871 53.418 0 101.981 39.72 103.981 94.871H180.536zm184.536-187.6c21.425-10.287 48.563-22.003 72.558-22.003 31.422 0 54.274 21.717 54.274 53.722 0 20.003-7.427 49.007-14.569 67.867-26.28-42.292-65.986-81.584-112.263-99.586z",
						})
					)),
				(i2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 496 512" },
						n("path", {
							d: "M313.9 32.7c-170.2 0-252.6 223.8-147.5 355.1 36.5 45.4 88.6 75.6 147.5 75.6 36.3 0 70.3-11.1 99.4-30.4-43.8 39.2-101.9 63-165.3 63-3.9 0-8 0-11.9-.3C104.6 489.6 0 381.1 0 248 0 111 111 0 248 0h.8c63.1.3 120.7 24.1 164.4 63.1-29-19.4-63.1-30.4-99.3-30.4zm101.8 397.7c-40.9 24.7-90.7 23.6-132-5.8 56.2-20.5 97.7-91.6 97.7-176.6 0-84.7-41.2-155.8-97.4-176.6 41.8-29.2 91.2-30.3 132.9-5 105.9 98.7 105.5 265.7-1.2 364z",
						})
					)),
				(s2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 512 512" },
						n("path", {
							d: "M274.69,274.69l-37.38-37.38L166,346ZM256,8C119,8,8,119,8,256S119,504,256,504,504,393,504,256,393,8,256,8ZM411.85,182.79l14.78-6.13A8,8,0,0,1,437.08,181h0a8,8,0,0,1-4.33,10.46L418,197.57a8,8,0,0,1-10.45-4.33h0A8,8,0,0,1,411.85,182.79ZM314.43,94l6.12-14.78A8,8,0,0,1,331,74.92h0a8,8,0,0,1,4.33,10.45l-6.13,14.78a8,8,0,0,1-10.45,4.33h0A8,8,0,0,1,314.43,94ZM256,60h0a8,8,0,0,1,8,8V84a8,8,0,0,1-8,8h0a8,8,0,0,1-8-8V68A8,8,0,0,1,256,60ZM181,74.92a8,8,0,0,1,10.46,4.33L197.57,94a8,8,0,1,1-14.78,6.12l-6.13-14.78A8,8,0,0,1,181,74.92Zm-63.58,42.49h0a8,8,0,0,1,11.31,0L140,128.72A8,8,0,0,1,140,140h0a8,8,0,0,1-11.31,0l-11.31-11.31A8,8,0,0,1,117.41,117.41ZM60,256h0a8,8,0,0,1,8-8H84a8,8,0,0,1,8,8h0a8,8,0,0,1-8,8H68A8,8,0,0,1,60,256Zm40.15,73.21-14.78,6.13A8,8,0,0,1,74.92,331h0a8,8,0,0,1,4.33-10.46L94,314.43a8,8,0,0,1,10.45,4.33h0A8,8,0,0,1,100.15,329.21Zm4.33-136h0A8,8,0,0,1,94,197.57l-14.78-6.12A8,8,0,0,1,74.92,181h0a8,8,0,0,1,10.45-4.33l14.78,6.13A8,8,0,0,1,104.48,193.24ZM197.57,418l-6.12,14.78a8,8,0,0,1-14.79-6.12l6.13-14.78A8,8,0,1,1,197.57,418ZM264,444a8,8,0,0,1-8,8h0a8,8,0,0,1-8-8V428a8,8,0,0,1,8-8h0a8,8,0,0,1,8,8Zm67-6.92h0a8,8,0,0,1-10.46-4.33L314.43,418a8,8,0,0,1,4.33-10.45h0a8,8,0,0,1,10.45,4.33l6.13,14.78A8,8,0,0,1,331,437.08Zm63.58-42.49h0a8,8,0,0,1-11.31,0L372,383.28A8,8,0,0,1,372,372h0a8,8,0,0,1,11.31,0l11.31,11.31A8,8,0,0,1,394.59,394.59ZM286.25,286.25,110.34,401.66,225.75,225.75,401.66,110.34ZM437.08,331h0a8,8,0,0,1-10.45,4.33l-14.78-6.13a8,8,0,0,1-4.33-10.45h0A8,8,0,0,1,418,314.43l14.78,6.12A8,8,0,0,1,437.08,331ZM444,264H428a8,8,0,0,1-8-8h0a8,8,0,0,1,8-8h16a8,8,0,0,1,8,8h0A8,8,0,0,1,444,264Z",
						})
					)),
				(a2 = (e) =>
					n(
						"svg",
						{ ...e, fill: "currentColor", viewBox: "0 0 16 16" },
						n("path", {
							"fill-rule": "evenodd",
							d: "M4.475 5.458c-.284 0-.514-.237-.47-.517C4.28 3.24 5.576 2 7.825 2c2.25 0 3.767 1.36 3.767 3.215 0 1.344-.665 2.288-1.79 2.973-1.1.659-1.414 1.118-1.414 2.01v.03a.5.5 0 0 1-.5.5h-.77a.5.5 0 0 1-.5-.495l-.003-.2c-.043-1.221.477-2.001 1.645-2.712 1.03-.632 1.397-1.135 1.397-2.028 0-.979-.758-1.698-1.926-1.698-1.009 0-1.71.529-1.938 1.402-.066.254-.278.461-.54.461h-.777ZM7.496 14c.622 0 1.095-.474 1.095-1.09 0-.618-.473-1.092-1.095-1.092-.606 0-1.087.474-1.087 1.091S6.89 14 7.496 14Z",
						})
					)),
				(l2 = Kr(() =>
					fe("M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38")
				));
		});
	function Ja(e) {
		return `${e.os} \xB7 ${e.platform}`;
	}
	function Va() {
		return gt.set(u2(), Ao);
	}
	async function p2() {
		((await gt.get(u2())) || new Map()).forEach((t, o) => {
			Ao.set(o, t);
		});
	}
	function d2(e) {
		switch (e) {
			case "Windows Mobile":
			case "Windows":
				return "#55a6ef";
			case "Linux":
				return "#cdcd31";
			case "Android":
				return "#7bc958";
			case "Mac OS X":
			case "iOS":
				return "";
			default:
				return "#f3799a";
		}
	}
	function m2(e) {
		switch (e) {
			case "Discord Android":
			case "Discord iOS":
			case "Discord Client":
				return e2;
			case "Android Chrome":
			case "Chrome iOS":
			case "Chrome":
				return t2;
			case "Edge":
				return o2;
			case "Firefox":
				return n2;
			case "Internet Explorer":
				return r2;
			case "Opera Mini":
			case "Opera":
				return i2;
			case "Mobile Safari":
			case "Safari":
				return s2;
			case "BlackBerry":
			case "Facebook Mobile":
			case "Android Mobile":
				return l2;
			default:
				return a2;
		}
	}
	var u2,
		Ao,
		Kh = g(() => {
			"use strict";
			a();
			qn();
			b();
			c2();
			(u2 = () => `BetterSessions_savedSessions_${D.getCurrentUser().id}`),
				(Ao = new Map());
		});
	function f2({ props: e, session: t, state: o }) {
		let [r, i] = o,
			[s, l] = q.useState(Ao.get(t.id_hash)?.name ?? "");
		function c() {
			Ao.set(t.id_hash, { name: s, isNew: !1 }),
				i(s !== "" ? `${s}*` : Ja(t.client_info)),
				Va(),
				e.onClose();
		}
		return n(
			Te,
			{ ...e },
			n(Ee, null, n(S.FormTitle, { tag: "h4" }, "Rename")),
			n(
				Ae,
				null,
				n(
					S.FormTitle,
					{ tag: "h5", style: { marginTop: "10px" } },
					"New device name"
				),
				n(mt, {
					style: { marginBottom: "10px" },
					placeholder: Ja(t.client_info),
					value: s,
					onChange: l,
					onKeyDown: (u) => {
						u.key === "Enter" && c();
					},
				}),
				n(
					M,
					{
						style: {
							marginBottom: "20px",
							paddingLeft: "1px",
							paddingRight: "1px",
							opacity: 0.6,
						},
						look: M.Looks.LINK,
						color: M.Colors.LINK,
						size: M.Sizes.NONE,
						onClick: () => l(""),
					},
					"Reset Name"
				)
			),
			n(
				ht,
				null,
				n(M, { color: M.Colors.BRAND, onClick: c }, "Save"),
				n(
					M,
					{
						color: M.Colors.TRANSPARENT,
						look: M.Looks.LINK,
						onClick: () => e.onClose(),
					},
					"Cancel"
				)
			)
		);
	}
	var g2 = g(() => {
		"use strict";
		a();
		Ke();
		b();
		Kh();
	});
	function h2({ session: e, state: t }) {
		return n(
			M,
			{
				look: M.Looks.LINK,
				color: M.Colors.LINK,
				size: M.Sizes.NONE,
				style: { paddingTop: "0px", paddingBottom: "0px", top: "-2px" },
				onClick: () => ge((o) => n(f2, { props: o, session: e, state: t })),
			},
			"Rename"
		);
	}
	var y2 = g(() => {
		"use strict";
		a();
		Ke();
		b();
		g2();
	});
	var VR,
		e4,
		v2,
		t4,
		o4,
		Yh,
		Ru,
		S2 = g(() => {
			"use strict";
			a();
			Bn();
			F();
			re();
			P();
			T();
			U();
			b();
			y2();
			Kh();
			(VR = K("AuthSessionsStore")),
				(e4 = C("saveAccountChanges", "open")),
				(v2 = C("timestampTooltip", "blockquoteContainer")),
				(t4 = C("sessionIcon")),
				(o4 = po("BlobMask")),
				(Yh = x({
					backgroundCheck: {
						type: 3,
						description:
							"Check for new sessions in the background, and display notifications when they are detected",
						default: !1,
						restartNeeded: !0,
					},
					checkInterval: {
						description:
							"How often to check for new sessions in the background (if enabled), in minutes",
						type: 1,
						default: 20,
						restartNeeded: !0,
					},
				})),
				(Ru = h({
					name: "BetterSessions",
					description:
						"Enhances the sessions (devices) menu. Allows you to view exact timestamps, give each session a custom name, and receive notifications about new sessions.",
					authors: [d.amia],
					settings: Yh,
					patches: [
						{
							find: "Messages.AUTH_SESSIONS_SESSION_LOG_OUT",
							replacement: [
								{
									match:
										/({variant:"eyebrow",className:\i\.sessionInfoRow,children:).{70,110}{children:"\\xb7"}\),\(0,\i\.\i\)\("span",{children:\i\[\d+\]}\)\]}\)\]/,
									replace: "$1$self.renderName(arguments[0])",
								},
								{
									match:
										/({variant:"text-sm\/medium",className:\i\.sessionInfoRow,children:.{70,110}{children:"\\xb7"}\),\(0,\i\.\i\)\("span",{children:)(\i\[\d+\])}/,
									replace:
										"$1$self.renderTimestamp({ ...arguments[0], timeLabel: $2 })}",
								},
								{
									match:
										/\.currentSession:null\),children:\[(?<=,icon:(\i)\}.+?)/,
									replace:
										"$& $self.renderIcon({ ...arguments[0], DeviceIcon: $1 }), false &&",
								},
							],
						},
					],
					renderName: R.wrap(
						({ session: e }) => {
							let t = Ao.get(e.id_hash),
								o = q.useState(t?.name ? `${t.name}*` : Ja(e.client_info)),
								[r, i] = o;
							return n(
								f,
								null,
								n("span", null, r),
								(t == null || t.isNew) &&
									n(
										"div",
										{
											className: "vc-plugins-badge",
											style: { backgroundColor: "#ED4245", marginLeft: "2px" },
										},
										"NEW"
									),
								n(h2, { session: e, state: o })
							);
						},
						{ noop: !0 }
					),
					renderTimestamp: R.wrap(
						({ session: e, timeLabel: t }) =>
							n(
								te,
								{
									text: e.approx_last_used_time.toLocaleString(),
									tooltipClassName: v2.timestampTooltip,
								},
								(o) => n("span", { ...o, className: v2.timestamp }, t)
							),
						{ noop: !0 }
					),
					renderIcon: R.wrap(
						({ session: e, DeviceIcon: t }) => {
							let o = m2(e.client_info.platform);
							return n(
								o4,
								{
									style: { cursor: "unset" },
									selected: !1,
									lowerBadge: n(
										"div",
										{
											style: {
												width: "20px",
												height: "20px",
												display: "flex",
												justifyContent: "center",
												alignItems: "center",
												overflow: "hidden",
												borderRadius: "50%",
												backgroundColor: "var(--interactive-normal)",
												color: "var(--background-secondary)",
											},
										},
										n(o, { width: 14, height: 14 })
									),
									lowerBadgeSize: { width: 20, height: 20 },
								},
								n(
									"div",
									{
										className: t4.sessionIcon,
										style: { backgroundColor: d2(e.client_info.os) },
									},
									n(t, { width: 28, height: 28, color: "currentColor" })
								)
							);
						},
						{ noop: !0 }
					),
					async checkNewSessions() {
						let e = await Pt.get({ url: bt.Endpoints.AUTH_SESSIONS });
						for (let t of e.body.user_sessions)
							Ao.has(t.id_hash) ||
								(Ao.set(t.id_hash, { name: "", isNew: !0 }),
								ze({
									title: "BetterSessions",
									body: `New session:
${t.client_info.os} \xB7 ${t.client_info.platform} \xB7 ${t.client_info.location}`,
									permanent: !0,
									onClick: () => e4.open("Sessions"),
								}));
						Va();
					},
					flux: {
						USER_SETTINGS_ACCOUNT_RESET_AND_CLOSE_FORM() {
							let e = VR.getSessions().map((t) => t.id_hash);
							e.forEach((t) => {
								Ao.has(t) || Ao.set(t, { name: "", isNew: !1 });
							}),
								e.length > 0 &&
									Ao.forEach((t, o) => {
										e.includes(o) || Ao.delete(o);
									}),
								Ao.forEach((t) => {
									t.isNew = !1;
								}),
								Va();
						},
					},
					async start() {
						await p2(),
							this.checkNewSessions(),
							Yh.store.backgroundCheck &&
								(this.checkInterval = setInterval(
									this.checkNewSessions,
									Yh.store.checkInterval * 60 * 1e3
								));
					},
					stop() {
						clearInterval(this.checkInterval);
					},
				}));
		});
	function r4({ mode: e, baseLayer: t = !1, ...o }) {
		let r = e === "HIDDEN",
			i = St(null);
		ue(
			() => () => {
				Vo.dispatch("LAYER_POP_START"), Vo.dispatch("LAYER_POP_COMPLETE");
			},
			[]
		);
		let s = n("div", {
			ref: i,
			"aria-hidden": r,
			className: n4({
				[Zh.layer]: !0,
				[Zh.baseLayer]: t,
				"stop-animations": r,
			}),
			style: { opacity: r ? 0 : void 0 },
			...o,
		});
		return t ? s : n(ra, { containerRef: i }, s);
	}
	var n4,
		Zh,
		ms,
		ku,
		b2 = g(() => {
			"use strict";
			a();
			F();
			tt();
			P();
			De();
			Zs();
			ct();
			T();
			U();
			b();
			(n4 = be("")),
				(Zh = C("animating", "baseLayer", "bg", "layer", "layers")),
				(ms = x({
					disableFade: {
						description: "Disable the crossfade animation",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					organizeMenu: {
						description:
							"Organizes the settings cog context menu into categories",
						type: 3,
						default: !0,
					},
					eagerLoad: {
						description:
							"Removes the loading delay when opening the menu for the first time",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
				}));
			ku = h({
				name: "BetterSettings",
				description: "Enhances your settings-menu-opening experience",
				authors: [d.Kyuuhachi],
				settings: ms,
				patches: [
					{
						find: "this.renderArtisanalHack()",
						replacement: [
							{
								match: /(?<=\((\i),"contextType",\i\.\i\);)/,
								replace: "$1=$self.Layer;",
								predicate: () => ms.store.disableFade,
							},
							{
								match:
									/createPromise:\(\)=>([^:}]*?),webpackId:"?\d+"?,name:(?!="CollectiblesShop")"[^"]+"/g,
								replace: "$&,_:$1",
								predicate: () => ms.store.eagerLoad,
							},
						],
					},
					{
						find: 'minimal:"contentColumnMinimal"',
						replacement: [
							{
								match: /\(0,\i\.useTransition\)\((\i)/,
								replace: "(_cb=>_cb(void 0,$1))||$&",
							},
							{ match: /\i\.animated\.div/, replace: '"div"' },
						],
						predicate: () => ms.store.disableFade,
					},
					{
						find: "Messages.USER_SETTINGS_WITH_BUILD_OVERRIDE.format",
						replacement: {
							match:
								/(\i)\(this,"handleOpenSettingsContextMenu",.{0,100}?null!=\i&&.{0,100}?(await Promise\.all[^};]*?\)\)).*?,(?=\1\(this)/,
							replace: "$&(async ()=>$2)(),",
						},
						predicate: () => ms.store.eagerLoad,
					},
					{
						find: "Messages.USER_SETTINGS_ACTIONS_MENU_LABEL",
						replacement: {
							match:
								/(EXPERIMENTS:.+?)(\(0,\i.\i\)\(\))(?=\.filter\(\i=>\{let\{section:\i\}=)/,
							replace: "$1$self.wrapMenu($2)",
						},
					},
				],
				Layer(e) {
					return ra === Be || Vo[At] == null || Zh[At] == null
						? (new V("BetterSettings").error("Failed to find some components"),
							e.children)
						: n(r4, { ...e });
				},
				wrapMenu(e) {
					if (!ms.store.organizeMenu) return e;
					let t = [{ label: null, items: [] }];
					for (let o of e)
						o.section === "HEADER"
							? t.push({ label: o.label, items: [] })
							: o.section === "DIVIDER"
								? t.push({ label: Se.Messages.OTHER_OPTIONS, items: [] })
								: t.at(-1).items.push(o);
					return {
						filter(o) {
							for (let r of t) r.items = r.items.filter(o);
							return this;
						},
						map(o) {
							return t
								.filter((r) => r.items.length > 0)
								.map(({ label: r, items: i }) => {
									let s = i.map(o);
									return r
										? n(E.MenuItem, {
												id: r.replace(/\W/, "_"),
												label: r,
												children: s,
												action: s[0].props.action,
											})
										: s;
								});
						},
					};
				},
			});
		});
	var Du,
		T2 = g(() => {
			"use strict";
			a();
			P();
			T();
			Du = h({
				name: "BetterUploadButton",
				authors: [d.fawn, d.Ven],
				description: "Upload with a single click, open menu with right click",
				patches: [
					{
						find: '"ChannelAttachButton"',
						replacement: {
							match:
								/\.attachButtonInner,"aria-label":.{0,50},onDoubleClick:(.+?:void 0),\.\.\.(\i),/,
							replace: "$&onClick:$1,onContextMenu:$2.onClick,",
						},
					},
				],
			});
		});
	var x2,
		w2,
		P2 = g(() => {
			"use strict";
			a();
			U();
			(x2 = K("ApplicationStreamPreviewStore")),
				(w2 = K("ApplicationStreamingStore"));
		});
	var i4,
		M2,
		s4,
		a4,
		Lu,
		I2 = g(() => {
			"use strict";
			a();
			yt();
			P();
			it();
			T();
			b();
			P2();
			(i4 = async ({ guildId: e, channelId: t, ownerId: o }) => {
				let r = await x2.getPreviewURL(e, t, o);
				!r || Lo(r);
			}),
				(M2 = (e, { userId: t }) => {
					let o = w2.getAnyStreamForUser(t);
					if (!o) return;
					let r = n(E.MenuItem, {
						label: "View Stream Preview",
						id: "view-stream-preview",
						icon: Cg,
						action: () => o && i4(o),
						disabled: !o,
					});
					e.push(n(E.MenuSeparator, null), r);
				}),
				(s4 = (e, { stream: t }) => M2(e, { userId: t.ownerId })),
				(a4 = (e, { user: t }) => {
					if (t) return M2(e, { userId: t.id });
				}),
				(Lu = h({
					name: "BiggerStreamPreview",
					description: "This plugin allows you to enlarge stream previews",
					authors: [d.phil],
					contextMenus: { "user-context": a4, "stream-context": s4 },
				}));
		});
	function C2() {
		el.textContent = `
        .vc-nsfw-img [class^=imageWrapper] img,
        .vc-nsfw-img [class^=wrapperPaused] video {
            filter: blur(${A2.store.blurAmount}px);
            transition: filter 0.2s;
        }
        .vc-nsfw-img [class^=imageWrapper]:hover img,
        .vc-nsfw-img [class^=wrapperPaused]:hover video {
            filter: unset;
        }
        `;
	}
	var el,
		A2,
		Eu,
		N2 = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(A2 = x({
				blurAmount: {
					type: 1,
					description: "Blur Amount",
					default: 10,
					onChange: C2,
				},
			})),
				(Eu = h({
					name: "BlurNSFW",
					description: "Blur attachments in NSFW channels until hovered",
					authors: [d.Ven],
					settings: A2,
					patches: [
						{
							find: ".embedWrapper,embed",
							replacement: [
								{
									match: /\.embedWrapper(?=.+?channel_id:(\i)\.id)/g,
									replace: "$&+($1.nsfw?' vc-nsfw-img':'')",
								},
							],
						},
					],
					start() {
						(el = document.createElement("style")),
							(el.id = "VcBlurNsfw"),
							document.head.appendChild(el),
							C2();
					},
					stop() {
						el?.remove();
					},
				}));
		});
	function l4(e) {
		let t = R2.store.format === "human",
			o = (m) => (t ? m : m.toString().padStart(2, "0")),
			r = (m) => (t ? m : ""),
			i = t ? " " : ":",
			s = Math.floor(e / 864e5),
			l = Math.floor((e % 864e5) / 36e5),
			c = Math.floor(((e % 864e5) % 36e5) / 6e4),
			u = Math.floor((((e % 864e5) % 36e5) % 6e4) / 1e3),
			p = "";
		return (
			s && (p += `${s}d `),
			(l || p) && (p += `${o(l)}${r("h")}${i}`),
			(c || p || !t) && (p += `${o(c)}${r("m")}${i}`),
			(p += `${o(u)}${r("s")}`),
			p
		);
	}
	var R2,
		Ou,
		k2 = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			ct();
			T();
			(R2 = x({
				format: {
					type: 4,
					description:
						"The timer format. This can be any valid moment.js format",
					options: [
						{ label: "30d 23:00:42", value: "stopwatch", default: !0 },
						{ label: "30d 23h 00m 42s", value: "human" },
					],
				},
			})),
				(Ou = h({
					name: "CallTimer",
					description: "Adds a timer to vcs",
					authors: [d.Ven],
					settings: R2,
					startTime: 0,
					interval: void 0,
					patches: [
						{
							find: "renderConnectionStatus(){",
							replacement: {
								match:
									/(?<=renderConnectionStatus\(\)\{.+\.channel,children:)\i/,
								replace: "[$&, $self.renderTimer(this.props.channel.id)]",
							},
						},
					],
					renderTimer(e) {
						return n(R, { noop: !0 }, n(this.Timer, { channelId: e }));
					},
					Timer({ channelId: e }) {
						let t = oa({ deps: [e] });
						return n(
							"p",
							{ style: { margin: 0 } },
							"Connected for ",
							n("span", { style: { fontFamily: "var(--font-code)" } }, l4(t))
						);
					},
				}));
		});
	var o1 = {};
	et(o1, {
		_handleClick: () => p4,
		_handlePreEdit: () => u4,
		_handlePreSend: () => c4,
		addClickListener: () => e1,
		addPreEditListener: () => Ti,
		addPreSendListener: () => yo,
		removeClickListener: () => t1,
		removePreEditListener: () => xi,
		removePreSendListener: () => vo,
	});
	async function c4(e, t, o, r) {
		o.replyOptions = r;
		for (let i of Xh)
			try {
				if ((await i(e, t, o))?.cancel) return !0;
			} catch (s) {
				Qh.error(
					`MessageSendHandler: Listener encountered an unknown error
`,
					s
				);
			}
		return !1;
	}
	async function u4(e, t, o) {
		for (let r of Jh)
			try {
				if ((await r(e, t, o))?.cancel) return !0;
			} catch (i) {
				Qh.error(
					`MessageEditHandler: Listener encountered an unknown error
`,
					i
				);
			}
		return !1;
	}
	function yo(e) {
		return Xh.add(e), e;
	}
	function Ti(e) {
		return Jh.add(e), e;
	}
	function vo(e) {
		return Xh.delete(e);
	}
	function xi(e) {
		return Jh.delete(e);
	}
	function p4(e, t, o) {
		e = jt.getMessage(t.id, e.id) ?? e;
		for (let r of Vh)
			try {
				r(e, t, o);
			} catch (i) {
				Qh.error(
					`MessageClickHandler: Listener encountered an unknown error
`,
					i
				);
			}
	}
	function e1(e) {
		return Vh.add(e), e;
	}
	function t1(e) {
		return Vh.delete(e);
	}
	var Qh,
		Xh,
		Jh,
		Vh,
		Sn = g(() => {
			"use strict";
			a();
			De();
			b();
			(Qh = new V("MessageEvents", "#e5c890")),
				(Xh = new Set()),
				(Jh = new Set());
			Vh = new Set();
		});
	var D2,
		L2 = g(() => {
			"use strict";
			a();
			D2 = [
				"action_object_map",
				"action_type_map",
				"action_ref_map",
				"spm@*.aliexpress.com",
				"scm@*.aliexpress.com",
				"aff_platform",
				"aff_trace_key",
				"algo_expid@*.aliexpress.*",
				"algo_pvid@*.aliexpress.*",
				"btsid",
				"ws_ab_test",
				"pd_rd_*@amazon.*",
				"_encoding@amazon.*",
				"psc@amazon.*",
				"tag@amazon.*",
				"ref_@amazon.*",
				"pf_rd_*@amazon.*",
				"pf@amazon.*",
				"crid@amazon.*",
				"keywords@amazon.*",
				"sprefix@amazon.*",
				"sr@amazon.*",
				"ie@amazon.*",
				"node@amazon.*",
				"qid@amazon.*",
				"callback@bilibili.com",
				"cvid@bing.com",
				"form@bing.com",
				"sk@bing.com",
				"sp@bing.com",
				"sc@bing.com",
				"qs@bing.com",
				"pq@bing.com",
				"sc_cid",
				"mkt_tok",
				"trk",
				"trkCampaign",
				"ga_*",
				"gclid",
				"gclsrc",
				"hmb_campaign",
				"hmb_medium",
				"hmb_source",
				"spReportId",
				"spJobID",
				"spUserID",
				"spMailingID",
				"itm_*",
				"s_cid",
				"elqTrackId",
				"elqTrack",
				"assetType",
				"assetId",
				"recipientId",
				"campaignId",
				"siteId",
				"mc_cid",
				"mc_eid",
				"pk_*",
				"sc_campaign",
				"sc_channel",
				"sc_content",
				"sc_medium",
				"sc_outcome",
				"sc_geo",
				"sc_country",
				"nr_email_referer",
				"vero_conv",
				"vero_id",
				"yclid",
				"_openstat",
				"mbid",
				"cmpid",
				"cid",
				"c_id",
				"campaign_id",
				"Campaign",
				"hash@ebay.*",
				"fb_action_ids",
				"fb_action_types",
				"fb_ref",
				"fb_source",
				"fbclid",
				"refsrc@facebook.com",
				"hrc@facebook.com",
				"gs_l",
				"gs_lcp@google.*",
				"ved@google.*",
				"ei@google.*",
				"sei@google.*",
				"gws_rd@google.*",
				"gs_gbg@google.*",
				"gs_mss@google.*",
				"gs_rn@google.*",
				"_hsenc",
				"_hsmi",
				"__hssc",
				"__hstc",
				"hsCtaTracking",
				"source@sourceforge.net",
				"position@sourceforge.net",
				"t@*.twitter.com",
				"s@*.twitter.com",
				"ref_*@*.twitter.com",
				"t@*.x.com",
				"s@*.x.com",
				"ref_*@*.x.com",
				"t@*.fixupx.com",
				"s@*.fixupx.com",
				"ref_*@*.fixupx.com",
				"t@*.fxtwitter.com",
				"s@*.fxtwitter.com",
				"ref_*@*.fxtwitter.com",
				"t@*.twittpr.com",
				"s@*.twittpr.com",
				"ref_*@*.twittpr.com",
				"t@*.fixvx.com",
				"s@*.fixvx.com",
				"ref_*@*.fixvx.com",
				"tt_medium",
				"tt_content",
				"lr@yandex.*",
				"redircnt@yandex.*",
				"feature@*.youtube.com",
				"kw@*.youtube.com",
				"si@*.youtube.com",
				"pp@*.youtube.com",
				"si@*.youtu.be",
				"wt_zmc",
				"utm_source",
				"utm_content",
				"utm_medium",
				"utm_campaign",
				"utm_term",
				"si@open.spotify.com",
				"igshid",
				"igsh",
				"share_id@reddit.com",
			];
		});
	var E2,
		d4,
		Fu,
		O2 = g(() => {
			"use strict";
			a();
			Sn();
			P();
			T();
			L2();
			(E2 = /[\\^$.*+?()[\]{}|]/g),
				(d4 = RegExp(E2.source)),
				(Fu = h({
					name: "ClearURLs",
					description: "Removes tracking garbage from URLs",
					authors: [d.adryd],
					dependencies: ["MessageEventsAPI"],
					escapeRegExp(e) {
						return e && d4.test(e) ? e.replace(E2, "\\$&") : e || "";
					},
					createRules() {
						let e = D2;
						(this.universalRules = new Set()),
							(this.rulesByHost = new Map()),
							(this.hostRules = new Map());
						for (let t of e) {
							let o = t.split("@"),
								r = new RegExp(
									"^" + this.escapeRegExp(o[0]).replace(/\\\*/, ".+?") + "$"
								);
							if (!o[1]) {
								this.universalRules.add(r);
								continue;
							}
							let i = new RegExp(
									"^(www\\.)?" +
										this.escapeRegExp(o[1])
											.replace(/\\\./, "\\.")
											.replace(/^\\\*\\\./, "(.+?\\.)?")
											.replace(/\\\*/, ".+?") +
										"$"
								),
								s = i.toString();
							this.hostRules.set(s, i),
								this.rulesByHost.get(s) == null &&
									this.rulesByHost.set(s, new Set()),
								this.rulesByHost.get(s).add(r);
						}
					},
					removeParam(e, t, o) {
						(t === e || (e instanceof RegExp && e.test(t))) && o.delete(t);
					},
					replacer(e) {
						try {
							var t = new URL(e);
						} catch {
							return e;
						}
						return t.searchParams.entries().next().done
							? e
							: (this.universalRules.forEach((o) => {
									t.searchParams.forEach((r, i, s) => {
										this.removeParam(o, i, s);
									});
								}),
								this.hostRules.forEach((o, r) => {
									!o.test(t.hostname) ||
										this.rulesByHost.get(r).forEach((i) => {
											t.searchParams.forEach((s, l, c) => {
												this.removeParam(i, l, c);
											});
										});
								}),
								t.toString());
					},
					onSend(e) {
						e.content.match(/http(s)?:\/\//) &&
							(e.content = e.content.replace(
								/(https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s])/g,
								(t) => this.replacer(t)
							));
					},
					start() {
						this.createRules(),
							(this.preSend = yo((e, t) => this.onSend(t))),
							(this.preEdit = Ti((e, t, o) => this.onSend(o)));
					},
					stop() {
						vo(this.preSend), xi(this.preEdit);
					},
				}));
		});
	var F2 = g(() => {});
	function H2(e) {
		let t = e.toString(16).padStart(6, "0");
		(tl.store.color = t), z2(t);
	}
	function _2(e) {
		g4({ theme: e });
	}
	function h4() {
		let e = Oe([B2], () => B2.theme),
			t = e === "light",
			o = t ? "dark" : "light",
			i = Oe([U2], () => U2.gradientPreset) !== void 0,
			s = w4(tl.store.color),
			l = !1,
			c = !0;
		return (
			((t && s < 0.26) || (!t && s > 0.12)) && (l = !0),
			s < 0.26 && s > 0.12 && (c = !1),
			t && s > 0.65 && ((l = !0), (c = !1)),
			n(
				"div",
				{ className: "client-theme-settings" },
				n(
					"div",
					{ className: "client-theme-container" },
					n(
						"div",
						{ className: "client-theme-settings-labels" },
						n(S.FormTitle, { tag: "h3" }, "Theme Color"),
						n(S.FormText, null, "Add a color to your Discord client theme")
					),
					n(m4, {
						color: parseInt(tl.store.color, 16),
						onChange: H2,
						showEyeDropper: !1,
						suggestedColors: f4,
					})
				),
				(l || i) &&
					n(
						f,
						null,
						n(S.FormDivider, { className: H(G.top8, G.bottom8) }),
						n(
							"div",
							{
								className: `client-theme-contrast-warning ${l ? (t ? "theme-dark" : "theme-light") : ""}`,
							},
							n(
								"div",
								{ className: "client-theme-warning" },
								n(S.FormText, null, "Warning, your theme won't look good:"),
								l &&
									n(
										S.FormText,
										null,
										"Selected color won't contrast well with text"
									),
								i && n(S.FormText, null, "Nitro themes aren't supported")
							),
							l &&
								c &&
								n(
									M,
									{ onClick: () => _2(o), color: M.Colors.RED },
									"Switch to ",
									o,
									" mode"
								),
							i &&
								n(
									M,
									{ onClick: () => _2(e), color: M.Colors.RED },
									"Disable Nitro Theme"
								)
						)
					)
			)
		);
	}
	function G2(e, t, o) {
		return Object.entries(e)
			.filter(([r]) => r.search(t) > -1)
			.map(([r, i]) => {
				let s = i - e[o],
					l = s >= 0 ? "+" : "-";
				return `${r}: var(--theme-h) var(--theme-s) calc(var(--theme-l) ${l} ${Math.abs(s).toFixed(2)}%);`;
			}).join(`
`);
	}
	function S4(e) {
		let t = {},
			o = $2.exec(e);
		for (; o !== null; ) {
			let [, r, i] = o;
			(t[r] = parseFloat(i)), (o = $2.exec(e));
		}
		n1(
			"clientThemeOffsets",
			[
				`.theme-light {
 ${G2(t, y4, "--primary-345-hsl")} 
}`,
				`.theme-dark {
 ${G2(t, v4, "--primary-600-hsl")} 
}`,
			].join(`

`)
		);
	}
	function b4(e) {
		let t = /\.theme-light[^{]*\{[^}]*var\(--white-500\)[^}]*}/gm,
			o = [...e.matchAll(t)].flat(),
			r = /^([^{]*)\{background:var\(--white-500\)/m,
			i = /^([^{]*)\{background-color:var\(--white-500\)/m,
			s = Bu(o, (w) => _u(w, r)).join(`,
`),
			l = Bu(o, (w) => _u(w, i)).join(`,
`),
			c = `${s} {
 background: var(--primary-100) 
}`,
			u = `${l} {
 background-color: var(--primary-100) 
}`,
			p =
				/\.theme-light\{([^}]*--[^:}]*(?:background|bg)[^:}]*:var\(--white-500\)[^}]*)\}/m,
			m = /^(--[^:]*(?:background|bg)[^:]*):var\(--white-500\)/m,
			y = Bu(o, (w) => _u(w, p))
				.map((w) => w.split(";"))
				.flat(),
			N = `.theme-light {
 ${Bu(y, (w) => _u(w, m)).map((w) => `${w}: var(--primary-100);`).join(`
`)} 
}`;
		n1(
			"clientThemeLightModeFixes",
			[c, u, N].join(`

`)
		);
	}
	function _u(e, t) {
		let o = e.match(t);
		return o === null ? null : o[1];
	}
	function Bu(e, t) {
		return e.map(t).filter(Boolean);
	}
	function z2(e) {
		let { hue: t, saturation: o, lightness: r } = x4(e),
			i = document.getElementById("clientThemeVars");
		i || (i = n1("clientThemeVars")),
			(i.textContent = `:root {
        --theme-h: ${t};
        --theme-s: ${o}%;
        --theme-l: ${r}%;
    }`);
	}
	function n1(e, t = "") {
		let o = document.createElement("style");
		return (
			o.setAttribute("id", e),
			(o.textContent = t
				.split(
					`
`
				)
				.map((r) => r.trim()).join(`
`)),
			document.body.appendChild(o),
			o
		);
	}
	async function T4() {
		let e = "",
			t = document.querySelectorAll('link[rel="stylesheet"]');
		for (let o of t) {
			let r = o.getAttribute("href");
			if (!r) continue;
			let i = await fetch(r);
			e += await i.text();
		}
		return e;
	}
	function x4(e) {
		let t = parseInt(e.substring(0, 2), 16) / 255,
			o = parseInt(e.substring(2, 4), 16) / 255,
			r = parseInt(e.substring(4, 6), 16) / 255,
			i = Math.max(t, o, r),
			s = Math.min(t, o, r),
			l = i - s,
			c,
			u,
			p;
		return (
			(p = (i + s) / 2),
			l === 0
				? ((c = 0), (u = 0))
				: ((u = l / (1 - Math.abs(2 * p - 1))),
					i === t
						? (c = ((o - r) / l) % 6)
						: i === o
							? (c = (r - t) / l + 2)
							: (c = (t - o) / l + 4),
					(c *= 60),
					c < 0 && (c += 360)),
			(u *= 100),
			(p *= 100),
			{ hue: c, saturation: u, lightness: p }
		);
	}
	function w4(e) {
		let t = (s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4),
			o = t(parseInt(e.substring(0, 2), 16) / 255),
			r = t(parseInt(e.substring(2, 4), 16) / 255),
			i = t(parseInt(e.substring(4, 6), 16) / 255);
		return o * 0.2126 + r * 0.7152 + i * 0.0722;
	}
	var m4,
		f4,
		g4,
		B2,
		U2,
		tl,
		Uu,
		$2,
		y4,
		v4,
		W2 = g(() => {
			"use strict";
			a();
			F2();
			F();
			P();
			Ye();
			me();
			T();
			U();
			b();
			(m4 = ae(
				".Messages.USER_SETTINGS_PROFILE_COLOR_SELECT_COLOR",
				".BACKGROUND_PRIMARY)"
			)),
				(f4 = [
					"#1E1514",
					"#172019",
					"#13171B",
					"#1C1C28",
					"#402D2D",
					"#3A483D",
					"#344242",
					"#313D4B",
					"#2D2F47",
					"#322B42",
					"#3C2E42",
					"#422938",
					"#b6908f",
					"#bfa088",
					"#d3c77d",
					"#86ac86",
					"#88aab3",
					"#8693b5",
					"#8a89ba",
					"#ad94bb",
				]);
			g4 = fe('type:"UNSYNCED_USER_SETTINGS_UPDATE', '"system"===');
			(B2 = K("ThemeStore")), (U2 = K("ClientThemesBackgroundStore"));
			(tl = x({
				color: {
					description:
						"Color your Discord client theme will be based around. Light mode isn't supported",
					type: 6,
					default: "313338",
					component: () => n(h4, null),
				},
				resetColor: {
					description: "Reset Theme Color",
					type: 6,
					default: "313338",
					component: () =>
						n(M, { onClick: () => H2(3224376) }, "Reset Theme Color"),
				},
			})),
				(Uu = h({
					name: "ClientTheme",
					authors: [d.F53, d.Nuckyz],
					description:
						"Recreation of the old client theme experiment. Add a color to your Discord client theme",
					settings: tl,
					startAt: "DOMContentLoaded",
					async start() {
						z2(tl.store.color);
						let e = await T4();
						S4(e), b4(e);
					},
					stop() {
						document.getElementById("clientThemeVars")?.remove(),
							document.getElementById("clientThemeOffsets")?.remove();
					},
				})),
				($2 = /(--primary-\d{3}-hsl):.*?(\S*)%;/g),
				(y4 = /^--primary-[1-5]\d{2}-hsl/g),
				(v4 = /^--primary-[5-9]\d{2}-hsl/g);
		});
	var $u,
		j2 = g(() => {
			"use strict";
			a();
			P();
			T();
			$u = h({
				name: "ColorSighted",
				description:
					"Removes the colorblind-friendly icons from statuses, just like 2015-2017 Discord",
				authors: [d.lewisakura],
				patches: [
					{
						find: "Masks.STATUS_ONLINE",
						replacement: {
							match: /Masks\.STATUS_(?:IDLE|DND|STREAMING|OFFLINE)/g,
							replace: "Masks.STATUS_ONLINE",
						},
					},
					{
						find: ".AVATAR_STATUS_MOBILE_16;",
						replacement: {
							match: /(fromIsMobile:\i=!0,.+?)status:(\i)/,
							replace: '$1status_$:$2="online"',
						},
					},
				],
			});
		});
	var bn,
		P4,
		ol,
		Gu,
		q2 = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(bn = () => {}),
				(P4 = {
					logDangerously: bn,
					log: bn,
					verboseDangerously: bn,
					verbose: bn,
					info: bn,
					warn: bn,
					error: bn,
					trace: bn,
					time: bn,
					fileOnly: bn,
				}),
				(ol = x({
					disableNoisyLoggers: {
						type: 3,
						description: "Disable noisy loggers like the MessageActionCreators",
						default: !1,
						restartNeeded: !0,
					},
					disableSpotifyLogger: {
						type: 3,
						description:
							"Disable the Spotify logger, which leaks account information and access token",
						default: !0,
						restartNeeded: !0,
					},
				})),
				(Gu = h({
					name: "ConsoleJanitor",
					description: "Disables annoying console messages/errors",
					authors: [d.Nuckyz],
					settings: ol,
					NoopLogger: () => P4,
					patches: [
						{
							find: 'console.warn("Window state not initialized"',
							replacement: {
								match: /console\.warn\("Window state not initialized",\i\),/,
								replace: "",
							},
						},
						{
							find: "is not a valid locale.",
							replacement: {
								match:
									/\i\.error\(""\.concat\(\i," is not a valid locale."\)\);/,
								replace: "",
							},
						},
						{
							find: "notosans-400-normalitalic",
							replacement: { match: /,"notosans-.+?"/g, replace: "" },
						},
						{
							find: 'console.warn("[DEPRECATED] Please use `subscribeWithSelector` middleware");',
							all: !0,
							replacement: {
								match:
									/console\.warn\("\[DEPRECATED\] Please use `subscribeWithSelector` middleware"\);/,
								replace: "",
							},
						},
						{
							find: "RPCServer:WSS",
							replacement: {
								match: /\i\.error\("Error: "\.concat\((\i)\.message/,
								replace: '!$1.message.includes("EADDRINUSE")&&$&',
							},
						},
						{
							find: "Tried getting Dispatch instance before instantiated",
							replacement: {
								match:
									/null==\i&&\i\.warn\("Tried getting Dispatch instance before instantiated"\),/,
								replace: "",
							},
						},
						{
							find: "Unable to determine render window for element",
							replacement: {
								match:
									/console\.warn\("Unable to determine render window for element",\i\),/,
								replace: "",
							},
						},
						{
							find: "failed to send analytics events",
							replacement: {
								match:
									/console\.error\("\[analytics\] failed to send analytics events query: "\.concat\(\i\)\)/,
								replace: "",
							},
						},
						{
							find: "Slow dispatch on",
							replacement: {
								match:
									/\i\.totalTime>100&&\i\.verbose\("Slow dispatch on ".+?\)\);/,
								replace: "",
							},
						},
						...[
							'("MessageActionCreators")',
							'("ChannelMessages")',
							'("Routing/Utils")',
							'("RTCControlSocket")',
							'("ConnectionEventFramerateReducer")',
							'("RTCLatencyTestManager")',
							'("OverlayBridgeStore")',
							'("RPCServer:WSS")',
							'("RPCServer:IPC")',
						].map((e) => ({
							find: e,
							predicate: () => ol.store.disableNoisyLoggers,
							all: !0,
							replacement: {
								match: new RegExp(
									String.raw`new \i\.\i${e.replace(/([()])/g, "\\$1")}`
								),
								replace: `$self.NoopLogger${e}`,
							},
						})),
						{
							find: '"Experimental codecs: "',
							predicate: () => ol.store.disableNoisyLoggers,
							replacement: {
								match: /new \i\.\i\("Connection\("\.concat\(\i,"\)"\)\)/,
								replace: "$self.NoopLogger()",
							},
						},
						{
							find: '"Handling ping: "',
							predicate: () => ol.store.disableNoisyLoggers,
							replacement: {
								match: /new \i\.\i\("RTCConnection\("\.concat.+?\)\)(?=,)/,
								replace: "$self.NoopLogger()",
							},
						},
						{
							find: '("Spotify")',
							predicate: () => ol.store.disableSpotifyLogger,
							replacement: {
								match: /new \i\.\i\("Spotify"\)/,
								replace: "$self.NoopLogger()",
							},
						},
					],
				}));
		});
	var K2 = g(() => {
		"use strict";
		a();
		De();
		Jo();
		U();
		U();
	});
	function r1() {
		function e(i, s = !1) {
			let l = new Map();
			return function (...c) {
				let u = String(c);
				if (l.has(u)) return l.get(u);
				let p = ko(i(...c), s),
					m = (() => {
						switch (p.length) {
							case 0:
								return null;
							case 1:
								return p[0];
							default:
								let y = [...new Set(p)];
								return (
									y.length > 1 &&
										console.warn(
											`Warning: This filter matches ${p.length} modules. Make it more specific!
`,
											y
										),
									y[0]
								);
						}
					})();
				return m && u && l.set(u, m), m;
			};
		}
		let t,
			o = e((i) => i),
			r = e(ne.byProps);
		return {
			wp: Vl,
			wpc: { getter: () => zo },
			wreq: { getter: () => Ht },
			WebpackInstances: {
				getter: () => Vencord.WebpackPatcher.allWebpackInstances,
			},
			loadLazyChunks: () => {
				throw new Error("loadLazyChunks is dev only.");
			},
			wpsearch: Qr,
			wpex: ta,
			wpexs: (...i) => ta(Ui(...i)),
			filters: ne,
			find: o,
			findAll: ko,
			findComponent: o,
			findAllComponents: ko,
			findExportedComponent: (...i) => r(...i)[i[0]],
			findComponentByCode: e(ne.componentByCode),
			findAllComponentsByCode: (...i) => ko(ne.componentByCode(...i)),
			findComponentByFields: e(ne.componentByFields),
			findAllComponentsByFields: (...i) => ko(ne.componentByFields(...i)),
			findByProps: r,
			findAllByProps: (...i) => ko(ne.byProps(...i)),
			findProp: (...i) => r(...i)[i[0]],
			findByCode: e(ne.byCode),
			findAllByCode: (i) => ko(ne.byCode(...i)),
			findStore: e(ne.byStoreName),
			findByFactoryCode: e(ne.byFactoryCode),
			findAllByFactoryCode: (...i) => ko(ne.byFactoryCode(...i)),
			findModuleFactory: e(ne.byFactoryCode, !0),
			findAllModuleFactories: (...i) => ko(ne.byFactoryCode(...i), !0),
			plugins: { getter: () => Vencord.Plugins.plugins },
			PluginsApi: { getter: () => Vencord.Plugins },
			Settings: { getter: () => Vencord.Settings },
			Api: { getter: () => Vencord.Api },
			Util: { getter: () => Vencord.Util },
			reload: () => location.reload(),
			restart: M4("restart"),
			canonicalizeMatch: Yt,
			canonicalizeReplace: Ks,
			canonicalizeReplacement: Ys,
			preEnable: (i) =>
				((Vencord.Settings.plugins[i] ??= { enabled: !0 }).enabled = !0),
			fakeRender: (i, s) => {
				let l = t?.deref(),
					c =
						l?.closed === !1
							? l
							: window.open(
									"about:blank",
									"Fake Render",
									"popup,width=500,height=500"
								);
				(t = new WeakRef(c)), c.focus();
				let u = c.document;
				(u.body.style.margin = "1em"),
					c.prepared ||
						((c.prepared = !0),
						[
							...document.querySelectorAll("style"),
							...document.querySelectorAll("link[rel=stylesheet]"),
						].forEach((p) => {
							let m = p.cloneNode(!0);
							p.parentElement?.tagName === "HEAD"
								? u.head.append(m)
								: m.id?.startsWith("vencord-") || m.id?.startsWith("vcd-")
									? u.documentElement.append(m)
									: u.body.append(m);
						})),
					ti.render(
						q.createElement(i, s),
						u.body.appendChild(document.createElement("div"))
					);
			},
			channel: { getter: () => fn(), preload: !1 },
			channelId: { getter: () => xe.getChannelId(), preload: !1 },
			guild: { getter: () => li(), preload: !1 },
			guildId: { getter: () => to.getGuildId(), preload: !1 },
			me: { getter: () => D.getCurrentUser(), preload: !1 },
			meId: { getter: () => D.getCurrentUser().id, preload: !1 },
			messages: {
				getter: () => jt.getMessages(xe.getChannelId()),
				preload: !1,
			},
			...Object.fromEntries(
				Object.keys(qi).map((i) => [i, { getter: () => qi[i] }])
			),
			Stores: {
				getter: () =>
					Object.fromEntries(
						oi.Store.getAll()
							.map((i) => [i.getName(), i])
							.filter(([i]) => i.length > 1)
					),
			},
		};
	}
	function Y2(e, t, o) {
		let r = t.getter();
		if (!r || t.preload === !1) return r;
		function i(l) {
			return l[Ho]
				? o
					? l[Ho]()
					: l[Go]
				: l[xo]
					? o
						? l[xo]()
						: l[At]
					: l[uo] && l[uo]() != null
						? l[uo]()
						: l;
		}
		let s = i(r);
		if (s != null && typeof s == "object") {
			let l = Object.getOwnPropertyDescriptors(s);
			for (let c in l) {
				if (s[c] == null) continue;
				let u = l[c];
				if (u.writable === !0 || u.set != null) {
					let p = s[c],
						m = i(p);
					m != null && p !== m && (s[c] = m);
				}
			}
		}
		return s != null && i1(window.shortcutList, e, { value: s }), s;
	}
	var M4,
		i1,
		Hu,
		Z2 = g(() => {
			"use strict";
			a();
			P();
			it();
			co();
			qs();
			Gn();
			Jo();
			Zs();
			T();
			U();
			U();
			b();
			K2();
			(M4 = (e) => () => {
				throw new Error(`'${e}' is Discord Desktop only.`);
			}),
				(i1 = (e, t, o) => (
					Object.hasOwn(o, "value") && (o.writable = !0),
					Object.defineProperty(e, t, {
						configurable: !0,
						enumerable: !0,
						...o,
					})
				));
			Hu = h({
				name: "ConsoleShortcuts",
				description:
					"Adds shorter Aliases for many things on the window. Run `shortcutList` for a list.",
				authors: [d.Ven],
				startAt: "Init",
				start() {
					let e = r1();
					window.shortcutList = {};
					for (let t in e) {
						let o = e[t];
						Object.hasOwn(o, "getter")
							? (i1(window.shortcutList, t, { get: () => Y2(t, o, !0) }),
								i1(window, t, { get: () => window.shortcutList[t] }))
							: ((window.shortcutList[t] = o), (window[t] = o));
					}
					Yr.then(() => {
						setTimeout(() => this.eagerLoad(!1), 1e3);
					});
				},
				async eagerLoad(e) {
					await Yr;
					let t = r1();
					for (let o in t) {
						let r = t[o];
						if (!(!Object.hasOwn(r, "getter") || r.preload === !1))
							try {
								Y2(o, r, e);
							} catch {}
					}
				},
				stop() {
					delete window.shortcutList;
					for (let e in r1()) delete window[e];
				},
			});
		});
	function C4(e, t) {
		let { id: o, name: r } = e.dataset;
		return o
			? `<${e?.firstChild.src.match(/https:\/\/cdn\.discordapp\.com\/emojis\/\d+\.(\w+)/)?.[1] === "gif" ? "a" : ""}:${r.replace(/~\d+$/, "")}:${o}>`
			: t
				? I4(r)
				: `:${r}:`;
	}
	var I4,
		Q2,
		zu,
		X2 = g(() => {
			"use strict";
			a();
			F();
			P();
			me();
			T();
			U();
			b();
			I4 = Bi("convertNameToSurrogate");
			(Q2 = x({
				copyUnicode: {
					type: 3,
					description:
						"Copy the raw unicode character instead of :name: for default emojis (\u{1F47D})",
					default: !0,
				},
			})),
				(zu = h({
					name: "CopyEmojiMarkdown",
					description:
						"Allows you to copy emojis as formatted string (<:blobcatcozy:1026533070955872337>)",
					authors: [d.HappyEnderman, d.Vishnya],
					settings: Q2,
					contextMenus: {
						"expression-picker"(e, { target: t }) {
							t.dataset.type === "emoji" &&
								e.push(
									n(E.MenuItem, {
										id: "vc-copy-emoji-markdown",
										label: "Copy Emoji Markdown",
										action: () => {
											Kt(
												C4(t, Q2.store.copyUnicode),
												"Success! Copied emoji markdown."
											);
										},
									})
								);
						},
					},
				}));
		});
	var A4,
		Wu,
		J2 = g(() => {
			"use strict";
			a();
			yt();
			P();
			T();
			b();
			(A4 = (e, { user: t }) => {
				!t ||
					e.push(
						n(E.MenuItem, {
							id: "vc-copy-user-url",
							label: "Copy User URL",
							action: () => Gt.copy(`<https://discord.com/users/${t.id}>`),
							icon: hi,
						})
					);
			}),
				(Wu = h({
					name: "CopyUserURLs",
					authors: [d.castdrian],
					description:
						"Adds a 'Copy User URL' option to the user context menu.",
					contextMenus: { "user-context": A4 },
				}));
		});
	var Tn,
		N4,
		R4,
		s1,
		V2,
		a1,
		l1,
		ju,
		eT = g(() => {
			"use strict";
			a();
			Bn();
			F();
			P();
			De();
			Ke();
			T();
			vi();
			U();
			b();
			(Tn = new V("CrashHandler")),
				(N4 = C("pushLazy", "popAll")),
				(R4 = C("clearDraft", "saveDraft")),
				(s1 = x({
					attemptToPreventCrashes: {
						type: 3,
						description: "Whether to attempt to prevent Discord crashes.",
						default: !0,
					},
					attemptToNavigateToHome: {
						type: 3,
						description:
							"Whether to attempt to navigate to the home when preventing Discord crashes.",
						default: !1,
					},
				})),
				(V2 = !1),
				(a1 = !1),
				(l1 = !0),
				(ju = h({
					name: "CrashHandler",
					description:
						"Utility plugin for handling and possibly recovering from crashes without a restart",
					authors: [d.Nuckyz],
					enabledByDefault: !0,
					settings: s1,
					patches: [
						{
							find: ".Messages.ERRORS_UNEXPECTED_CRASH",
							replacement: {
								match: /this\.setState\((.+?)\)/,
								replace: "$self.handleCrash(this,$1);",
							},
						},
					],
					handleCrash(e, t) {
						e.setState(t),
							!a1 &&
								((a1 = !0),
								setTimeout(() => {
									try {
										if (!l1) {
											try {
												ze({
													color: "#eed202",
													title: "Discord has crashed!",
													body: "Awn :( Discord has crashed two times rapidly, not attempting to recover.",
													noPersist: !0,
												});
											} catch {}
											return;
										}
										(l1 = !1), setTimeout(() => (l1 = !0), 1e3);
									} catch {}
									try {
										V2 ||
											((V2 = !0),
											ja(
												"Uh oh, Discord has just crashed... but good news, there is a Vencord update available that might fix this issue! Would you like to update now?",
												!0
											));
									} catch {}
									try {
										s1.store.attemptToPreventCrashes &&
											this.handlePreventCrash(e);
									} catch (o) {
										Tn.error("Failed to handle crash", o);
									}
								}, 1));
					},
					handlePreventCrash(e) {
						try {
							ze({
								color: "#eed202",
								title: "Discord has crashed!",
								body: "Attempting to recover...",
								noPersist: !0,
							});
						} catch {}
						try {
							let t = xe.getChannelId();
							for (let o in Wt)
								!Number.isNaN(Number(o)) || R4.clearDraft(t, Wt[o]);
						} catch (t) {
							Tn.debug("Failed to clear drafts.", t);
						}
						try {
							ua.closeExpressionPicker();
						} catch (t) {
							Tn.debug("Failed to close expression picker.", t);
						}
						try {
							_.dispatch({ type: "CONTEXT_MENU_CLOSE" });
						} catch (t) {
							Tn.debug("Failed to close open context menu.", t);
						}
						try {
							N4.popAll();
						} catch (t) {
							Tn.debug("Failed to close old modals.", t);
						}
						try {
							mn();
						} catch (t) {
							Tn.debug("Failed to close all open modals.", t);
						}
						try {
							_.dispatch({ type: "USER_PROFILE_MODAL_CLOSE" });
						} catch (t) {
							Tn.debug("Failed to close user popout.", t);
						}
						try {
							_.dispatch({ type: "LAYER_POP_ALL" });
						} catch (t) {
							Tn.debug("Failed to pop all layers.", t);
						}
						if (s1.store.attemptToNavigateToHome)
							try {
								en.transitionTo("/channels/@me");
							} catch (t) {
								Tn.debug("Failed to navigate to home", t);
							}
						setImmediate(() => (a1 = !1));
						try {
							e.setState({ error: null, info: null });
						} catch (t) {
							Tn.debug("Failed to update crash handler component.", t);
						}
					},
				}));
		});
	var qu,
		tT = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			qu = h({
				name: "CtrlEnterSend",
				authors: [d.UlyssesZhan],
				description: "Use Ctrl+Enter to send messages (customizable)",
				settings: x({
					submitRule: {
						description: "The way to send a message",
						type: 4,
						options: [
							{
								label:
									"Ctrl+Enter (Enter or Shift+Enter for new line) (cmd+enter on macOS)",
								value: "ctrl+enter",
							},
							{
								label: "Shift+Enter (Enter for new line)",
								value: "shift+enter",
							},
							{
								label: "Enter (Shift+Enter for new line; Discord default)",
								value: "enter",
							},
						],
						default: "ctrl+enter",
					},
					sendMessageInTheMiddleOfACodeBlock: {
						description:
							"Whether to send a message in the middle of a code block",
						type: 3,
						default: !0,
					},
				}),
				patches: [
					{
						find: ".ENTER&&(!",
						replacement: {
							match:
								/(?<=(\i)\.which===\i\.\i.ENTER&&).{0,100}(\(0,\i\.\i\)\(\i\)).{0,100}(?=&&\(\i\.preventDefault)/,
							replace: "$self.shouldSubmit($1, $2)",
						},
					},
					{
						find: "!this.hasOpenCodeBlock()",
						replacement: {
							match:
								/!(\i).shiftKey&&!(this.hasOpenCodeBlock\(\))&&\(.{0,100}?\)/,
							replace: "$self.shouldSubmit($1, $2)",
						},
					},
				],
				shouldSubmit(e, t) {
					let o = !1;
					switch (this.settings.store.submitRule) {
						case "shift+enter":
							o = e.shiftKey;
							break;
						case "ctrl+enter":
							o = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
							break;
						case "enter":
							o = !e.shiftKey && !e.ctrlKey;
							break;
					}
					return (
						this.settings.store.sendMessageInTheMiddleOfACodeBlock ||
							(o &&= !t),
						o
					);
				},
			});
		});
	async function nT(e) {
		return /https?:\/\/(cdn|media)\.discordapp\.(com|net)\/attachments\//.test(
			e
		)
			? "mp:" + e.replace(/https?:\/\/(cdn|media)\.discordapp\.(com|net)\//, "")
			: (await ii.fetchAssetIds(wi.store.appID, [e]))[0];
	}
	function Xt() {
		Ku(!0), Vencord.Plugins.isPluginEnabled("CustomRPC") && Ku();
	}
	function sT() {
		return wi.store.type !== 1;
	}
	function E4(e) {
		return !sT() && !/https?:\/\/(www\.)?(twitch\.tv|youtube\.com)\/\w+/.test(e)
			? "Streaming link must be a valid URL."
			: !0;
	}
	function rT() {
		return wi.store.timestampMode !== 3;
	}
	function iT(e) {
		return /https?:\/\/(?!i\.)?imgur\.com\//.test(e)
			? "Imgur link must be a direct link to the image. (e.g. https://i.imgur.com/...)"
			: /https?:\/\/(?!media\.)?tenor\.com\//.test(e)
				? "Tenor link must be a direct link to the image. (e.g. https://media.tenor.com/...)"
				: !0;
	}
	async function aT() {
		let {
			appID: e,
			appName: t,
			details: o,
			state: r,
			type: i,
			streamLink: s,
			startTime: l,
			endTime: c,
			imageBig: u,
			imageBigTooltip: p,
			imageSmall: m,
			imageSmallTooltip: y,
			buttonOneText: v,
			buttonOneURL: N,
			buttonTwoText: w,
			buttonTwoURL: I,
		} = wi.store;
		if (!t) return;
		let A = {
			application_id: e || "0",
			name: t,
			state: r,
			details: o,
			type: i,
			flags: 1 << 0,
		};
		switch ((i === 1 && (A.url = s), wi.store.timestampMode)) {
			case 1:
				A.timestamps = { start: Date.now() };
				break;
			case 2:
				A.timestamps = {
					start:
						Date.now() -
						(new Date().getHours() * 3600 +
							new Date().getMinutes() * 60 +
							new Date().getSeconds()) *
							1e3,
				};
				break;
			case 3:
				(l || c) &&
					((A.timestamps = {}),
					l && (A.timestamps.start = l),
					c && (A.timestamps.end = c));
				break;
			case 0:
			default:
				break;
		}
		v &&
			((A.buttons = [v, w].filter(mc)),
			(A.metadata = { button_urls: [N, I].filter(mc) })),
			u && (A.assets = { large_image: await nT(u), large_text: p || void 0 }),
			m &&
				(A.assets = {
					...A.assets,
					small_image: await nT(m),
					small_text: y || void 0,
				});
		for (let L in A) {
			if (L === "type") continue;
			let k = A[L];
			(!k || k.length === 0) && delete A[L];
		}
		return A;
	}
	async function Ku(e) {
		let t = await aT();
		_.dispatch({
			type: "LOCAL_ACTIVITY_UPDATE",
			activity: e ? null : t,
			socketId: "CustomRPC",
		});
	}
	var k4,
		D4,
		L4,
		oT,
		wi,
		Yu,
		lT = g(() => {
			"use strict";
			a();
			F();
			Ir();
			gi();
			no();
			P();
			Yi();
			Ye();
			me();
			ct();
			T();
			U();
			b();
			(k4 = fe("profileThemeStyle:", "--profile-gradient-primary-color")),
				(D4 = ae("onOpenGameProfile")),
				(L4 = C("activity", "buttonColor")),
				(oT = Uo("status", "showCurrentGame"));
			wi = x({
				appID: {
					type: 0,
					description: "Application ID (required)",
					onChange: Xt,
					isValid: (e) =>
						e
							? e && !/^\d+$/.test(e)
								? "Application ID must be a number."
								: !0
							: "Application ID is required.",
				},
				appName: {
					type: 0,
					description: "Application name (required)",
					onChange: Xt,
					isValid: (e) =>
						e
							? e.length > 128
								? "Application name must be not longer than 128 characters."
								: !0
							: "Application name is required.",
				},
				details: {
					type: 0,
					description: "Details (line 1)",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 128
							? "Details (line 1) must be not longer than 128 characters."
							: !0,
				},
				state: {
					type: 0,
					description: "State (line 2)",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 128
							? "State (line 2) must be not longer than 128 characters."
							: !0,
				},
				type: {
					type: 4,
					description: "Activity type",
					onChange: Xt,
					options: [
						{ label: "Playing", value: 0, default: !0 },
						{ label: "Streaming", value: 1 },
						{ label: "Listening", value: 2 },
						{ label: "Watching", value: 3 },
						{ label: "Competing", value: 5 },
					],
				},
				streamLink: {
					type: 0,
					description:
						"Twitch.tv or Youtube.com link (only for Streaming activity type)",
					onChange: Xt,
					disabled: sT,
					isValid: E4,
				},
				timestampMode: {
					type: 4,
					description: "Timestamp mode",
					onChange: Xt,
					options: [
						{ label: "None", value: 0, default: !0 },
						{ label: "Since discord open", value: 1 },
						{ label: "Same as your current time", value: 2 },
						{ label: "Custom", value: 3 },
					],
				},
				startTime: {
					type: 1,
					description:
						"Start timestamp in milliseconds (only for custom timestamp mode)",
					onChange: Xt,
					disabled: rT,
					isValid: (e) =>
						e && e < 0 ? "Start timestamp must be greater than 0." : !0,
				},
				endTime: {
					type: 1,
					description:
						"End timestamp in milliseconds (only for custom timestamp mode)",
					onChange: Xt,
					disabled: rT,
					isValid: (e) =>
						e && e < 0 ? "End timestamp must be greater than 0." : !0,
				},
				imageBig: {
					type: 0,
					description: "Big image key/link",
					onChange: Xt,
					isValid: iT,
				},
				imageBigTooltip: {
					type: 0,
					description: "Big image tooltip",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 128
							? "Big image tooltip must be not longer than 128 characters."
							: !0,
				},
				imageSmall: {
					type: 0,
					description: "Small image key/link",
					onChange: Xt,
					isValid: iT,
				},
				imageSmallTooltip: {
					type: 0,
					description: "Small image tooltip",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 128
							? "Small image tooltip must be not longer than 128 characters."
							: !0,
				},
				buttonOneText: {
					type: 0,
					description: "Button 1 text",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 31
							? "Button 1 text must be not longer than 31 characters."
							: !0,
				},
				buttonOneURL: { type: 0, description: "Button 1 URL", onChange: Xt },
				buttonTwoText: {
					type: 0,
					description: "Button 2 text",
					onChange: Xt,
					isValid: (e) =>
						e && e.length > 31
							? "Button 2 text must be not longer than 31 characters."
							: !0,
				},
				buttonTwoURL: { type: 0, description: "Button 2 URL", onChange: Xt },
			});
			Yu = h({
				name: "CustomRPC",
				description: "Allows you to set a custom rich presence.",
				authors: [d.captain, d.AutumnVN, d.nin0dev],
				dependencies: ["UserSettingsAPI"],
				start: Ku,
				stop: () => Ku(!0),
				settings: wi,
				settingsAboutComponent: () => {
					let e = pt(aT),
						t = oT.useSetting(),
						{ profileThemeStyle: o } = k4({});
					return n(
						f,
						null,
						!t &&
							n(
								Fo,
								{
									className: H(G.top16, G.bottom16),
									style: { padding: "1em" },
								},
								n(S.FormTitle, null, "Notice"),
								n(
									S.FormText,
									null,
									"Game activity isn't enabled, people won't be able to see your custom rich presence!"
								),
								n(
									M,
									{
										color: M.Colors.TRANSPARENT,
										className: G.top8,
										onClick: () => oT.updateSetting(!0),
									},
									"Enable"
								)
							),
						n(
							S.FormText,
							null,
							"Go to ",
							n(
								He,
								{ href: "https://discord.com/developers/applications" },
								"Discord Developer Portal"
							),
							" to create an application and get the application ID."
						),
						n(
							S.FormText,
							null,
							"Upload images in the Rich Presence tab to get the image keys."
						),
						n(
							S.FormText,
							null,
							"If you want to use image link, download your image and reupload the image to ",
							n(He, { href: "https://imgur.com" }, "Imgur"),
							' and get the image link by right-clicking the image and select "Copy image address".'
						),
						n(S.FormDivider, { className: G.top8 }),
						n(
							"div",
							{ style: { width: "284px", ...o } },
							e[0] &&
								n(D4, {
									activity: e[0],
									className: L4.activity,
									channelId: xe.getChannelId(),
									guild: le.getGuild(to.getLastSelectedGuildId()),
									application: { id: wi.store.appID },
									user: D.getCurrentUser(),
								})
						)
					);
				},
			});
		});
	var c1,
		Zu,
		cT = g(() => {
			"use strict";
			a();
			qn();
			F();
			ns();
			P();
			T();
			b();
			(c1 = x({
				idleTimeout: {
					description:
						"Minutes before Discord goes idle (0 to disable auto-idle)",
					type: 5,
					markers: Bo(0, 60, 5),
					default: 10,
					stickToMarkers: !1,
					restartNeeded: !0,
				},
				remainInIdle: {
					description:
						"When you come back to Discord, remain idle until you confirm you want to go online",
					type: 3,
					default: !0,
				},
			})),
				(Zu = h({
					name: "CustomIdle",
					description:
						"Allows you to set the time before Discord goes idle (or disable auto-idle)",
					authors: [d.newwares],
					settings: c1,
					patches: [
						{
							find: 'type:"IDLE",idle:',
							replacement: [
								{
									match: /(?<=Date\.now\(\)-\i>)\i\.\i/,
									replace: "$self.getIdleTimeout()",
								},
								{
									match:
										/Math\.min\((\i\.\i\.getSetting\(\)\*\i\.\i\.\i\.SECOND),\i\.\i\)/,
									replace: "$1",
								},
								{
									match: /\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)/,
									replace: "$self.handleOnline()",
								},
								{
									match: /(setInterval\(\i,\.25\*)\i\.\i/,
									replace: "$1$self.getIntervalDelay()",
								},
							],
						},
					],
					getIntervalDelay() {
						return Math.min(6e5, this.getIdleTimeout());
					},
					handleOnline() {
						if (!c1.store.remainInIdle) {
							_.dispatch({ type: "IDLE", idle: !1 });
							return;
						}
						let e =
							"Welcome back! Click the button to go online. Click the X to stay idle until reload.";
						Kn.currentNotice?.[1] === e ||
							Kn.noticesQueue.some(([, t]) => t === e) ||
							Kn.showNotice(e, "Exit idle", () => {
								Kn.popNotice(), _.dispatch({ type: "IDLE", idle: !1 });
							});
					},
					getIdleTimeout() {
						let { idleTimeout: e } = c1.store;
						return e === 0 ? 1 / 0 : e * 6e4;
					},
				}));
		});
	var uT = g(() => {});
	async function F4() {
		try {
			let { embed: e } = this.props,
				{ replaceElements: t } = u1.store;
			if (!e || e.dearrow || e.provider?.name !== "YouTube" || !e.video?.url)
				return;
			let o = O4.exec(e.video.url)?.[1];
			if (!o) return;
			let r = await fetch(`https://sponsor.ajay.app/api/branding?videoID=${o}`);
			if (!r.ok) return;
			let { titles: i, thumbnails: s } = await r.json(),
				l = i[0]?.votes >= 0,
				c = s[0]?.votes >= 0 && !s[0].original;
			if (!l && !c) return;
			(e.dearrow = { enabled: !0 }),
				l &&
					t !== 2 &&
					((e.dearrow.oldTitle = e.rawTitle),
					(e.rawTitle = i[0].title.replace(/(^|\s)>(\S)/g, "$1$2"))),
				c &&
					t !== 1 &&
					((e.dearrow.oldThumb = e.thumbnail.proxyURL),
					(e.thumbnail.proxyURL = `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${o}&time=${s[0].timestamp}`)),
				this.forceUpdate();
		} catch (e) {
			new V("Dearrow").error("Failed to dearrow embed", e);
		}
	}
	function _4({ component: e }) {
		let { embed: t } = e.props;
		return t?.dearrow
			? n(
					te,
					{
						text: t.dearrow.enabled
							? "This embed has been dearrowed, click to restore"
							: "Click to dearrow",
					},
					({ onMouseEnter: o, onMouseLeave: r }) =>
						n(
							"button",
							{
								onMouseEnter: o,
								onMouseLeave: r,
								className:
									"vc-dearrow-toggle-" + (t.dearrow.enabled ? "on" : "off"),
								onClick: () => {
									let { enabled: i, oldThumb: s, oldTitle: l } = t.dearrow;
									(t.dearrow.enabled = !i),
										l && ((t.dearrow.oldTitle = t.rawTitle), (t.rawTitle = l)),
										s &&
											((t.dearrow.oldThumb = t.thumbnail.proxyURL),
											(t.thumbnail.proxyURL = s)),
										e.forceUpdate();
								},
							},
							n(
								"svg",
								{
									xmlns: "http://www.w3.org/2000/svg",
									width: "24px",
									height: "24px",
									viewBox: "0 0 36 36",
									"aria-label": "Toggle Dearrow",
								},
								n("path", {
									fill: "#1213BD",
									d: "M36 18.302c0 4.981-2.46 9.198-5.655 12.462s-7.323 5.152-12.199 5.152s-9.764-1.112-12.959-4.376S0 23.283 0 18.302s2.574-9.38 5.769-12.644S13.271 0 18.146 0s9.394 2.178 12.589 5.442C33.931 8.706 36 13.322 36 18.302z",
								}),
								n("path", {
									fill: "#88c9f9",
									d: "m 30.394282,18.410186 c 0,3.468849 -1.143025,6.865475 -3.416513,9.137917 -2.273489,2.272442 -5.670115,2.92874 -9.137918,2.92874 -3.467803,0 -6.373515,-1.147212 -8.6470033,-3.419654 -2.2734888,-2.272442 -3.5871299,-5.178154 -3.5871299,-8.647003 0,-3.46885 0.9420533,-6.746149 3.2144954,-9.0196379 2.2724418,-2.2734888 5.5507878,-3.9513905 9.0196378,-3.9513905 3.46885,0 6.492841,1.9322561 8.76633,4.204698 2.273489,2.2724424 3.788101,5.2974804 3.788101,8.7663304 z",
								}),
								n("path", {
									fill: "#0a62a5",
									d: "m 23.95823,17.818306 c 0,3.153748 -2.644888,5.808102 -5.798635,5.808102 -3.153748,0 -5.599825,-2.654354 -5.599825,-5.808102 0,-3.153747 2.446077,-5.721714 5.599825,-5.721714 3.153747,0 5.798635,2.567967 5.798635,5.721714 z",
								})
							)
						)
				)
			: null;
	}
	var O4,
		u1,
		Qu,
		pT = g(() => {
			"use strict";
			a();
			uT();
			F();
			re();
			P();
			De();
			T();
			b();
			O4 = /https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/;
			(u1 = x({
				hideButton: {
					description: "Hides the Dearrow button from YouTube embeds",
					type: 3,
					default: !1,
					restartNeeded: !0,
				},
				replaceElements: {
					description: "Choose which elements of the embed will be replaced",
					type: 4,
					restartNeeded: !0,
					options: [
						{
							label: "Everything (Titles & Thumbnails)",
							value: 0,
							default: !0,
						},
						{ label: "Titles", value: 1 },
						{ label: "Thumbnails", value: 2 },
					],
				},
			})),
				(Qu = h({
					name: "Dearrow",
					description:
						"Makes YouTube embed titles and thumbnails less sensationalist, powered by Dearrow",
					authors: [d.Ven],
					settings: u1,
					embedDidMount: F4,
					renderButton(e) {
						return n(R, { noop: !0 }, n(_4, { component: e }));
					},
					patches: [
						{
							find: "this.renderInlineMediaEmbed",
							replacement: [
								{
									match: /render\(\)\{.{0,30}let\{embed:/,
									replace: "componentDidMount=$self.embedDidMount;$&",
								},
								{
									match: /children:\[(?=null!=\i\?(\i)\.renderSuppressButton)/,
									replace: "children:[$self.renderButton($1),",
									predicate: () => !u1.store.hideButton,
								},
							],
						},
					],
				}));
		});
	var dT = g(() => {});
	var B4,
		Ar,
		mT,
		fT,
		gT,
		Pi,
		Xu,
		fs,
		nl,
		p1,
		Nr = g(() => {
			"use strict";
			a();
			(B4 = "https://decor.fieryflames.dev"),
				(Ar = B4 + "/api"),
				(mT = Ar + "/authorize"),
				(fT = "https://ugc.decor.fieryflames.dev"),
				(gT = "1096966363416899624"),
				(Pi = "100101099111114"),
				(Xu = "11497119"),
				(fs = "1096357702931841148"),
				(nl = "dXp2SdxDcP"),
				(p1 = 1e3 * 60 * 60 * 4);
		});
	var U4,
		Rr,
		rl = g(() => {
			"use strict";
			a();
			qn();
			co();
			De();
			Ke();
			b();
			Nr();
			(U4 = {
				async getItem(e) {
					return gt.get(e).then((t) => t ?? null);
				},
				async setItem(e, t) {
					await gt.set(e, t);
				},
				async removeItem(e) {
					await gt.del(e);
				},
			}),
				(Rr = Dt(() =>
					si(
						cg(
							(e, t) => ({
								token: null,
								tokens: {},
								init: () => {
									e({ token: t().tokens[D.getCurrentUser().id] ?? null });
								},
								setToken: (o) =>
									e({
										token: o,
										tokens: { ...t().tokens, [D.getCurrentUser().id]: o },
									}),
								remove: (o) => {
									let { tokens: r, init: i } = t(),
										s = { ...r };
									delete s[o], e({ tokens: s }), i();
								},
								async authorize() {
									return new Promise((o, r) =>
										ge(
											(i) =>
												n(ei, {
													...i,
													scopes: ["identify"],
													responseType: "code",
													redirectUri: mT,
													permissions: 0n,
													clientId: gT,
													cancelCompletesFlow: !1,
													callback: async (s) => {
														try {
															let l = new URL(s.location);
															l.searchParams.append("client", "vencord");
															let c = await fetch(l);
															if (c?.ok) {
																let u = await c.text();
																t().setToken(u);
															} else throw new Error("Request not OK");
															o(void 0);
														} catch (l) {
															l instanceof Error &&
																(ft(
																	`Failed to authorize: ${l.message}`,
																	X.Type.FAILURE
																),
																new V("Decor").error("Failed to authorize", l),
																r(l));
														}
													},
												}),
											{
												onCloseCallback() {
													r(new Error("Authorization cancelled"));
												},
											}
										)
									);
								},
								isAuthorized: () => !!t().token,
							}),
							{
								name: "decor-auth",
								getStorage: () => U4,
								partialize: (e) => ({ tokens: e.tokens }),
								onRehydrateStorage: () => (e) => e?.init(),
							}
						)
					)
				));
		});
	async function Ju(e, t) {
		let o = await fetch(e, {
			...t,
			headers: {
				...t?.headers,
				Authorization: `Bearer ${Rr.getState().token}`,
			},
		});
		if (o.ok) return o;
		throw new Error(await o.text());
	}
	var hT,
		yT,
		vT,
		d1,
		ST,
		bT,
		Vu = g(() => {
			"use strict";
			a();
			Nr();
			rl();
			(hT = async (e) => {
				if (e?.length === 0) return {};
				let t = new URL(Ar + "/users");
				return (
					e && e.length !== 0 && t.searchParams.set("ids", JSON.stringify(e)),
					await fetch(t).then((o) => o.json())
				);
			}),
				(yT = async (e = "@me") =>
					Ju(Ar + `/users/${e}/decorations`).then((t) => t.json())),
				(vT = async (e = "@me") =>
					Ju(Ar + `/users/${e}/decoration`).then((t) => t.json())),
				(d1 = async (e, t = "@me") => {
					let o = new FormData();
					return (
						e
							? "hash" in e
								? o.append("hash", e.hash)
								: "file" in e &&
									(o.append("image", e.file), o.append("alt", e.alt ?? "null"))
							: o.append("hash", "null"),
						Ju(Ar + `/users/${t}/decoration`, { method: "PUT", body: o }).then(
							(r) => (e && "file" in e ? r.json() : r.text())
						)
					);
				}),
				(ST = async (e) => {
					await Ju(Ar + `/decorations/${e}`, { method: "DELETE" });
				}),
				(bT = async () =>
					fetch(Ar + "/decorations/presets").then((e) => e.json()));
		});
	function m1(e) {
		return `${e.animated ? "a_" : ""}${e.hash}`;
	}
	function ep(e) {
		return { asset: m1(e), skuId: Pi };
	}
	var tp = g(() => {
		"use strict";
		a();
		Nr();
	});
	function TT(e) {
		let [t, o] = z(e ? (Yn.getState().getAsset(e.id) ?? null) : null);
		return (
			ue(() => {
				let r = Yn.subscribe((i) => {
					if (!e) return;
					let s = i.getAsset(e.id);
					!s || (t !== s && o(s));
				});
				if (e) {
					let { fetch: i } = Yn.getState();
					i(e.id);
				}
				return r;
			}, []),
			t ? { asset: t, skuId: Pi } : null
		);
	}
	var Yn,
		f1 = g(() => {
			"use strict";
			a();
			fr();
			co();
			b();
			Vu();
			Nr();
			Yn = Dt(() =>
				si((e, t) => ({
					usersDecorations: new Map(),
					fetchQueue: new Set(),
					bulkFetch: $t(async () => {
						let { fetchQueue: o, usersDecorations: r } = t();
						if (o.size === 0) return;
						e({ fetchQueue: new Set() });
						let i = [...o],
							s = await hT(i),
							l = new Map(r),
							c = new Date();
						for (let u of i) {
							let p = s[u] ?? null;
							l.set(u, { asset: p, fetchedAt: c });
						}
						e({ usersDecorations: l });
					}),
					async fetch(o, r = !1) {
						let { usersDecorations: i, fetchQueue: s, bulkFetch: l } = t(),
							{ fetchedAt: c } = i.get(o) ?? {};
						(c && !r && Date.now() - c.getTime() < p1) ||
							(e({ fetchQueue: new Set(s).add(o) }), l());
					},
					async fetchMany(o) {
						if (!o.length) return;
						let { usersDecorations: r, fetchQueue: i, bulkFetch: s } = t(),
							l = new Set(i),
							c = Date.now();
						for (let u of o) {
							let { fetchedAt: p } = r.get(u) ?? {};
							(p && c - p.getTime() < p1) || l.add(u);
						}
						e({ fetchQueue: l }), s();
					},
					get(o) {
						return t().usersDecorations.get(o);
					},
					getAsset(o) {
						return t().usersDecorations.get(o)?.asset;
					},
					has(o) {
						return t().usersDecorations.has(o);
					},
					set(o, r) {
						let { usersDecorations: i } = t(),
							s = new Map(i);
						s.set(o, { asset: r, fetchedAt: new Date() }),
							e({ usersDecorations: s });
					},
				}))
			);
		});
	var xn,
		gs = g(() => {
			"use strict";
			a();
			co();
			b();
			Vu();
			tp();
			f1();
			xn = Dt(() =>
				si((e, t) => ({
					decorations: [],
					selectedDecoration: null,
					async fetch() {
						let o = await yT(),
							r = await vT();
						e({ decorations: o, selectedDecoration: r });
					},
					async create(o) {
						let r = await d1(o);
						e({ decorations: [...t().decorations, r] });
					},
					async delete(o) {
						let r = typeof o == "object" ? o.hash : o;
						await ST(r);
						let { selectedDecoration: i, decorations: s } = t(),
							l = {
								decorations: s.filter((c) => c.hash !== r),
								selectedDecoration: i?.hash === r ? null : i,
							};
						e(l);
					},
					async select(o) {
						t().selectedDecoration !== o &&
							(e({ selectedDecoration: o }),
							d1(o),
							Yn.getState().set(D.getCurrentUser().id, o ? m1(o) : null));
					},
					clear: () => e({ decorations: [], selectedDecoration: null }),
				}))
			);
		});
	var Ue,
		hs,
		ys,
		xT,
		kr = g(() => {
			"use strict";
			a();
			tt();
			U();
			(Ue = be("vc-decor-")),
				(hs = C("modalFooterShopButton")),
				(ys = Rn(".COLLECTIBLES_SHOP_FULLSCREEN&&")),
				(xT = Rn("stickerInspected]:"));
		});
	var il,
		wT,
		op,
		g1,
		PT,
		Mi = g(() => {
			"use strict";
			a();
			ct();
			U();
			b();
			(il = Be),
				(wT = (e) => (il = e)),
				(op = ae(".shopPreviewBanner", (e) => q.memo(e))),
				(g1 = Be),
				(PT = (e) => (g1 = e));
		});
	function h1(e) {
		return n(
			il,
			{ ...e, isSelected: !1 },
			n(Ia, null),
			n(
				Z,
				{ variant: "text-xs/normal", color: "header-primary" },
				Se.Messages.CREATE
			)
		);
	}
	var MT = g(() => {
		"use strict";
		a();
		yt();
		b();
		Mi();
	});
	function y1(e) {
		return n(
			il,
			{ ...e },
			n(Ng, null),
			n(
				Z,
				{ variant: "text-xs/normal", color: "header-primary" },
				Se.Messages.NONE
			)
		);
	}
	var IT = g(() => {
		"use strict";
		a();
		yt();
		b();
		Mi();
	});
	function v1({ decoration: e }) {
		let { delete: t } = xn();
		return n(
			E.Menu,
			{
				navId: Ue("decoration-context-menu"),
				onClose: Qt.closeContextMenu,
				"aria-label": "Decoration Options",
			},
			n(E.MenuItem, {
				id: Ue("decoration-context-menu-copy-hash"),
				label: "Copy Decoration Hash",
				icon: Ta,
				action: () => Gt.copy(e.hash),
			}),
			e.authorId === D.getCurrentUser().id &&
				n(E.MenuItem, {
					id: Ue("decoration-context-menu-delete"),
					label: "Delete Decoration",
					color: "danger",
					icon: _n,
					action: () =>
						Tt.show({
							title: "Delete Decoration",
							body: `Are you sure you want to delete ${e.alt}?`,
							confirmText: "Delete",
							confirmColor: Ue("danger-btn"),
							cancelText: "Cancel",
							onConfirm() {
								t(e);
							},
						}),
				})
		);
	}
	var CT = g(() => {
		"use strict";
		a();
		yt();
		b();
		gs();
		kr();
	});
	function S1(e) {
		let { decoration: t } = e;
		return n(g1, {
			...e,
			onContextMenu: (o) => {
				Qt.openContextMenu(o, () => n(v1, { decoration: t }));
			},
			avatarDecoration: ep(t),
		});
	}
	var AT = g(() => {
		"use strict";
		a();
		b();
		tp();
		Mi();
		CT();
	});
	function b1({ renderItem: e, getItemKey: t, itemKeyPrefix: o, items: r }) {
		return n(
			"div",
			{ className: Ue("sectioned-grid-list-grid") },
			r.map((i) => n(q.Fragment, { key: `${o ? `${o}-` : ""}${t(i)}` }, e(i)))
		);
	}
	var NT = g(() => {
		"use strict";
		a();
		b();
		kr();
	});
	function T1(e) {
		return n(
			"div",
			{ className: H(Ue("sectioned-grid-list-container"), $4.thin) },
			e.sections.map((t) =>
				n(
					"div",
					{
						key: e.getSectionKey(t),
						className: Ue("sectioned-grid-list-section"),
					},
					e.renderSectionHeader(t),
					n(b1, {
						renderItem: e.renderItem,
						getItemKey: e.getItemKey,
						itemKeyPrefix: e.getSectionKey(t),
						items: t.items,
					})
				)
			)
		);
	}
	var $4,
		RT = g(() => {
			"use strict";
			a();
			me();
			U();
			kr();
			NT();
			$4 = C("managedReactiveScroller");
		});
	function W4(e) {
		let [t, o] = z(null);
		return (
			ue(() => {
				if (!e) return;
				let r = URL.createObjectURL(e);
				return (
					o(r),
					() => {
						URL.revokeObjectURL(r), o(null);
					}
				);
			}, [e]),
			t
		);
	}
	function j4(e) {
		let [t, o] = z(""),
			[r, i] = z(null),
			[s, l] = z(!1),
			[c, u] = z(null);
		ue(() => {
			c && u(null);
		}, [r]);
		let { create: p } = xn(),
			m = W4(r),
			y = dt(() => (m ? { asset: m, skuId: Xu } : null), [m]);
		return n(
			Te,
			{ ...e, size: "medium", className: hs.modal },
			n(
				Ee,
				{ separator: !1, className: Ue("modal-header") },
				n(
					Z,
					{
						color: "header-primary",
						variant: "heading-lg/semibold",
						tag: "h1",
						style: { flexGrow: 1 },
					},
					"Create Decoration"
				),
				n(rt, { onClick: e.onClose })
			),
			n(
				Ae,
				{
					className: Ue("create-decoration-modal-content"),
					scrollbarType: "none",
				},
				n(
					R,
					null,
					n(
						H4,
						{ messageType: z4.WARNING },
						"Make sure your decoration does not violate ",
						n(
							He,
							{
								href: "https://github.com/decor-discord/.github/blob/main/GUIDELINES.md",
							},
							"the guidelines"
						),
						" before submitting it."
					),
					n(
						"div",
						{ className: Ue("create-decoration-modal-form-preview-container") },
						n(
							"div",
							{ className: Ue("create-decoration-modal-form") },
							c !== null &&
								n(
									Z,
									{ color: "text-danger", variant: "text-xs/normal" },
									c.message
								),
							n(
								S.FormSection,
								{ title: "File" },
								n(G4, {
									filename: r?.name,
									placeholder: "Choose a file",
									buttonText: "Browse",
									filters: [
										{ name: "Decoration file", extensions: ["png", "apng"] },
									],
									onFileSelect: i,
								}),
								n(
									S.FormText,
									{ type: "description", className: G.top8 },
									"File should be APNG or PNG."
								)
							),
							n(
								S.FormSection,
								{ title: "Name" },
								n(mt, { placeholder: "Companion Cube", value: t, onChange: o }),
								n(
									S.FormText,
									{ type: "description", className: G.top8 },
									"This name will be used when referring to this decoration."
								)
							)
						),
						n(
							"div",
							null,
							n(op, { avatarDecorationOverride: y, user: D.getCurrentUser() })
						)
					),
					n(
						S.FormText,
						{ type: "description", className: G.bottom16 },
						n("br", null),
						"You can receive updates on your decoration's review by joining ",
						n(
							He,
							{
								href: `https://discord.gg/${nl}`,
								onClick: async (v) => {
									v.preventDefault(),
										le.getGuild(fs)
											? (mn(),
												_.dispatch({ type: "LAYER_POP_ALL" }),
												en.transitionToGuild(fs))
											: (await ai(nl)) &&
												(mn(), _.dispatch({ type: "LAYER_POP_ALL" }));
								},
							},
							"Decor's Discord server"
						),
						"."
					)
				)
			),
			n(
				ht,
				{ className: Ue("modal-footer") },
				n(
					M,
					{
						onClick: () => {
							l(!0),
								p({ alt: t, file: r })
									.then(e.onClose)
									.catch((v) => {
										l(!1), u(v);
									});
						},
						disabled: !r || !t,
						submitting: s,
					},
					"Submit for Review"
				),
				n(
					M,
					{ onClick: e.onClose, color: M.Colors.PRIMARY, look: M.Looks.LINK },
					"Cancel"
				)
			)
		);
	}
	var G4,
		H4,
		z4,
		np,
		x1 = g(() => {
			"use strict";
			a();
			re();
			no();
			it();
			Ye();
			Ke();
			U();
			b();
			Nr();
			gs();
			kr();
			Mi();
			(G4 = ae("fileUploadInput,")),
				({ HelpMessage: H4, HelpMessageTypes: z4 } = zt(
					'POSITIVE=3]="POSITIVE',
					{
						HelpMessage: ne.componentByCode(".iconDiv,", "messageType"),
						HelpMessageTypes: ne.byProps("POSITIVE", "WARNING"),
					}
				));
			np = () =>
				Promise.all([ys(), xT()]).then(() => ge((e) => n(j4, { ...e })));
		});
	function q4(e) {
		return n(
			Te,
			{ ...e, size: "small", className: hs.modal },
			n(
				Ee,
				{ separator: !1, className: Ue("modal-header") },
				n(
					Z,
					{
						color: "header-primary",
						variant: "heading-lg/semibold",
						tag: "h1",
						style: { flexGrow: 1 },
					},
					"Hold on"
				),
				n(rt, { onClick: e.onClose })
			),
			n(
				Ae,
				{ scrollbarType: "none" },
				n(
					S.FormText,
					null,
					"By submitting a decoration, you agree to ",
					n(
						He,
						{
							href: "https://github.com/decor-discord/.github/blob/main/GUIDELINES.md",
						},
						"the guidelines"
					),
					". Not reading these guidelines may get your account suspended from creating more decorations in the future."
				)
			),
			n(
				ht,
				{ className: Ue("modal-footer") },
				n(
					M,
					{
						onClick: () => {
							(vs.store.agreedToGuidelines = !0), e.onClose(), np();
						},
					},
					"Continue"
				),
				n(
					M,
					{ onClick: e.onClose, color: M.Colors.PRIMARY, look: M.Looks.LINK },
					"Go Back"
				)
			)
		);
	}
	var kT,
		DT = g(() => {
			"use strict";
			a();
			no();
			Ke();
			b();
			rp();
			kr();
			x1();
			kT = () => ys().then(() => ge((e) => n(q4, { ...e })));
		});
	function Y4() {
		let [e, t] = z([]);
		return (
			ue(() => {
				bT().then(t);
			}, []),
			e
		);
	}
	function Z4({ section: e }) {
		let t = typeof e.subtitle < "u",
			o = typeof e.authorIds < "u",
			[r, i] = z([]);
		return (
			ue(() => {
				(async () => {
					if (!!e.authorIds)
						for (let s of e.authorIds) {
							let l = D.getUser(s) ?? (await oo.getUser(s));
							i((c) => [...c, l]);
						}
				})();
			}, [e.authorIds]),
			n(
				"div",
				null,
				n(
					pe,
					null,
					n(S.FormTitle, { style: { flexGrow: 1 } }, e.title),
					o &&
						n(K4, {
							users: r,
							guildId: void 0,
							renderIcon: !1,
							max: 5,
							showDefaultAvatarsForNullUsers: !0,
							size: 16,
							showUserPopout: !0,
							className: G.bottom8,
						})
				),
				t &&
					n(
						S.FormText,
						{ type: "description", className: G.bottom8 },
						e.subtitle
					)
			)
		);
	}
	function Q4(e) {
		let [t, o] = z(void 0),
			r = typeof t < "u",
			i = t != null ? ep(t) : t,
			{ decorations: s, selectedDecoration: l, fetch: c, select: u } = xn();
		ue(() => {
			c();
		}, []);
		let p = r ? t : l,
			m = typeof p?.authorId < "u",
			y = s.some((k) => k.reviewed === !1),
			v = Y4(),
			N = v.flatMap((k) => k.decorations),
			w = v.find((k) => k.id === p?.presetId),
			I = typeof w < "u",
			L = [
				{
					title: "Your Decorations",
					subtitle:
						"You can delete your own decorations by right clicking on them.",
					sectionKey: "ownDecorations",
					items: [
						"none",
						...s.filter((k) => !N.some(($) => $.hash === k.hash)),
						"create",
					],
				},
				...v.map((k) => ({
					title: k.name,
					subtitle: k.description || void 0,
					sectionKey: `preset-${k.id}`,
					items: k.decorations,
					authorIds: k.authorIds,
				})),
			];
		return n(
			Te,
			{ ...e, size: "dynamic", className: hs.modal },
			n(
				Ee,
				{ separator: !1, className: Ue("modal-header") },
				n(
					Z,
					{
						color: "header-primary",
						variant: "heading-lg/semibold",
						tag: "h1",
						style: { flexGrow: 1 },
					},
					"Change Decoration"
				),
				n(rt, { onClick: e.onClose })
			),
			n(
				Ae,
				{
					className: Ue("change-decoration-modal-content"),
					scrollbarType: "none",
				},
				n(
					R,
					null,
					n(T1, {
						renderItem: (k) => {
							if (typeof k == "string")
								switch (k) {
									case "none":
										return n(y1, {
											className: Ue("change-decoration-modal-decoration"),
											isSelected: p === null,
											onSelect: () => o(null),
										});
									case "create":
										return n(
											te,
											{
												text: "You already have a decoration pending review",
												shouldShow: y,
											},
											($) =>
												n(h1, {
													className: Ue("change-decoration-modal-decoration"),
													...$,
													onSelect: y
														? () => {}
														: vs.store.agreedToGuidelines
															? np
															: kT,
												})
										);
								}
							else
								return n(
									te,
									{ text: "Pending review", shouldShow: k.reviewed === !1 },
									($) =>
										n(S1, {
											...$,
											className: Ue("change-decoration-modal-decoration"),
											onSelect: k.reviewed !== !1 ? () => o(k) : () => {},
											isSelected: p?.hash === k.hash,
											decoration: k,
										})
								);
						},
						getItemKey: (k) => (typeof k == "string" ? k : k.hash),
						getSectionKey: (k) => k.sectionKey,
						renderSectionHeader: (k) => n(Z4, { section: k }),
						sections: L,
					}),
					n(
						"div",
						{ className: Ue("change-decoration-modal-preview") },
						n(op, { avatarDecorationOverride: i, user: D.getCurrentUser() }),
						I &&
							n(
								S.FormTitle,
								{ className: "" },
								"Part of the ",
								w.name,
								" Preset"
							),
						typeof p == "object" &&
							n(
								Z,
								{ variant: "text-sm/semibold", color: "header-primary" },
								p?.alt
							),
						m &&
							n(
								Z,
								{ key: `createdBy-${p.authorId}` },
								"Created by ",
								Ce.parse(`<@${p.authorId}>`)
							),
						I && n(M, { onClick: () => Kt(w.id) }, "Copy Preset ID")
					)
				)
			),
			n(
				ht,
				{
					className: H(
						Ue("change-decoration-modal-footer", Ue("modal-footer"))
					),
				},
				n(
					"div",
					{ className: Ue("change-decoration-modal-footer-btn-container") },
					n(
						M,
						{
							onClick: () => {
								u(t).then(e.onClose);
							},
							disabled: !r,
						},
						"Apply"
					),
					n(
						M,
						{ onClick: e.onClose, color: M.Colors.PRIMARY, look: M.Looks.LINK },
						"Cancel"
					)
				),
				n(
					"div",
					{ className: Ue("change-decoration-modal-footer-btn-container") },
					n(
						M,
						{
							onClick: () =>
								Tt.show({
									title: "Log Out",
									body: "Are you sure you want to log out of Decor?",
									confirmText: "Log Out",
									confirmColor: Ue("danger-btn"),
									cancelText: "Cancel",
									onConfirm() {
										Rr.getState().remove(D.getCurrentUser().id), e.onClose();
									},
								}),
							color: M.Colors.PRIMARY,
							look: M.Looks.LINK,
						},
						"Log Out"
					),
					n(
						te,
						{
							text: "Join Decor's Discord Server for notifications on your decoration's review, and when new presets are released",
						},
						(k) =>
							n(
								M,
								{
									...k,
									onClick: async () => {
										le.getGuild(fs)
											? (e.onClose(),
												_.dispatch({ type: "LAYER_POP_ALL" }),
												en.transitionToGuild(fs))
											: (await ai(nl)) &&
												(mn(), _.dispatch({ type: "LAYER_POP_ALL" }));
									},
									color: M.Colors.PRIMARY,
									look: M.Looks.LINK,
								},
								"Discord Server"
							)
					)
				)
			)
		);
	}
	var K4,
		w1,
		LT = g(() => {
			"use strict";
			a();
			re();
			kt();
			it();
			Ye();
			me();
			Ke();
			U();
			b();
			Vu();
			Nr();
			rl();
			gs();
			tp();
			rp();
			kr();
			Mi();
			MT();
			IT();
			AT();
			RT();
			x1();
			DT();
			K4 = ae("defaultRenderUser", "showDefaultAvatarsForNullUsers");
			w1 = () => ys().then(() => ge((e) => n(Q4, { ...e })));
		});
	function sl({ hideTitle: e = !1, hideDivider: t = !1, noMargin: o = !1 }) {
		let r = Rr(),
			{ selectedDecoration: i, select: s, fetch: l } = xn();
		return (
			ue(() => {
				r.isAuthorized() && l();
			}, [r.token]),
			n(
				X4,
				{
					title: !e && "Decor",
					hasBackground: !0,
					hideDivider: t,
					className: o && Ue("section-remove-margin"),
				},
				n(
					pe,
					null,
					n(
						M,
						{
							onClick: () => {
								r.isAuthorized()
									? w1()
									: r
											.authorize()
											.then(w1)
											.catch(() => {});
							},
							size: M.Sizes.SMALL,
						},
						"Change Decoration"
					),
					i &&
						r.isAuthorized() &&
						n(
							M,
							{
								onClick: () => s(null),
								color: M.Colors.PRIMARY,
								size: M.Sizes.SMALL,
								look: M.Looks.LINK,
							},
							"Remove Decoration"
						)
				)
			)
		);
	}
	var X4,
		P1 = g(() => {
			"use strict";
			a();
			kt();
			U();
			b();
			rl();
			gs();
			kr();
			LT();
			X4 = ae(".customizationSectionBackground");
		});
	var vs,
		rp = g(() => {
			"use strict";
			a();
			F();
			no();
			Ye();
			me();
			Ke();
			T();
			b();
			P1();
			vs = x({
				changeDecoration: {
					type: 6,
					description: "Change your avatar decoration",
					component() {
						return Vencord.Plugins.plugins.Decor.started
							? n(
									"div",
									null,
									n(sl, { hideTitle: !0, hideDivider: !0, noMargin: !0 }),
									n(
										S.FormText,
										{ type: "description", className: H(G.top8, G.bottom8) },
										"You can also access Decor decorations from the ",
										n(
											He,
											{
												href: "/settings/profile-customization",
												onClick: (e) => {
													e.preventDefault(),
														mn(),
														_.dispatch({
															type: "USER_SETTINGS_MODAL_SET_SECTION",
															section: "Profile Customization",
														});
												},
											},
											"Profiles"
										),
										" page."
									)
								)
							: n(
									S.FormText,
									null,
									"Enable Decor and restart your client to change your avatar decoration."
								);
					},
				},
				agreedToGuidelines: {
					type: 3,
					description: "Agreed to guidelines",
					hidden: !0,
					default: !1,
				},
			});
		});
	var ip,
		ET = g(() => {
			"use strict";
			a();
			dT();
			re();
			P();
			T();
			b();
			Nr();
			rl();
			gs();
			f1();
			rp();
			Mi();
			P1();
			ip = h({
				name: "Decor",
				description:
					"Create and use your own custom avatar decorations, or pick your favorite from the presets.",
				authors: [d.FieryFlames],
				patches: [
					{
						find: "getAvatarDecorationURL:",
						replacement: {
							match: /(?<=function \i\(\i\){)(?=let{avatarDecoration)/,
							replace:
								"const vcDecorDecoration=$self.getDecorAvatarDecorationURL(arguments[0]);if(vcDecorDecoration)return vcDecorDecoration;",
						},
					},
					{
						find: "DefaultCustomizationSections",
						replacement: {
							match: /(?<=USER_SETTINGS_AVATAR_DECORATION},"decoration"\),)/,
							replace: "$self.DecorSection(),",
						},
					},
					{
						find: ".decorationGridItem,",
						replacement: [
							{
								match: /(?<==)\i=>{let{children.{20,100}decorationGridItem/,
								replace: "$self.DecorationGridItem=$&",
							},
							{
								match:
									/(?<==)\i=>{let{user:\i,avatarDecoration.{300,600}decorationGridItemChurned/,
								replace: "$self.DecorationGridDecoration=$&",
							},
							{
								match:
									/(?<=\.\i\.PREMIUM_PURCHASE&&\i)(?<=avatarDecoration:(\i).+?)/,
								replace: "||$1.skuId===$self.SKU_ID",
							},
						],
					},
					{
						find: "isAvatarDecorationAnimating:",
						group: !0,
						replacement: [
							{
								match: /(?<=TryItOut:\i,guildId:\i}\),)(?<=user:(\i).+?)/,
								replace:
									"vcDecorAvatarDecoration=$self.useUserDecorAvatarDecoration($1),",
							},
							{
								match:
									/(?<={avatarDecoration:).{1,20}?(?=,)(?<=avatarDecorationOverride:(\i).+?)/,
								replace: "$1??vcDecorAvatarDecoration??($&)",
							},
							{
								match: /(?<=size:\i}\),\[)/,
								replace: "vcDecorAvatarDecoration,",
							},
						],
					},
					{
						find: "renderAvatarWithPopout(){",
						replacement: [
							{
								match:
									/(?<=\i\)\({avatarDecoration:)(\i)(?=,)(?<=currentUser:(\i).+?)/,
								replace: "$self.useUserDecorAvatarDecoration($1)??$&",
							},
						],
					},
				],
				settings: vs,
				flux: {
					CONNECTION_OPEN: () => {
						Rr.getState().init(),
							xn.getState().clear(),
							Yn.getState().fetch(D.getCurrentUser().id, !0);
					},
					USER_PROFILE_MODAL_OPEN: (e) => {
						Yn.getState().fetch(e.userId, !0);
					},
				},
				set DecorationGridItem(e) {
					wT(e);
				},
				set DecorationGridDecoration(e) {
					PT(e);
				},
				SKU_ID: Pi,
				useUserDecorAvatarDecoration: TT,
				async start() {
					Yn.getState().fetch(D.getCurrentUser().id, !0);
				},
				getDecorAvatarDecorationURL({ avatarDecoration: e, canAnimate: t }) {
					if (e?.skuId === Pi) {
						let o = e.asset.split("_");
						return (
							e.asset.startsWith("a_") && !t && o.shift(),
							`${fT}/${o.join("_")}.png`
						);
					} else if (e?.skuId === Xu) return e.asset;
				},
				DecorSection: R.wrap(sl),
			});
		});
	var sp,
		OT = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			rn("DisableCallIdle", "DisableDMCallIdle");
			sp = h({
				name: "DisableCallIdle",
				description:
					"Disables automatically getting kicked from a DM voice call after 3 minutes and being moved to an AFK voice channel.",
				authors: [d.Nuckyz],
				patches: [
					{
						find: ".Messages.BOT_CALL_IDLE_DISCONNECT",
						replacement: {
							match: /,?(?=\i\(this,"idleTimeout",new \i\.\i\))/,
							replace: ";return;",
						},
					},
					{
						find: "handleIdleUpdate(){",
						replacement: { match: /(?<=_initialize\(\){)/, replace: "return;" },
					},
				],
			});
		});
	var ap,
		FT = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			ap = h({
				name: "DontRoundMyTimestamps",
				authors: [d.Lexi],
				description:
					"Always rounds relative timestamps down, so 7.6y becomes 7y instead of 8y",
				start() {
					vr.relativeTimeRounding(Math.floor);
				},
				stop() {
					vr.relativeTimeRounding(Math.round);
				},
			});
		});
	function M1(e) {
		return e.t === "Emoji"
			? `${location.protocol}//${window.GLOBAL_ENV.CDN_HOST}/emojis/${e.id}.${e.isAnimated ? "gif" : "png"}?size=4096&lossless=true`
			: `${window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT}/stickers/${e.id}.${e3[e.format_type]}?size=4096&lossless=true`;
	}
	async function _T(e) {
		let t = J4.getStickerById(e);
		if (t) return t;
		let { body: o } = await Pt.get({ url: bt.Endpoints.STICKER(e) });
		return _.dispatch({ type: "STICKER_FETCH_SUCCESS", sticker: o }), o;
	}
	async function t3(e, t) {
		let o = new FormData();
		o.append("name", t.name),
			o.append("tags", t.tags),
			o.append("description", t.description),
			o.append("file", await BT(M1(t)));
		let { body: r } = await Pt.post({
			url: bt.Endpoints.GUILD_STICKER_PACKS(e),
			body: o,
		});
		_.dispatch({
			type: "GUILD_STICKERS_CREATE_SUCCESS",
			guildId: e,
			sticker: { ...r, user: D.getCurrentUser() },
		});
	}
	async function o3(e, t) {
		let o = await BT(M1(t)),
			r = await new Promise((i) => {
				let s = new FileReader();
				(s.onload = () => i(s.result)), s.readAsDataURL(o);
			});
		return V4({ guildId: e, name: t.name.split("~")[0], image: r });
	}
	function n3(e) {
		let t = D.getCurrentUser().id;
		return Object.values(le.getGuilds())
			.filter((o) => {
				if (
					!(
						o.ownerId === t ||
						(qe.getGuildPermissions({ id: o.id }) &
							we.CREATE_GUILD_EXPRESSIONS) ===
							we.CREATE_GUILD_EXPRESSIONS
					)
				)
					return !1;
				if (e.t === "Sticker") return !0;
				let { isAnimated: i } = e,
					s = o.getMaxEmojiSlots(),
					{ emojis: l } = dn.getGuilds()[o.id],
					c = 0;
				for (let u of l) u.animated === i && !u.managed && c++;
				return c < s;
			})
			.sort((o, r) => o.name.localeCompare(r.name));
	}
	async function BT(e) {
		let t = await fetch(e);
		if (!t.ok) throw new Error(`Failed to fetch ${e} - ${t.status}`);
		return t.blob();
	}
	async function r3(e, t) {
		try {
			t.t === "Sticker" ? await t3(e, t) : await o3(e, t),
				X.show({
					message: `Successfully cloned ${t.name} to ${le.getGuild(e)?.name ?? "your server"}!`,
					type: X.Type.SUCCESS,
					id: X.genId(),
				});
		} catch (o) {
			let r = "Something went wrong (check console!)";
			try {
				r = JSON.parse(o.text).message;
			} catch {}
			new V("EmoteCloner").error("Failed to clone", t.name, "to", e, o),
				X.show({
					message: "Failed to clone: " + r,
					type: X.Type.FAILURE,
					id: X.genId(),
				});
		}
	}
	function a3({ data: e }) {
		let [t, o] = q.useState(!1),
			[r, i] = q.useState(e.name),
			[s, l] = q.useReducer((u) => u + 1, 0),
			c = q.useMemo(() => n3(e), [e.id, s]);
		return n(
			f,
			null,
			n(S.FormTitle, { className: G.top20 }, "Custom Name"),
			n(Sa, {
				value: r,
				onChange: (u) => {
					(e.name = u), i(u);
				},
				validate: (u) =>
					(e.t === "Emoji" && u.length > 2 && u.length < 32 && s3.test(u)) ||
					(e.t === "Sticker" && u.length > 2 && u.length < 30) ||
					"Name must be between 2 and 32 characters and only contain alphanumeric characters",
			}),
			n(
				"div",
				{
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: "1em",
						padding: "1em 0.5em",
						justifyContent: "center",
						alignItems: "center",
					},
				},
				c.map((u) =>
					n(te, { text: u.name }, ({ onMouseLeave: p, onMouseEnter: m }) =>
						n(
							"div",
							{
								onMouseLeave: p,
								onMouseEnter: m,
								role: "button",
								"aria-label": "Clone to " + u.name,
								"aria-disabled": t,
								style: {
									borderRadius: "50%",
									backgroundColor: "var(--background-secondary)",
									display: "inline-flex",
									justifyContent: "center",
									alignItems: "center",
									width: "4em",
									height: "4em",
									cursor: t ? "not-allowed" : "pointer",
									filter: t ? "brightness(50%)" : "none",
								},
								onClick: t
									? void 0
									: async () => {
											o(!0),
												r3(u.id, e).finally(() => {
													l(), o(!1);
												});
										},
							},
							u.icon
								? n("img", {
										"aria-hidden": !0,
										style: {
											borderRadius: "50%",
											width: "100%",
											height: "100%",
										},
										src: u.getIconURL(512, !0),
										alt: u.name,
									})
								: n(
										S.FormText,
										{
											style: {
												fontSize: i3(u.acronym),
												width: "100%",
												overflow: "hidden",
												whiteSpace: "nowrap",
												textAlign: "center",
												cursor: t ? "not-allowed" : "pointer",
											},
										},
										u.acronym
									)
						)
					)
				)
			)
		);
	}
	function lp(e, t) {
		return n(E.MenuItem, {
			id: "emote-cloner",
			key: "emote-cloner",
			label: `Clone ${e}`,
			action: () =>
				pa(async () => {
					let o = await t(),
						r = { t: e, ...o },
						i = M1(r);
					return (s) =>
						n(
							Te,
							{ ...s },
							n(
								Ee,
								null,
								n("img", {
									role: "presentation",
									"aria-hidden": !0,
									src: i,
									alt: "",
									height: 24,
									width: 24,
									style: { marginRight: "0.5em" },
								}),
								n(S.FormText, null, "Clone ", r.name)
							),
							n(Ae, null, n(a3, { data: r }))
						);
				}),
		});
	}
	function UT(e) {
		return new URL(e).pathname.endsWith(".gif");
	}
	var J4,
		V4,
		e3,
		i3,
		s3,
		l3,
		c3,
		cp,
		$T = g(() => {
			"use strict";
			a();
			ho();
			xc();
			P();
			De();
			Ye();
			Ke();
			T();
			U();
			b();
			(J4 = K("StickersStore")),
				(V4 = fe(".GUILD_EMOJIS(", "EMOJI_UPLOAD_START")),
				(e3 = [, "png", "png", "json", "gif"]);
			(i3 = (e) => [20, 20, 18, 18, 16, 14, 12][e.length] ?? 4),
				(s3 = /^\w+$/i);
			(l3 = (e, t) => {
				let {
					favoriteableId: o,
					itemHref: r,
					itemSrc: i,
					favoriteableType: s,
				} = t ?? {};
				if (!o) return;
				let l = (() => {
					switch (s) {
						case "emoji":
							let c = t.message.content.match(
									RegExp(
										`<a?:(\\w+)(?:~\\d+)?:${o}>|https://cdn\\.discordapp\\.com/emojis/${o}\\.`
									)
								),
								u = t.message.reactions.find((y) => y.emoji.id === o);
							if (!c && !u) return;
							let p = (c && c[1]) ?? u?.emoji.name ?? "FakeNitroEmoji";
							return lp("Emoji", () => ({
								id: o,
								name: p,
								isAnimated: UT(r ?? i),
							}));
						case "sticker":
							return t.message.stickerItems.find((y) => y.id === o)
								?.format_type === 3
								? void 0
								: lp("Sticker", () => _T(o));
					}
				})();
				l && Ve("copy-link", e)?.push(l);
			}),
				(c3 = (e, t) => {
					let { id: o, name: r, type: i } = t?.target?.dataset ?? {};
					if (!!o)
						if (i === "emoji" && r) {
							let s = t.target.firstChild;
							e.push(
								lp("Emoji", () => ({
									id: o,
									name: r,
									isAnimated: s && UT(s.src),
								}))
							);
						} else
							i === "sticker" &&
								!t.target.className?.includes("lottieCanvas") &&
								e.push(lp("Sticker", () => _T(o)));
				}),
				(cp = h({
					name: "EmoteCloner",
					description:
						"Allows you to clone Emotes & Stickers to your own server (right click them)",
					tags: ["StickerCloner"],
					authors: [d.Ven, d.Nuckyz],
					contextMenus: { message: l3, "expression-picker": c3 },
				}));
		});
	var I1,
		GT = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/experiments/hideBugReport.css",
				{
					name: "src/plugins/experiments/hideBugReport.css",
					source: `#staff-help-popout-staff-help-bug-reporter {
    display: none;
}
`,
					classNames: {},
					dom: null,
				}
			);
			I1 = "src/plugins/experiments/hideBugReport.css";
		});
	var up,
		HT,
		pp,
		zT = g(() => {
			"use strict";
			a();
			F();
			tt();
			re();
			gi();
			P();
			Ye();
			T();
			U();
			b();
			GT();
			(up = C("key", "combo")),
				(HT = x({
					toolbarDevMenu: {
						type: 3,
						description:
							"Change the Help (?) toolbar button (top right in chat) to Discord's developer menu",
						default: !1,
						restartNeeded: !0,
					},
				})),
				(pp = h({
					name: "Experiments",
					description:
						"Enable Access to Experiments & other dev-only features in Discord!",
					authors: [d.Megu, d.Ven, d.Nickyux, d.BanTheNons, d.Nuckyz],
					settings: HT,
					patches: [
						{
							find: "Object.defineProperties(this,{isDeveloper",
							replacement: {
								match: /(?<={isDeveloper:\{[^}]+?,get:\(\)=>)\i/,
								replace: "true",
							},
						},
						{
							find: 'type:"user",revision',
							replacement: {
								match: /!(\i)&&"CONNECTION_OPEN".+?;/g,
								replace: "$1=!0;",
							},
						},
						{
							find: 'H1,title:"Experiments"',
							replacement: {
								match: 'title:"Experiments",children:[',
								replace: "$&$self.WarningCard(),",
							},
						},
						{
							find: "toolbar:function",
							replacement: { match: /\i\.isStaff\(\)/, replace: "true" },
							predicate: () => HT.store.toolbarDevMenu,
						},
						{
							find: "useCanFavoriteChannel",
							replacement: {
								match: /\i\.isDM\(\)\|\|\i\.isThread\(\)/,
								replace: "false",
							},
						},
					],
					start: () => fo(I1),
					stop: () => _o(I1),
					settingsAboutComponent: () => {
						let e = navigator.platform.includes("Mac"),
							t = e ? "cmd" : "ctrl",
							o = e ? "opt" : "alt";
						return n(
							q.Fragment,
							null,
							n(S.FormTitle, { tag: "h3" }, "More Information"),
							n(
								S.FormText,
								{ variant: "text-md/normal" },
								"You can open Discord's DevTools via ",
								" ",
								n(
									"div",
									{ className: up.combo, style: { display: "inline-flex" } },
									n("kbd", { className: up.key }, t),
									" +",
									" ",
									n("kbd", { className: up.key }, o),
									" +",
									" ",
									n("kbd", { className: up.key }, "O"),
									" "
								)
							)
						);
					},
					WarningCard: R.wrap(
						() =>
							n(
								Fo,
								{ id: "vc-experiments-warning-card", className: G.bottom16 },
								n(S.FormTitle, { tag: "h2" }, "Hold on!!"),
								n(
									S.FormText,
									null,
									"Experiments are unreleased Discord features. They might not work, or even break your client or get your account disabled."
								),
								n(
									S.FormText,
									{ className: G.top8 },
									"Only use experiments if you know what you're doing. Vencord is not responsible for any damage caused by enabling experiments. If you don't know what an experiment does, ignore it. Do not ask us what experiments do either, we probably don't know."
								),
								n(
									S.FormText,
									{ className: G.top8 },
									'No, you cannot use server-side features like checking the "Send to Client" box.'
								)
							),
						{ noop: !0 }
					),
				}));
		});
	var dp,
		WT = g(() => {
			"use strict";
			a();
			P();
			T();
			dp = h({
				name: "F8Break",
				description:
					"Pause the client when you press F8 with DevTools (+ breakpoints) open.",
				authors: [d.lewisakura],
				start() {
					window.addEventListener("keydown", this.event);
				},
				stop() {
					window.removeEventListener("keydown", this.event);
				},
				event(e) {
					if (e.code === "F8") debugger;
				},
			});
		});
	var qT = z0((OV, jT) => {
		"use strict";
		a();
		var Zn = jT.exports;
		(function e(t, o, r) {
			function i(c, u) {
				if (!o[c]) {
					if (!t[c]) {
						var p = typeof Hs == "function" && Hs;
						if (!u && p) return p(c, !0);
						if (s) return s(c, !0);
						throw new Error("Cannot find module '" + c + "'");
					}
					var m = (o[c] = { exports: {} });
					t[c][0].call(
						m.exports,
						function (y) {
							var v = t[c][1][y];
							return i(v || y);
						},
						m,
						m.exports,
						e,
						t,
						o,
						r
					);
				}
				return o[c].exports;
			}
			for (var s = typeof Hs == "function" && Hs, l = 0; l < r.length; l++)
				i(r[l]);
			return i;
		})(
			{
				1: [
					function (e, t, o) {
						(function (r, i) {
							var s, l;
							(s = this),
								(l = function () {
									"use strict";
									function c(O) {
										return typeof O == "function";
									}
									var u = Array.isArray
											? Array.isArray
											: function (O) {
													return (
														Object.prototype.toString.call(O) ===
														"[object Array]"
													);
												},
										p = 0,
										m = void 0,
										y = void 0,
										v = function (O, Y) {
											($[p] = O),
												($[p + 1] = Y),
												(p += 2) === 2 && (y ? y(j) : ie());
										},
										N = typeof window < "u" ? window : void 0,
										w = N || {},
										I = w.MutationObserver || w.WebKitMutationObserver,
										A =
											typeof Zn > "u" &&
											r !== void 0 &&
											{}.toString.call(r) === "[object process]",
										L =
											typeof Uint8ClampedArray < "u" &&
											typeof importScripts < "u" &&
											typeof MessageChannel < "u";
									function k() {
										var O = setTimeout;
										return function () {
											return O(j, 1);
										};
									}
									var $ = new Array(1e3);
									function j() {
										for (var O = 0; O < p; O += 2)
											(0, $[O])($[O + 1]), ($[O] = void 0), ($[O + 1] = void 0);
										p = 0;
									}
									var Q,
										ee,
										J,
										B,
										ie = void 0;
									function se(O, Y) {
										var de = this,
											ce = new this.constructor(Qe);
										ce[ve] === void 0 && dr(ce);
										var Me = de._state;
										if (Me) {
											var Xe = arguments[Me - 1];
											v(function () {
												return Ft(Me, ce, Xe, de._result);
											});
										} else To(de, ce, O, Y);
										return ce;
									}
									function Fe(O) {
										if (O && typeof O == "object" && O.constructor === this)
											return O;
										var Y = new this(Qe);
										return Pe(Y, O), Y;
									}
									ie = A
										? function () {
												return r.nextTick(j);
											}
										: I
											? ((ee = 0),
												(J = new I(j)),
												(B = document.createTextNode("")),
												J.observe(B, { characterData: !0 }),
												function () {
													B.data = ee = ++ee % 2;
												})
											: L
												? (((Q = new MessageChannel()).port1.onmessage = j),
													function () {
														return Q.port2.postMessage(0);
													})
												: N === void 0 && typeof e == "function"
													? (function () {
															try {
																var O =
																	Function("return this")().require("vertx");
																return (m = O.runOnLoop || O.runOnContext) !==
																	void 0
																	? function () {
																			m(j);
																		}
																	: k();
															} catch {
																return k();
															}
														})()
													: k();
									var ve = Math.random().toString(36).substring(2);
									function Qe() {}
									var Ne = void 0,
										Re = 1,
										$e = 2;
									function Ge(O, Y, de) {
										v(function (ce) {
											var Me = !1,
												Xe = (function (Ut, Mn, zr, hN) {
													try {
														Ut.call(Mn, zr, hN);
													} catch (yN) {
														return yN;
													}
												})(
													de,
													Y,
													function (Ut) {
														Me ||
															((Me = !0), Y !== Ut ? Pe(ce, Ut) : ut(ce, Ut));
													},
													function (Ut) {
														Me || ((Me = !0), je(ce, Ut));
													},
													ce._label
												);
											!Me && Xe && ((Me = !0), je(ce, Xe));
										}, O);
									}
									function ke(O, Y, de) {
										Y.constructor === O.constructor &&
										de === se &&
										Y.constructor.resolve === Fe
											? (function (ce, Me) {
													Me._state === Re
														? ut(ce, Me._result)
														: Me._state === $e
															? je(ce, Me._result)
															: To(
																	Me,
																	void 0,
																	function (Xe) {
																		return Pe(ce, Xe);
																	},
																	function (Xe) {
																		return je(ce, Xe);
																	}
																);
												})(O, Y)
											: de === void 0
												? ut(O, Y)
												: c(de)
													? Ge(O, Y, de)
													: ut(O, Y);
									}
									function Pe(O, Y) {
										if (O === Y)
											je(
												O,
												new TypeError(
													"You cannot resolve a promise with itself"
												)
											);
										else if (
											(function (ce) {
												var Me = typeof ce;
												return (
													ce !== null && (Me == "object" || Me == "function")
												);
											})(Y)
										) {
											var de = void 0;
											try {
												de = Y.then;
											} catch (ce) {
												return void je(O, ce);
											}
											ke(O, Y, de);
										} else ut(O, Y);
									}
									function Ot(O) {
										O._onerror && O._onerror(O._result), Bt(O);
									}
									function ut(O, Y) {
										O._state === Ne &&
											((O._result = Y),
											(O._state = Re),
											O._subscribers.length !== 0 && v(Bt, O));
									}
									function je(O, Y) {
										O._state === Ne &&
											((O._state = $e), (O._result = Y), v(Ot, O));
									}
									function To(O, Y, de, ce) {
										var Me = O._subscribers,
											Xe = Me.length;
										(O._onerror = null),
											(Me[Xe] = Y),
											(Me[Xe + Re] = de),
											(Me[Xe + $e] = ce),
											Xe === 0 && O._state && v(Bt, O);
									}
									function Bt(O) {
										var Y = O._subscribers,
											de = O._state;
										if (Y.length !== 0) {
											for (
												var ce = void 0, Me = void 0, Xe = O._result, Ut = 0;
												Ut < Y.length;
												Ut += 3
											)
												(ce = Y[Ut]),
													(Me = Y[Ut + de]),
													ce ? Ft(de, ce, Me, Xe) : Me(Xe);
											O._subscribers.length = 0;
										}
									}
									function Ft(O, Y, de, ce) {
										var Me = c(de),
											Xe = void 0,
											Ut = void 0,
											Mn = !0;
										if (Me) {
											try {
												Xe = de(ce);
											} catch (zr) {
												(Mn = !1), (Ut = zr);
											}
											if (Y === Xe)
												return void je(
													Y,
													new TypeError(
														"A promises callback cannot return that same promise."
													)
												);
										} else Xe = ce;
										Y._state !== Ne ||
											(Me && Mn
												? Pe(Y, Xe)
												: Mn === !1
													? je(Y, Ut)
													: O === Re
														? ut(Y, Xe)
														: O === $e && je(Y, Xe));
									}
									var $r = 0;
									function dr(O) {
										(O[ve] = $r++),
											(O._state = void 0),
											(O._result = void 0),
											(O._subscribers = []);
									}
									var mr =
										((Gr.prototype._enumerate = function (O) {
											for (var Y = 0; this._state === Ne && Y < O.length; Y++)
												this._eachEntry(O[Y], Y);
										}),
										(Gr.prototype._eachEntry = function (O, Y) {
											var de = this._instanceConstructor,
												ce = de.resolve;
											if (ce === Fe) {
												var Me = void 0,
													Xe = void 0,
													Ut = !1;
												try {
													Me = O.then;
												} catch (zr) {
													(Ut = !0), (Xe = zr);
												}
												if (Me === se && O._state !== Ne)
													this._settledAt(O._state, Y, O._result);
												else if (typeof Me != "function")
													this._remaining--, (this._result[Y] = O);
												else if (de === Jt) {
													var Mn = new de(Qe);
													Ut ? je(Mn, Xe) : ke(Mn, O, Me),
														this._willSettleAt(Mn, Y);
												} else
													this._willSettleAt(
														new de(function (zr) {
															return zr(O);
														}),
														Y
													);
											} else this._willSettleAt(ce(O), Y);
										}),
										(Gr.prototype._settledAt = function (O, Y, de) {
											var ce = this.promise;
											ce._state === Ne &&
												(this._remaining--,
												O === $e ? je(ce, de) : (this._result[Y] = de)),
												this._remaining === 0 && ut(ce, this._result);
										}),
										(Gr.prototype._willSettleAt = function (O, Y) {
											var de = this;
											To(
												O,
												void 0,
												function (ce) {
													return de._settledAt(Re, Y, ce);
												},
												function (ce) {
													return de._settledAt($e, Y, ce);
												}
											);
										}),
										Gr);
									function Gr(O, Y) {
										(this._instanceConstructor = O),
											(this.promise = new O(Qe)),
											this.promise[ve] || dr(this.promise),
											u(Y)
												? ((this.length = Y.length),
													(this._remaining = Y.length),
													(this._result = new Array(this.length)),
													this.length === 0
														? ut(this.promise, this._result)
														: ((this.length = this.length || 0),
															this._enumerate(Y),
															this._remaining === 0 &&
																ut(this.promise, this._result)))
												: je(
														this.promise,
														new Error("Array Methods must be provided an Array")
													);
									}
									var Jt =
										((Hr.prototype.catch = function (O) {
											return this.then(null, O);
										}),
										(Hr.prototype.finally = function (O) {
											var Y = this.constructor;
											return c(O)
												? this.then(
														function (de) {
															return Y.resolve(O()).then(function () {
																return de;
															});
														},
														function (de) {
															return Y.resolve(O()).then(function () {
																throw de;
															});
														}
													)
												: this.then(O, O);
										}),
										Hr);
									function Hr(O) {
										(this[ve] = $r++),
											(this._result = this._state = void 0),
											(this._subscribers = []),
											Qe !== O &&
												(typeof O != "function" &&
													(function () {
														throw new TypeError(
															"You must pass a resolver function as the first argument to the promise constructor"
														);
													})(),
												this instanceof Hr
													? (function (Y, de) {
															try {
																de(
																	function (ce) {
																		Pe(Y, ce);
																	},
																	function (ce) {
																		je(Y, ce);
																	}
																);
															} catch (ce) {
																je(Y, ce);
															}
														})(this, O)
													: (function () {
															throw new TypeError(
																"Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function."
															);
														})());
									}
									return (
										(Jt.prototype.then = se),
										(Jt.all = function (O) {
											return new mr(this, O).promise;
										}),
										(Jt.race = function (O) {
											var Y = this;
											return u(O)
												? new Y(function (de, ce) {
														for (var Me = O.length, Xe = 0; Xe < Me; Xe++)
															Y.resolve(O[Xe]).then(de, ce);
													})
												: new Y(function (de, ce) {
														return ce(
															new TypeError("You must pass an array to race.")
														);
													});
										}),
										(Jt.resolve = Fe),
										(Jt.reject = function (O) {
											var Y = new this(Qe);
											return je(Y, O), Y;
										}),
										(Jt._setScheduler = function (O) {
											y = O;
										}),
										(Jt._setAsap = function (O) {
											v = O;
										}),
										(Jt._asap = v),
										(Jt.polyfill = function () {
											var O = void 0;
											if (i !== void 0) O = i;
											else if (typeof Zn < "u") O = Zn;
											else
												try {
													O = Function("return this")();
												} catch {
													throw new Error(
														"polyfill failed because global object is unavailable in this environment"
													);
												}
											var Y = O.Promise;
											if (Y) {
												var de = null;
												try {
													de = Object.prototype.toString.call(Y.resolve());
												} catch {}
												if (de === "[object Promise]" && !Y.cast) return;
											}
											O.Promise = Jt;
										}),
										(Jt.Promise = Jt)
									);
								}),
								typeof o == "object" && t !== void 0
									? (t.exports = l())
									: typeof define == "function" && define.amd
										? define(l)
										: (s.ES6Promise = l());
						}).call(
							this,
							e("VCmEsw"),
							typeof Zn < "u" ? Zn : typeof window < "u" ? window : {}
						);
					},
					{ VCmEsw: 2 },
				],
				2: [
					function (e, t, o) {
						var r = (t.exports = {});
						function i() {}
						(r.nextTick = (function () {
							var s = typeof window < "u" && window.setImmediate,
								l =
									typeof window < "u" &&
									window.postMessage &&
									window.addEventListener;
							if (s)
								return function (u) {
									return window.setImmediate(u);
								};
							if (l) {
								var c = [];
								return (
									window.addEventListener(
										"message",
										function (u) {
											var p = u.source;
											(p !== window && p !== null) ||
												u.data !== "process-tick" ||
												(u.stopPropagation(), 0 < c.length && c.shift()());
										},
										!0
									),
									function (u) {
										c.push(u), window.postMessage("process-tick", "*");
									}
								);
							}
							return function (u) {
								setTimeout(u, 0);
							};
						})()),
							(r.title = "browser"),
							(r.browser = !0),
							(r.env = {}),
							(r.argv = []),
							(r.on = i),
							(r.addListener = i),
							(r.once = i),
							(r.off = i),
							(r.removeListener = i),
							(r.removeAllListeners = i),
							(r.emit = i),
							(r.binding = function (s) {
								throw new Error("process.binding is not supported");
							}),
							(r.cwd = function () {
								return "/";
							}),
							(r.chdir = function (s) {
								throw new Error("process.chdir is not supported");
							});
					},
					{},
				],
				3: [
					function (e, t, o) {
						"use strict";
						t.exports = function () {
							(this.width = 0),
								(this.height = 0),
								(this.numPlays = 0),
								(this.playTime = 0),
								(this.frames = []),
								(this.play = function () {
									c || u || (this.rewind(), (c = !0), requestAnimationFrame(m));
								}),
								(this.rewind = function () {
									(s = i = 0), (l = null), (u = c = !1);
								}),
								(this.addContext = function (v) {
									if (0 < p.length) {
										var N = p[0].getImageData(0, 0, this.width, this.height);
										v.putImageData(N, 0, 0);
									}
									p.push(v), (v._apng_animation = this);
								}),
								(this.removeContext = function (v) {
									var N = p.indexOf(v);
									N !== -1 &&
										(p.splice(N, 1),
										p.length === 0 && this.rewind(),
										"_apng_animation" in v && delete v._apng_animation);
								}),
								(this.isPlayed = function () {
									return c;
								}),
								(this.isFinished = function () {
									return u;
								});
							var r = this,
								i = 0,
								s = 0,
								l = null,
								c = !1,
								u = !1,
								p = [],
								m = function (v) {
									for (; c && i <= v; ) y(v);
									c && requestAnimationFrame(m);
								},
								y = function (v) {
									var N = s++ % r.frames.length,
										w = r.frames[N];
									if (r.numPlays == 0 || s / r.frames.length <= r.numPlays) {
										for (
											N == 0 &&
												(p.forEach(function (I) {
													I.clearRect(0, 0, r.width, r.height);
												}),
												(l = null),
												w.disposeOp == 2 && (w.disposeOp = 1)),
												l && l.disposeOp == 1
													? p.forEach(function (I) {
															I.clearRect(l.left, l.top, l.width, l.height);
														})
													: l &&
														l.disposeOp == 2 &&
														p.forEach(function (I) {
															I.putImageData(l.iData, l.left, l.top);
														}),
												(l = w).iData = null,
												l.disposeOp == 2 &&
													(l.iData = p[0].getImageData(
														w.left,
														w.top,
														w.width,
														w.height
													)),
												w.blendOp == 0 &&
													p.forEach(function (I) {
														I.clearRect(w.left, w.top, w.width, w.height);
													}),
												p.forEach(function (I) {
													I.drawImage(w.img, w.left, w.top);
												}),
												i == 0 && (i = v);
											v > i + r.playTime;

										)
											i += r.playTime;
										i += w.delay;
									} else u = !(c = !1);
								};
						};
					},
					{},
				],
				4: [
					function (e, t, o) {
						"use strict";
						for (var r = new Uint32Array(256), i = 0; i < 256; i++) {
							for (var s = i, l = 0; l < 8; l++)
								s = 1 & s ? 3988292384 ^ (s >>> 1) : s >>> 1;
							r[i] = s;
						}
						t.exports = function (c, u, p) {
							for (
								var m = -1, y = (u = u || 0), v = u + (p = p || c.length - u);
								y < v;
								y++
							)
								m = (m >>> 8) ^ r[255 & (m ^ c[y])];
							return -1 ^ m;
						};
					},
					{},
				],
				5: [
					function (e, t, o) {
						(function (r) {
							"use strict";
							var i = e("./support-test"),
								s = e("./parser"),
								l = e("./loader"),
								c = (r.APNG = {});
							(c.checkNativeFeatures = i.checkNativeFeatures),
								(c.ifNeeded = i.ifNeeded),
								(c.parseBuffer = function (p) {
									return s(p);
								});
							var u = {};
							(c.parseURL = function (p) {
								return p in u || (u[p] = l(p).then(s)), u[p];
							}),
								(c.animateContext = function (p, m) {
									return c.parseURL(p).then(function (y) {
										return y.addContext(m), y.play(), y;
									});
								}),
								(c.animateImage = function (p) {
									return (
										p.setAttribute("data-is-apng", "progress"),
										c.parseURL(p.src).then(
											function (m) {
												p.setAttribute("data-is-apng", "yes");
												var y = document.createElement("canvas");
												(y.width = m.width),
													(y.height = m.height),
													Array.prototype.slice
														.call(p.attributes)
														.forEach(function (L) {
															[
																"alt",
																"src",
																"usemap",
																"ismap",
																"data-is-apng",
																"width",
																"height",
															].indexOf(L.nodeName) == -1 &&
																y.setAttributeNode(L.cloneNode(!1));
														}),
													y.setAttribute("data-apng-src", p.src),
													p.alt != "" &&
														y.appendChild(document.createTextNode(p.alt));
												var v = "",
													N = "",
													w = 0,
													I = "";
												p.style.width != "" && p.style.width != "auto"
													? (v = p.style.width)
													: p.hasAttribute("width") &&
														(v = p.getAttribute("width") + "px"),
													p.style.height != "" && p.style.height != "auto"
														? (N = p.style.height)
														: p.hasAttribute("height") &&
															(N = p.getAttribute("height") + "px"),
													v != "" &&
														N == "" &&
														((w = parseFloat(v)),
														(I = v.match(/\D+$/)[0]),
														(N = Math.round((y.height * w) / y.width) + I)),
													N != "" &&
														v == "" &&
														((w = parseFloat(N)),
														(I = N.match(/\D+$/)[0]),
														(v = Math.round((y.width * w) / y.height) + I)),
													(y.style.width = v),
													(y.style.height = N);
												var A = p.parentNode;
												A.insertBefore(y, p),
													A.removeChild(p),
													m.addContext(y.getContext("2d")),
													m.play();
											},
											function () {
												p.setAttribute("data-is-apng", "no");
											}
										)
									);
								}),
								(c.releaseCanvas = function (p) {
									var m = p.getContext("2d");
									"_apng_animation" in m && m._apng_animation.removeContext(m);
								});
						}).call(
							this,
							typeof Zn < "u" ? Zn : typeof window < "u" ? window : {}
						);
					},
					{ "./loader": 6, "./parser": 7, "./support-test": 8 },
				],
				6: [
					function (e, t, o) {
						"use strict";
						var r = r || e("es6-promise").Promise;
						t.exports = function (i) {
							return new r(function (s, l) {
								var c = new XMLHttpRequest();
								c.open("GET", i),
									(c.responseType = "arraybuffer"),
									(c.onload = function () {
										this.status == 200 ? s(this.response) : l(this);
									}),
									c.send();
							});
						};
					},
					{ "es6-promise": 1 },
				],
				7: [
					function (e, t, o) {
						"use strict";
						var r = r || e("es6-promise").Promise,
							i = e("./animation"),
							s = e("./crc32"),
							l = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
						t.exports = function (I) {
							var A = new Uint8Array(I);
							return new r(function (L, k) {
								for (var $ = 0; $ < l.length; $++)
									if (l[$] != A[$])
										return void k("Not a PNG file (invalid file signature)");
								var j = !1;
								if (
									(c(A, function (Ge) {
										return Ge != "acTL" || !(j = !0);
									}),
									j)
								) {
									var Q = [],
										ee = [],
										J = null,
										B = null,
										ie = new i();
									if (
										(c(A, function (Ge, ke, Pe, Ot) {
											switch (Ge) {
												case "IHDR":
													(J = ke.subarray(Pe + 8, Pe + 8 + Ot)),
														(ie.width = u(ke, Pe + 8)),
														(ie.height = u(ke, Pe + 12));
													break;
												case "acTL":
													ie.numPlays = u(ke, Pe + 8 + 4);
													break;
												case "fcTL":
													B && ie.frames.push(B),
														((B = {}).width = u(ke, Pe + 8 + 4)),
														(B.height = u(ke, Pe + 8 + 8)),
														(B.left = u(ke, Pe + 8 + 12)),
														(B.top = u(ke, Pe + 8 + 16));
													var ut = p(ke, Pe + 8 + 20),
														je = p(ke, Pe + 8 + 22);
													je == 0 && (je = 100),
														(B.delay = (1e3 * ut) / je),
														B.delay <= 10 && (B.delay = 100),
														(ie.playTime += B.delay),
														(B.disposeOp = m(ke, Pe + 8 + 24)),
														(B.blendOp = m(ke, Pe + 8 + 25)),
														(B.dataParts = []);
													break;
												case "fdAT":
													B &&
														B.dataParts.push(
															ke.subarray(Pe + 8 + 4, Pe + 8 + Ot)
														);
													break;
												case "IDAT":
													B &&
														B.dataParts.push(ke.subarray(Pe + 8, Pe + 8 + Ot));
													break;
												case "IEND":
													ee.push(y(ke, Pe, 12 + Ot));
													break;
												default:
													Q.push(y(ke, Pe, 12 + Ot));
											}
										}),
										B && ie.frames.push(B),
										ie.frames.length != 0)
									)
										for (
											var se = 0, Fe = new Blob(Q), ve = new Blob(ee), Qe = 0;
											Qe < ie.frames.length;
											Qe++
										) {
											B = ie.frames[Qe];
											var Ne = [];
											Ne.push(l),
												J.set(N(B.width), 0),
												J.set(N(B.height), 4),
												Ne.push(w("IHDR", J)),
												Ne.push(Fe);
											for (var Re = 0; Re < B.dataParts.length; Re++)
												Ne.push(w("IDAT", B.dataParts[Re]));
											Ne.push(ve);
											var $e = URL.createObjectURL(
												new Blob(Ne, { type: "image/png" })
											);
											delete B.dataParts,
												(Ne = null),
												(B.img = document.createElement("img")),
												(B.img.onload = function () {
													URL.revokeObjectURL(this.src),
														++se == ie.frames.length && L(ie);
												}),
												(B.img.onerror = function () {
													k("Image creation error");
												}),
												(B.img.src = $e);
										}
									else k("Not an animated PNG");
								} else k("Not an animated PNG");
							});
						};
						var c = function (I, A) {
								var L = 8;
								do {
									var k = u(I, L),
										$ = v(I, L + 4, 4),
										j = A($, I, L, k);
									L += 12 + k;
								} while (j !== !1 && $ != "IEND" && L < I.length);
							},
							u = function (I, A) {
								var L = 0;
								L += (I[0 + A] << 24) >>> 0;
								for (var k = 1; k < 4; k++) L += I[k + A] << (8 * (3 - k));
								return L;
							},
							p = function (I, A) {
								for (var L = 0, k = 0; k < 2; k++)
									L += I[k + A] << (8 * (1 - k));
								return L;
							},
							m = function (I, A) {
								return I[A];
							},
							y = function (I, A, L) {
								var k = new Uint8Array(L);
								return k.set(I.subarray(A, A + L)), k;
							},
							v = function (I, A, L) {
								var k = Array.prototype.slice.call(I.subarray(A, A + L));
								return String.fromCharCode.apply(String, k);
							},
							N = function (I) {
								return [
									(I >>> 24) & 255,
									(I >>> 16) & 255,
									(I >>> 8) & 255,
									255 & I,
								];
							},
							w = function (I, A) {
								var L = I.length + A.length,
									k = new Uint8Array(new ArrayBuffer(L + 8));
								k.set(N(A.length), 0),
									k.set(
										(function (j) {
											for (var Q = [], ee = 0; ee < j.length; ee++)
												Q.push(j.charCodeAt(ee));
											return Q;
										})(I),
										4
									),
									k.set(A, 8);
								var $ = s(k, 4, L);
								return k.set(N($), L + 4), k;
							};
					},
					{ "./animation": 3, "./crc32": 4, "es6-promise": 1 },
				],
				8: [
					function (e, t, o) {
						(function (r) {
							"use strict";
							var i,
								s,
								l = l || e("es6-promise").Promise,
								c =
									((i = function (u) {
										var p = document.createElement("canvas"),
											m = {
												TypedArrays: "ArrayBuffer" in r,
												BlobURLs: "URL" in r,
												requestAnimationFrame: "requestAnimationFrame" in r,
												pageProtocol:
													location.protocol == "http:" ||
													location.protocol == "https:",
												canvas:
													"getContext" in document.createElement("canvas"),
												APNG: !1,
											};
										if (m.canvas) {
											var y = new Image();
											(y.onload = function () {
												var v = p.getContext("2d");
												v.drawImage(y, 0, 0),
													(m.APNG = v.getImageData(0, 0, 1, 1).data[3] === 0),
													u(m);
											}),
												(y.src =
													"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAABAAAAAcMq2TYAAAANSURBVAiZY2BgYPgPAAEEAQB9ssjfAAAAGmZjVEwAAAAAAAAAAQAAAAEAAAAAAAAAAAD6A+gBAbNU+2sAAAARZmRBVAAAAAEImWNgYGBgAAAABQAB6MzFdgAAAABJRU5ErkJggg==");
										} else u(m);
									}),
									(s = null),
									function (u) {
										return (s = s || new l(i)), u && s.then(u), s;
									});
							t.exports = {
								checkNativeFeatures: c,
								ifNeeded: function (u) {
									return (
										u === void 0 && (u = !1),
										c().then(function (p) {
											if (p.APNG && !u) reject();
											else {
												var m = !0;
												for (var y in p)
													p.hasOwnProperty(y) && y != "APNG" && (m = m && p[y]);
											}
										})
									);
								},
							};
						}).call(
							this,
							typeof Zn < "u" ? Zn : typeof window < "u" ? window : {}
						);
					},
					{ "es6-promise": 1 },
				],
			},
			{},
			[5]
		);
	});
	var KT,
		YT = g(() => {
			"use strict";
			a();
			co();
			KT = pn(() => qT().APNG);
		});
	var k1 = z0((R1) => {
		a();
		var JT = Object.defineProperty,
			u3 = (e) => JT(e, "__esModule", { value: !0 }),
			p3 = (e, t) => {
				for (var o in t) JT(e, o, { get: t[o], enumerable: !0 });
			};
		u3(R1);
		p3(R1, {
			GIFEncoder: () => ix,
			applyPalette: () => b3,
			default: () => R3,
			nearestColor: () => P3,
			nearestColorIndex: () => nx,
			nearestColorIndexWithDistance: () => rx,
			prequantize: () => S3,
			quantize: () => y3,
			snapColorsToPalette: () => w3,
		});
		var d3 = {
			signature: "GIF",
			version: "89a",
			trailer: 59,
			extensionIntroducer: 33,
			applicationExtensionLabel: 255,
			graphicControlExtensionLabel: 249,
			imageSeparator: 44,
			signatureSize: 3,
			versionSize: 3,
			globalColorTableFlagMask: 128,
			colorResolutionMask: 112,
			sortFlagMask: 8,
			globalColorTableSizeMask: 7,
			applicationIdentifierSize: 8,
			applicationAuthCodeSize: 3,
			disposalMethodMask: 28,
			userInputFlagMask: 2,
			transparentColorFlagMask: 1,
			localColorTableFlagMask: 128,
			interlaceFlagMask: 64,
			idSortFlagMask: 32,
			localColorTableSizeMask: 7,
		};
		function VT(e = 256) {
			let t = 0,
				o = new Uint8Array(e);
			return {
				get buffer() {
					return o.buffer;
				},
				reset() {
					t = 0;
				},
				bytesView() {
					return o.subarray(0, t);
				},
				bytes() {
					return o.slice(0, t);
				},
				writeByte(i) {
					r(t + 1), (o[t] = i), t++;
				},
				writeBytes(i, s = 0, l = i.length) {
					r(t + l);
					for (let c = 0; c < l; c++) o[t++] = i[c + s];
				},
				writeBytesView(i, s = 0, l = i.byteLength) {
					r(t + l), o.set(i.subarray(s, s + l), t), (t += l);
				},
			};
			function r(i) {
				var s = o.length;
				if (s >= i) return;
				var l = 1024 * 1024;
				(i = Math.max(i, (s * (s < l ? 2 : 1.125)) >>> 0)),
					s != 0 && (i = Math.max(i, 256));
				let c = o;
				(o = new Uint8Array(i)), t > 0 && o.set(c.subarray(0, t), 0);
			}
		}
		var C1 = 12,
			ZT = 5003,
			m3 = [
				0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383,
				32767, 65535,
			];
		function f3(
			e,
			t,
			o,
			r,
			i = VT(512),
			s = new Uint8Array(256),
			l = new Int32Array(ZT),
			c = new Int32Array(ZT)
		) {
			let u = l.length,
				p = Math.max(2, r);
			s.fill(0), c.fill(0), l.fill(-1);
			let m = 0,
				y = 0,
				v = p + 1,
				N = v,
				w = !1,
				I = N,
				A = (1 << I) - 1,
				L = 1 << (v - 1),
				k = L + 1,
				$ = L + 2,
				j = 0,
				Q = o[0],
				ee = 0;
			for (let ie = u; ie < 65536; ie *= 2) ++ee;
			(ee = 8 - ee), i.writeByte(p), B(L);
			let J = o.length;
			for (let ie = 1; ie < J; ie++) {
				e: {
					let se = o[ie],
						Fe = (se << C1) + Q,
						ve = (se << ee) ^ Q;
					if (l[ve] === Fe) {
						Q = c[ve];
						break e;
					}
					let Qe = ve === 0 ? 1 : u - ve;
					for (; l[ve] >= 0; )
						if (((ve -= Qe), ve < 0 && (ve += u), l[ve] === Fe)) {
							Q = c[ve];
							break e;
						}
					B(Q),
						(Q = se),
						$ < 1 << C1
							? ((c[ve] = $++), (l[ve] = Fe))
							: (l.fill(-1), ($ = L + 2), (w = !0), B(L));
				}
			}
			return B(Q), B(k), i.writeByte(0), i.bytesView();
			function B(ie) {
				for (m &= m3[y], y > 0 ? (m |= ie << y) : (m = ie), y += I; y >= 8; )
					(s[j++] = m & 255),
						j >= 254 && (i.writeByte(j), i.writeBytesView(s, 0, j), (j = 0)),
						(m >>= 8),
						(y -= 8);
				if (
					(($ > A || w) &&
						(w
							? ((I = N), (A = (1 << I) - 1), (w = !1))
							: (++I, (A = I === C1 ? 1 << I : (1 << I) - 1))),
					ie == k)
				) {
					for (; y > 0; )
						(s[j++] = m & 255),
							j >= 254 && (i.writeByte(j), i.writeBytesView(s, 0, j), (j = 0)),
							(m >>= 8),
							(y -= 8);
					j > 0 && (i.writeByte(j), i.writeBytesView(s, 0, j), (j = 0));
				}
			}
		}
		var g3 = f3;
		function ex(e, t, o) {
			return ((e << 8) & 63488) | ((t << 2) & 992) | (o >> 3);
		}
		function tx(e, t, o, r) {
			return (e >> 4) | (t & 240) | ((o & 240) << 4) | ((r & 240) << 8);
		}
		function ox(e, t, o) {
			return ((e >> 4) << 8) | (t & 240) | (o >> 4);
		}
		function mp(e, t, o) {
			return e < t ? t : e > o ? o : e;
		}
		function al(e) {
			return e * e;
		}
		function QT(e, t, o) {
			var r = 0,
				i = 1e100;
			let s = e[t],
				l = s.cnt,
				c = s.ac,
				u = s.rc,
				p = s.gc,
				m = s.bc;
			for (var y = s.fw; y != 0; y = e[y].fw) {
				let N = e[y],
					w = N.cnt,
					I = (l * w) / (l + w);
				if (!(I >= i)) {
					var v = 0;
					(o && ((v += I * al(N.ac - c)), v >= i)) ||
						((v += I * al(N.rc - u)),
						!(v >= i) &&
							((v += I * al(N.gc - p)),
							!(v >= i) &&
								((v += I * al(N.bc - m)), !(v >= i) && ((i = v), (r = y)))));
				}
			}
			(s.err = i), (s.nn = r);
		}
		function A1() {
			return {
				ac: 0,
				rc: 0,
				gc: 0,
				bc: 0,
				cnt: 0,
				nn: 0,
				fw: 0,
				bk: 0,
				tm: 0,
				mtm: 0,
				err: 0,
			};
		}
		function h3(e, t) {
			let o = t === "rgb444" ? 4096 : 65536,
				r = new Array(o),
				i = e.length;
			if (t === "rgba4444")
				for (let s = 0; s < i; ++s) {
					let l = e[s],
						c = (l >> 24) & 255,
						u = (l >> 16) & 255,
						p = (l >> 8) & 255,
						m = l & 255,
						y = tx(m, p, u, c),
						v = y in r ? r[y] : (r[y] = A1());
					(v.rc += m), (v.gc += p), (v.bc += u), (v.ac += c), v.cnt++;
				}
			else if (t === "rgb444")
				for (let s = 0; s < i; ++s) {
					let l = e[s],
						c = (l >> 16) & 255,
						u = (l >> 8) & 255,
						p = l & 255,
						m = ox(p, u, c),
						y = m in r ? r[m] : (r[m] = A1());
					(y.rc += p), (y.gc += u), (y.bc += c), y.cnt++;
				}
			else
				for (let s = 0; s < i; ++s) {
					let l = e[s],
						c = (l >> 16) & 255,
						u = (l >> 8) & 255,
						p = l & 255,
						m = ex(p, u, c),
						y = m in r ? r[m] : (r[m] = A1());
					(y.rc += p), (y.gc += u), (y.bc += c), y.cnt++;
				}
			return r;
		}
		function y3(e, t, o = {}) {
			let {
				format: r = "rgb565",
				clearAlpha: i = !0,
				clearAlphaColor: s = 0,
				clearAlphaThreshold: l = 0,
				oneBitAlpha: c = !1,
			} = o;
			if (!e || !e.buffer)
				throw new Error("quantize() expected RGBA Uint8Array data");
			if (!(e instanceof Uint8Array) && !(e instanceof Uint8ClampedArray))
				throw new Error("quantize() expected RGBA Uint8Array data");
			let u = new Uint32Array(e.buffer),
				p = o.useSqrt !== !1,
				m = r === "rgba4444",
				y = h3(u, r),
				v = y.length,
				N = v - 1,
				w = new Uint32Array(v + 1);
			for (var I = 0, L = 0; L < v; ++L) {
				let Re = y[L];
				if (Re != null) {
					var A = 1 / Re.cnt;
					m && (Re.ac *= A),
						(Re.rc *= A),
						(Re.gc *= A),
						(Re.bc *= A),
						(y[I++] = Re);
				}
			}
			al(t) / I < 0.022 && (p = !1);
			for (var L = 0; L < I - 1; ++L)
				(y[L].fw = L + 1),
					(y[L + 1].bk = L),
					p && (y[L].cnt = Math.sqrt(y[L].cnt));
			p && (y[L].cnt = Math.sqrt(y[L].cnt));
			var k, $, j;
			for (L = 0; L < I; ++L) {
				QT(y, L, !1);
				var Q = y[L].err;
				for (
					$ = ++w[0];
					$ > 1 && ((j = $ >> 1), !(y[(k = w[j])].err <= Q));
					$ = j
				)
					w[$] = k;
				w[$] = L;
			}
			var ee = I - t;
			for (L = 0; L < ee; ) {
				for (var J; ; ) {
					var B = w[1];
					if (((J = y[B]), J.tm >= J.mtm && y[J.nn].mtm <= J.tm)) break;
					J.mtm == N ? (B = w[1] = w[w[0]--]) : (QT(y, B, !1), (J.tm = L));
					var Q = y[B].err;
					for (
						$ = 1;
						(j = $ + $) <= w[0] &&
						(j < w[0] && y[w[j]].err > y[w[j + 1]].err && j++,
						!(Q <= y[(k = w[j])].err));
						$ = j
					)
						w[$] = k;
					w[$] = B;
				}
				var ie = y[J.nn],
					se = J.cnt,
					Fe = ie.cnt,
					A = 1 / (se + Fe);
				m && (J.ac = A * (se * J.ac + Fe * ie.ac)),
					(J.rc = A * (se * J.rc + Fe * ie.rc)),
					(J.gc = A * (se * J.gc + Fe * ie.gc)),
					(J.bc = A * (se * J.bc + Fe * ie.bc)),
					(J.cnt += ie.cnt),
					(J.mtm = ++L),
					(y[ie.bk].fw = ie.fw),
					(y[ie.fw].bk = ie.bk),
					(ie.mtm = N);
			}
			let ve = [];
			var Qe = 0;
			for (L = 0; ; ++Qe) {
				let Ne = mp(Math.round(y[L].rc), 0, 255),
					Re = mp(Math.round(y[L].gc), 0, 255),
					$e = mp(Math.round(y[L].bc), 0, 255),
					Ge = 255;
				m &&
					((Ge = mp(Math.round(y[L].ac), 0, 255)),
					c && (Ge = Ge <= (typeof c == "number" ? c : 127) ? 0 : 255),
					i && Ge <= l && ((Ne = Re = $e = s), (Ge = 0)));
				let ke = m ? [Ne, Re, $e, Ge] : [Ne, Re, $e];
				if ((v3(ve, ke) || ve.push(ke), (L = y[L].fw) == 0)) break;
			}
			return ve;
		}
		function v3(e, t) {
			for (let o = 0; o < e.length; o++) {
				let r = e[o],
					i = r[0] === t[0] && r[1] === t[1] && r[2] === t[2],
					s = r.length >= 4 && t.length >= 4 ? r[3] === t[3] : !0;
				if (i && s) return !0;
			}
			return !1;
		}
		function gp(e, t) {
			var o = 0,
				r;
			for (r = 0; r < e.length; r++) {
				let i = e[r] - t[r];
				o += i * i;
			}
			return o;
		}
		function fp(e, t) {
			return t > 1 ? Math.round(e / t) * t : e;
		}
		function S3(
			e,
			{ roundRGB: t = 5, roundAlpha: o = 10, oneBitAlpha: r = null } = {}
		) {
			let i = new Uint32Array(e.buffer);
			for (let s = 0; s < i.length; s++) {
				let l = i[s],
					c = (l >> 24) & 255,
					u = (l >> 16) & 255,
					p = (l >> 8) & 255,
					m = l & 255;
				(c = fp(c, o)),
					r && (c = c <= (typeof r == "number" ? r : 127) ? 0 : 255),
					(m = fp(m, t)),
					(p = fp(p, t)),
					(u = fp(u, t)),
					(i[s] = (c << 24) | (u << 16) | (p << 8) | (m << 0));
			}
		}
		function b3(e, t, o = "rgb565") {
			if (!e || !e.buffer)
				throw new Error("quantize() expected RGBA Uint8Array data");
			if (!(e instanceof Uint8Array) && !(e instanceof Uint8ClampedArray))
				throw new Error("quantize() expected RGBA Uint8Array data");
			if (t.length > 256)
				throw new Error("applyPalette() only works with 256 colors or less");
			let r = new Uint32Array(e.buffer),
				i = r.length,
				s = o === "rgb444" ? 4096 : 65536,
				l = new Uint8Array(i),
				c = new Array(s),
				u = o === "rgba4444";
			if (o === "rgba4444")
				for (let p = 0; p < i; p++) {
					let m = r[p],
						y = (m >> 24) & 255,
						v = (m >> 16) & 255,
						N = (m >> 8) & 255,
						w = m & 255,
						I = tx(w, N, v, y),
						A = I in c ? c[I] : (c[I] = T3(w, N, v, y, t));
					l[p] = A;
				}
			else {
				let p = o === "rgb444" ? ox : ex;
				for (let m = 0; m < i; m++) {
					let y = r[m],
						v = (y >> 16) & 255,
						N = (y >> 8) & 255,
						w = y & 255,
						I = p(w, N, v),
						A = I in c ? c[I] : (c[I] = x3(w, N, v, t));
					l[m] = A;
				}
			}
			return l;
		}
		function T3(e, t, o, r, i) {
			let s = 0,
				l = 1e100;
			for (let c = 0; c < i.length; c++) {
				let u = i[c],
					p = u[3],
					m = Ii(p - r);
				if (m > l) continue;
				let y = u[0];
				if (((m += Ii(y - e)), m > l)) continue;
				let v = u[1];
				if (((m += Ii(v - t)), m > l)) continue;
				let N = u[2];
				(m += Ii(N - o)), !(m > l) && ((l = m), (s = c));
			}
			return s;
		}
		function x3(e, t, o, r) {
			let i = 0,
				s = 1e100;
			for (let l = 0; l < r.length; l++) {
				let c = r[l],
					u = c[0],
					p = Ii(u - e);
				if (p > s) continue;
				let m = c[1];
				if (((p += Ii(m - t)), p > s)) continue;
				let y = c[2];
				(p += Ii(y - o)), !(p > s) && ((s = p), (i = l));
			}
			return i;
		}
		function w3(e, t, o = 5) {
			if (!e.length || !t.length) return;
			let r = e.map((l) => l.slice(0, 3)),
				i = o * o,
				s = e[0].length;
			for (let l = 0; l < t.length; l++) {
				let c = t[l];
				c.length < s
					? (c = [c[0], c[1], c[2], 255])
					: c.length > s
						? (c = c.slice(0, 3))
						: (c = c.slice());
				let u = rx(r, c.slice(0, 3), gp),
					p = u[0],
					m = u[1];
				m > 0 && m <= i && (e[p] = c);
			}
		}
		function Ii(e) {
			return e * e;
		}
		function nx(e, t, o = gp) {
			let r = 1 / 0,
				i = -1;
			for (let s = 0; s < e.length; s++) {
				let l = e[s],
					c = o(t, l);
				c < r && ((r = c), (i = s));
			}
			return i;
		}
		function rx(e, t, o = gp) {
			let r = 1 / 0,
				i = -1;
			for (let s = 0; s < e.length; s++) {
				let l = e[s],
					c = o(t, l);
				c < r && ((r = c), (i = s));
			}
			return [i, r];
		}
		function P3(e, t, o = gp) {
			return e[nx(e, t, o)];
		}
		function ix(e = {}) {
			let { initialCapacity: t = 4096, auto: o = !0 } = e,
				r = VT(t),
				i = 5003,
				s = new Uint8Array(256),
				l = new Int32Array(i),
				c = new Int32Array(i),
				u = !1;
			return {
				reset() {
					r.reset(), (u = !1);
				},
				finish() {
					r.writeByte(d3.trailer);
				},
				bytes() {
					return r.bytes();
				},
				bytesView() {
					return r.bytesView();
				},
				get buffer() {
					return r.buffer;
				},
				get stream() {
					return r;
				},
				writeHeader: p,
				writeFrame(m, y, v, N = {}) {
					let {
							transparent: w = !1,
							transparentIndex: I = 0,
							delay: A = 0,
							palette: L = null,
							repeat: k = 0,
							colorDepth: $ = 8,
							dispose: j = -1,
						} = N,
						Q = !1;
					if (
						(o ? u || ((Q = !0), p(), (u = !0)) : (Q = Boolean(N.first)),
						(y = Math.max(0, Math.floor(y))),
						(v = Math.max(0, Math.floor(v))),
						Q)
					) {
						if (!L)
							throw new Error("First frame must include a { palette } option");
						I3(r, y, v, L, $), XT(r, L), k >= 0 && C3(r, k);
					}
					let ee = Math.round(A / 10);
					M3(r, j, ee, w, I);
					let J = Boolean(L) && !Q;
					A3(r, y, v, J ? L : null), J && XT(r, L), N3(r, m, y, v, $, s, l, c);
				},
			};
			function p() {
				sx(r, "GIF89a");
			}
		}
		function M3(e, t, o, r, i) {
			e.writeByte(33),
				e.writeByte(249),
				e.writeByte(4),
				i < 0 && ((i = 0), (r = !1));
			var s, l;
			r ? ((s = 1), (l = 2)) : ((s = 0), (l = 0)),
				t >= 0 && (l = t & 7),
				(l <<= 2);
			let c = 0;
			e.writeByte(0 | l | c | s), Dr(e, o), e.writeByte(i || 0), e.writeByte(0);
		}
		function I3(e, t, o, r, i = 8) {
			let c = N1(r.length) - 1,
				u = (1 << 7) | ((i - 1) << 4) | (0 << 3) | c,
				p = 0,
				m = 0;
			Dr(e, t), Dr(e, o), e.writeBytes([u, p, m]);
		}
		function C3(e, t) {
			e.writeByte(33),
				e.writeByte(255),
				e.writeByte(11),
				sx(e, "NETSCAPE2.0"),
				e.writeByte(3),
				e.writeByte(1),
				Dr(e, t),
				e.writeByte(0);
		}
		function XT(e, t) {
			let o = 1 << N1(t.length);
			for (let r = 0; r < o; r++) {
				let i = [0, 0, 0];
				r < t.length && (i = t[r]),
					e.writeByte(i[0]),
					e.writeByte(i[1]),
					e.writeByte(i[2]);
			}
		}
		function A3(e, t, o, r) {
			if ((e.writeByte(44), Dr(e, 0), Dr(e, 0), Dr(e, t), Dr(e, o), r)) {
				let l = N1(r.length) - 1;
				e.writeByte(128 | l);
			} else e.writeByte(0);
		}
		function N3(e, t, o, r, i = 8, s, l, c) {
			g3(o, r, t, i, e, s, l, c);
		}
		function Dr(e, t) {
			e.writeByte(t & 255), e.writeByte((t >> 8) & 255);
		}
		function sx(e, t) {
			for (var o = 0; o < t.length; o++) e.writeByte(t.charCodeAt(o));
		}
		function N1(e) {
			return Math.max(Math.ceil(Math.log2(e)), 1);
		}
		var R3 = ix;
	});
	function ux(e, t) {
		let o = t?.fields?.find((i) => i.localName === e);
		return o
			? Object.values(o).find((i) => typeof i == "function")?.()
			: void 0;
	}
	function bp(e, t) {
		let o = oe.getChannel(e);
		return !o || o.isPrivate() ? !0 : qe.can(t, o);
	}
	var Ss,
		Ci,
		hp,
		ax,
		Sp,
		Ai,
		D1,
		k3,
		yp,
		L1,
		E1,
		vp,
		lx,
		ot,
		D3,
		L3,
		cx,
		E3,
		Tp,
		px = g(() => {
			"use strict";
			a();
			Sn();
			F();
			P();
			YT();
			it();
			De();
			T();
			U();
			b();
			(Ss = j0(k1())),
				(Ci = K("StickersStore")),
				(hp = K("UserSettingsProtoStore")),
				(ax = C("readerFactory"));
			(Sp = Nn(() => aa.PreloadedUserSettingsActionCreators)),
				(Ai = Nn(() => ux("appearance", Sp.ProtoClass))),
				(D1 = Nn(() => ux("clientThemeSettings", Ai))),
				(k3 = fe(".getUserIsAdmin(")),
				(yp = `[${3},${4}].includes(fakeNitroIntention)`),
				(L1 = /\/emojis\/(\d+?)\.(png|webp|gif)/),
				(E1 = /\/stickers\/(\d+?)\./),
				(vp = /\/attachments\/\d+?\/\d+?\/(\d+?)\.gif/),
				(lx = /\[.+?\]\((https?:\/\/.+?)\)/),
				(ot = x({
					enableEmojiBypass: {
						description:
							"Allows sending fake emojis (also bypasses missing permission to use custom emojis)",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					emojiSize: {
						description: "Size of the emojis when sending",
						type: 5,
						default: 48,
						markers: [32, 48, 64, 128, 160, 256, 512],
					},
					transformEmojis: {
						description: "Whether to transform fake emojis into real ones",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					enableStickerBypass: {
						description:
							"Allows sending fake stickers (also bypasses missing permission to use stickers)",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					stickerSize: {
						description: "Size of the stickers when sending",
						type: 5,
						default: 160,
						markers: [32, 64, 128, 160, 256, 512],
					},
					transformStickers: {
						description: "Whether to transform fake stickers into real ones",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					transformCompoundSentence: {
						description:
							"Whether to transform fake stickers and emojis in compound sentences (sentences with more content than just the fake emoji or sticker link)",
						type: 3,
						default: !1,
					},
					enableStreamQualityBypass: {
						description: "Allow streaming in nitro quality",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					useHyperLinks: {
						description:
							"Whether to use hyperlinks when sending fake emojis and stickers",
						type: 3,
						default: !0,
					},
					hyperLinkText: {
						description:
							"What text the hyperlink should use. {{NAME}} will be replaced with the emoji/sticker name.",
						type: 0,
						default: "{{NAME}}",
					},
					disableEmbedPermissionCheck: {
						description:
							"Whether to disable the embed permission check when sending fake emojis and stickers",
						type: 3,
						default: !1,
					},
				}));
			(D3 = (e) => bp(e, we.USE_EXTERNAL_EMOJIS)),
				(L3 = (e) => bp(e, we.USE_EXTERNAL_STICKERS)),
				(cx = (e) => bp(e, we.EMBED_LINKS)),
				(E3 = (e) => bp(e, we.ATTACH_FILES)),
				(Tp = h({
					name: "FakeNitro",
					authors: [
						d.Arjix,
						d.D3SOX,
						d.Ven,
						d.fawn,
						d.captain,
						d.Nuckyz,
						d.AutumnVN,
					],
					description:
						"Allows you to stream in nitro quality, send fake emojis/stickers, use client themes and custom Discord notifications.",
					dependencies: ["MessageEventsAPI"],
					settings: ot,
					patches: [
						{
							find: ".PREMIUM_LOCKED;",
							group: !0,
							predicate: () => ot.store.enableEmojiBypass,
							replacement: [
								{
									match: /(?<=\.USE_EXTERNAL_EMOJIS.+?;)(?<=intention:(\i).+?)/,
									replace: (e, t) => `const fakeNitroIntention=${t};`,
								},
								{
									match: /&&!\i&&!\i(?=\)return \i\.\i\.DISALLOW_EXTERNAL;)/,
									replace: (e) => `${e}&&!${yp}`,
								},
								{
									match:
										/!\i\.available(?=\)return \i\.\i\.GUILD_SUBSCRIPTION_UNAVAILABLE;)/,
									replace: (e) => `${e}&&!${yp}`,
								},
								{
									match: /!\i\.\i\.canUseEmojisEverywhere\(\i\)/,
									replace: (e) => `(${e}&&!${yp})`,
								},
								{
									match: /(?<=\|\|)\i\.\i\.canUseAnimatedEmojis\(\i\)/,
									replace: (e) => `(${e}||${yp})`,
								},
							],
						},
						{
							find: ".getUserIsAdmin(",
							replacement: {
								match:
									/(function \i\(\i,\i)\){(.{0,250}.getUserIsAdmin\(.+?return!1})/,
								replace: (e, t, o) =>
									`${t},fakeNitroOriginal){if(!fakeNitroOriginal)return false;${o}`,
							},
						},
						{
							find: "canUseCustomStickersEverywhere:function",
							predicate: () => ot.store.enableStickerBypass,
							replacement: {
								match: /canUseCustomStickersEverywhere:function\(\i\){/,
								replace: "$&return true;",
							},
						},
						{
							find: '"SENDABLE"',
							predicate: () => ot.store.enableStickerBypass,
							replacement: { match: /\i\.available\?/, replace: "true?" },
						},
						{
							find: "canUseHighVideoUploadQuality:function",
							predicate: () => ot.store.enableStreamQualityBypass,
							replacement: [
								"canUseHighVideoUploadQuality",
								"canStreamQuality",
							].map((e) => ({
								match: new RegExp(`${e}:function\\(\\i(?:,\\i)?\\){`, "g"),
								replace: "$&return true;",
							})),
						},
						{
							find: "STREAM_FPS_OPTION.format",
							predicate: () => ot.store.enableStreamQualityBypass,
							replacement: {
								match: /guildPremiumTier:\i\.\i\.TIER_\d,?/g,
								replace: "",
							},
						},
						{
							find: "canUseClientThemes:function",
							replacement: {
								match: /canUseClientThemes:function\(\i\){/,
								replace: "$&return true;",
							},
						},
						{
							find: '"UserSettingsProtoStore"',
							replacement: [
								{
									match: /CONNECTION_OPEN:function\((\i)\){/,
									replace: (e, t) =>
										`${e}$self.handleProtoChange(${t}.userSettingsProto,${t}.user);`,
								},
								{
									match: /let{settings:/,
									replace:
										"arguments[0].local||$self.handleProtoChange(arguments[0].settings.proto);$&",
								},
							],
						},
						{
							find: ",updateTheme(",
							replacement: {
								match:
									/(function \i\(\i\){let{backgroundGradientPresetId:(\i).+?)(\i\.\i\.updateAsync.+?theme=(.+?),.+?},\i\))/,
								replace: (e, t, o, r, i) =>
									`${t}$self.handleGradientThemeSelect(${o},${i},()=>${r});`,
							},
						},
						{
							find: '["strong","em","u","text","inlineCode","s","spoiler"]',
							replacement: [
								{
									predicate: () => ot.store.transformEmojis,
									match: /1!==(\i)\.length\|\|1!==\i\.length/,
									replace: (e, t) => `${e}||$self.shouldKeepEmojiLink(${t}[0])`,
								},
								{
									predicate: () =>
										ot.store.transformEmojis || ot.store.transformStickers,
									match: /(?=return{hasSpoilerEmbeds:\i,content:(\i)})/,
									replace: (e, t) =>
										`${t}=$self.patchFakeNitroEmojisOrRemoveStickersLinks(${t},arguments[2]?.formatInline);`,
								},
							],
						},
						{
							find: "}renderEmbeds(",
							replacement: [
								{
									predicate: () =>
										ot.store.transformEmojis || ot.store.transformStickers,
									match:
										/(renderEmbeds\((\i)\){)(.+?embeds\.map\(\((\i),\i\)?=>{)/,
									replace: (e, t, o, r, i) =>
										`${t}const fakeNitroMessage=${o};${r}if($self.shouldIgnoreEmbed(${i},fakeNitroMessage))return null;`,
								},
								{
									predicate: () => ot.store.transformStickers,
									match:
										/renderStickersAccessories\((\i)\){let (\i)=\(0,\i\.\i\)\(\i\).+?;/,
									replace: (e, t, o) =>
										`${e}${o}=$self.patchFakeNitroStickers(${o},${t});`,
								},
								{
									predicate: () => ot.store.transformStickers,
									match: /renderAttachments\(\i\){let{attachments:(\i).+?;/,
									replace: (e, t) => `${e}${t}=$self.filterAttachments(${t});`,
								},
							],
						},
						{
							find: ".Messages.STICKER_POPOUT_UNJOINED_PRIVATE_GUILD_DESCRIPTION.format",
							predicate: () => ot.store.transformStickers,
							replacement: [
								{
									match:
										/let{renderableSticker:(\i).{0,270}sticker:\i,channel:\i,/,
									replace: (e, t) => `${e}fakeNitroRenderableSticker:${t},`,
								},
								{
									match:
										/(let \i,{sticker:\i,channel:\i,closePopout:\i.+?}=(\i).+?;)(.+?description:)(\i)(?=,sticker:\i)/,
									replace: (e, t, o, r, i) =>
										`${t}let{fakeNitroRenderableSticker}=${o};${r}$self.addFakeNotice(${0},${i},!!fakeNitroRenderableSticker?.fake)`,
								},
							],
						},
						{
							find: ".EMOJI_UPSELL_POPOUT_MORE_EMOJIS_OPENED,",
							predicate: () => ot.store.transformEmojis,
							replacement: {
								match:
									/isDiscoverable:\i,shouldHideRoleSubscriptionCTA:\i,(?<={node:(\i),.+?)/,
								replace: (e, t) => `${e}fakeNitroNode:${t},`,
							},
						},
						{
							find: ".Messages.EMOJI_POPOUT_UNJOINED_DISCOVERABLE_GUILD_DESCRIPTION",
							predicate: () => ot.store.transformEmojis,
							replacement: {
								match: /(?<=emojiDescription:)(\i)(?<=\1=\i\((\i)\).+?)/,
								replace: (e, t, o) =>
									`$self.addFakeNotice(${1},${t},!!${o}?.fakeNitroNode?.fake)`,
							},
						},
						{
							find: "canUsePremiumAppIcons:function",
							replacement: {
								match: /canUsePremiumAppIcons:function\(\i\){/,
								replace: "$&return true;",
							},
						},
						{
							find: /\.getCurrentDesktopIcon.{0,25}\.isPremium/,
							replacement: {
								match: /\i\.\i\.isPremium\(\i\.\i\.getCurrentUser\(\)\)/,
								replace: "true",
							},
						},
						{
							find: 'type:"GUILD_SOUNDBOARD_SOUND_CREATE"',
							replacement: {
								match:
									/(?<=type:"(?:SOUNDBOARD_SOUNDS_RECEIVED|GUILD_SOUNDBOARD_SOUND_CREATE|GUILD_SOUNDBOARD_SOUND_UPDATE|GUILD_SOUNDBOARD_SOUNDS_UPDATE)".+?available:)\i\.available/g,
								replace: "true",
							},
						},
						{
							find: "canUseCustomNotificationSounds:function",
							replacement: {
								match: /canUseCustomNotificationSounds:function\(\i\){/,
								replace: "$&return true;",
							},
						},
					],
					get guildId() {
						return li()?.id;
					},
					get canUseEmotes() {
						return (D.getCurrentUser().premiumType ?? 0) > 0;
					},
					get canUseStickers() {
						return (D.getCurrentUser().premiumType ?? 0) > 1;
					},
					handleProtoChange(e, t) {
						try {
							if (e == null || typeof e == "string") return;
							if (
								(t?.premium_type ?? D?.getCurrentUser()?.premiumType ?? 0) !== 2
							) {
								if (
									((e.appearance ??= Ai.create()),
									hp.settings.appearance?.theme != null)
								) {
									let r = Ai.create({ theme: hp.settings.appearance.theme });
									e.appearance.theme = r.theme;
								}
								if (
									hp.settings.appearance?.clientThemeSettings
										?.backgroundGradientPresetId?.value != null
								) {
									let r = D1.create({
										backgroundGradientPresetId: {
											value:
												hp.settings.appearance.clientThemeSettings
													.backgroundGradientPresetId.value,
										},
									});
									(e.appearance.clientThemeSettings ??= r),
										(e.appearance.clientThemeSettings.backgroundGradientPresetId =
											r.backgroundGradientPresetId);
								}
							}
						} catch (o) {
							new V("FakeNitro").error(o);
						}
					},
					handleGradientThemeSelect(e, t, o) {
						if ((D?.getCurrentUser()?.premiumType ?? 0) === 2 || e == null)
							return o();
						if (!Sp || !Ai || !D1 || !ax) return;
						let i = Sp.getCurrentValue().appearance,
							s = i != null ? Ai.fromBinary(Ai.toBinary(i), ax) : Ai.create();
						s.theme = t;
						let l = D1.create({ backgroundGradientPresetId: { value: e } });
						(s.clientThemeSettings ??= l),
							(s.clientThemeSettings.backgroundGradientPresetId =
								l.backgroundGradientPresetId);
						let c = Sp.ProtoClass.create();
						(c.appearance = s),
							_.dispatch({
								type: "USER_SETTINGS_PROTO_UPDATE",
								local: !0,
								partial: !0,
								settings: { type: 1, proto: c },
							});
					},
					trimContent(e) {
						let t = e[0];
						typeof t == "string"
							? ((e[0] = t.trimStart()), e[0] || e.shift())
							: typeof t?.props?.children == "string" &&
								((t.props.children = t.props.children.trimStart()),
								t.props.children || e.shift());
						let o = e.length - 1,
							r = e[o];
						typeof r == "string"
							? ((e[o] = r.trimEnd()), e[o] || e.pop())
							: typeof r?.props?.children == "string" &&
								((r.props.children = r.props.children.trimEnd()),
								r.props.children || e.pop());
					},
					clearEmptyArrayItems(e) {
						return e.filter((t) => t != null);
					},
					ensureChildrenIsArray(e) {
						Array.isArray(e.props.children) ||
							(e.props.children = [e.props.children]);
					},
					patchFakeNitroEmojisOrRemoveStickersLinks(e, t) {
						if (
							(e.length > 1 || typeof e[0]?.type == "string") &&
							!ot.store.transformCompoundSentence
						)
							return e;
						let o = e.length,
							r = (c) => {
								if (ot.store.transformEmojis) {
									let u = c.props.href.match(L1);
									if (u) {
										let p = null;
										try {
											p = new URL(c.props.href);
										} catch {}
										let m =
											dn.getCustomEmojiById(u[1])?.name ??
											p?.searchParams.get("name") ??
											"FakeNitroEmoji";
										return Ce.defaultRules.customEmoji.react(
											{
												jumboable:
													!t && e.length === 1 && typeof e[0].type != "string",
												animated: u[2] === "gif",
												emojiId: u[1],
												name: m,
												fake: !0,
											},
											void 0,
											{ key: String(o++) }
										);
									}
								}
								if (ot.store.transformStickers) {
									if (E1.test(c.props.href)) return null;
									let u = c.props.href.match(vp);
									if (u && Ci.getStickerById(u[1])) return null;
								}
								return c;
							},
							i = (c) =>
								c?.props?.trusted != null
									? r(c)
									: c?.props?.children != null
										? Array.isArray(c.props.children)
											? ((c.props.children = l(c.props.children)),
												c.props.children.length === 0 ? null : c)
											: ((c.props.children = s(c.props.children)), c)
										: c,
							s = (c) => {
								let u = i(c);
								if (u?.type === "ul" || u?.type === "ol") {
									if (
										(this.ensureChildrenIsArray(u),
										u.props.children.length === 0)
									)
										return null;
									let p = !1;
									for (let [m, y] of u.props.children.entries()) {
										if (y == null) {
											delete u.props.children[m];
											continue;
										}
										this.ensureChildrenIsArray(y),
											y.props.children.length > 0
												? (p = !0)
												: delete u.props.children[m];
									}
									if (!p) return null;
									u.props.children = this.clearEmptyArrayItems(
										u.props.children
									);
								}
								return u;
							},
							l = (c) => {
								for (let [u, p] of c.entries()) c[u] = s(p);
								return (c = this.clearEmptyArrayItems(c)), c;
							};
						try {
							let c = l(ni.cloneDeep(e));
							return this.trimContent(c), c;
						} catch (c) {
							return new V("FakeNitro").error(c), e;
						}
					},
					patchFakeNitroStickers(e, t) {
						let o = [],
							r = t.content.split(/\s/);
						ot.store.transformCompoundSentence
							? o.push(...r)
							: r.length === 1 && o.push(r[0]),
							o.push(
								...t.attachments
									.filter((i) => i.content_type === "image/gif")
									.map((i) => i.url)
							);
						for (let i of o) {
							if (
								!ot.store.transformCompoundSentence &&
								!i.startsWith("http") &&
								!lx.test(i)
							)
								continue;
							let s = i.match(E1);
							if (s) {
								let c = null;
								try {
									c = new URL(i);
								} catch {}
								let u =
									Ci.getStickerById(s[1])?.name ??
									c?.searchParams.get("name") ??
									"FakeNitroSticker";
								e.push({ format_type: 1, id: s[1], name: u, fake: !0 });
								continue;
							}
							let l = i.match(vp);
							if (l) {
								if (!Ci.getStickerById(l[1])) continue;
								let c = Ci.getStickerById(l[1])?.name ?? "FakeNitroSticker";
								e.push({ format_type: 2, id: l[1], name: c, fake: !0 });
							}
						}
						return e;
					},
					shouldIgnoreEmbed(e, t) {
						let o = t.content.split(/\s/);
						if (o.length > 1 && !ot.store.transformCompoundSentence) return !1;
						switch (e.type) {
							case "image": {
								if (
									!ot.store.transformCompoundSentence &&
									!o.some((r) => r === e.url || r.match(lx)?.[1] === e.url)
								)
									return !1;
								if (ot.store.transformEmojis && L1.test(e.url)) return !0;
								if (ot.store.transformStickers) {
									if (E1.test(e.url)) return !0;
									let r = e.url.match(vp);
									if (r && Ci.getStickerById(r[1])) return !0;
								}
								break;
							}
						}
						return !1;
					},
					filterAttachments(e) {
						return e.filter((t) => {
							if (t.content_type !== "image/gif") return !0;
							let o = t.url.match(vp);
							return !(o && Ci.getStickerById(o[1]));
						});
					},
					shouldKeepEmojiLink(e) {
						return e.target && L1.test(e.target);
					},
					addFakeNotice(e, t, o) {
						if (!o) return t;
						switch (((t = Array.isArray(t) ? t : [t]), e)) {
							case 0:
								return (
									t.push(
										" This is a FakeNitro sticker and renders like a real sticker only for you. Appears as a link to non-plugin users."
									),
									t
								);
							case 1:
								return (
									t.push(
										" This is a FakeNitro emoji and renders like a real emoji only for you. Appears as a link to non-plugin users."
									),
									t
								);
						}
					},
					getStickerLink(e) {
						return `https://media.discordapp.net/stickers/${e}.png?size=${ot.store.stickerSize}`;
					},
					async sendAnimatedSticker(e, t, o) {
						let { parseURL: r } = KT(),
							{ frames: i, width: s, height: l } = await r(e),
							c = (0, Ss.GIFEncoder)(),
							u = ot.store.stickerSize,
							p = document.createElement("canvas");
						(p.width = u), (p.height = u);
						let m = p.getContext("2d", { willReadFrequently: !0 }),
							y = u / Math.max(s, l);
						m.scale(y, y);
						let v;
						for (let w of i) {
							let {
								left: I,
								top: A,
								width: L,
								height: k,
								img: $,
								delay: j,
								blendOp: Q,
								disposeOp: ee,
							} = w;
							(v = m.getImageData(I, A, L, k)),
								Q === 0 && m.clearRect(I, A, L, k),
								m.drawImage($, I, A, L, k);
							let { data: J } = m.getImageData(0, 0, u, u),
								B = (0, Ss.quantize)(J, 256),
								ie = (0, Ss.applyPalette)(J, B);
							c.writeFrame(ie, u, u, { transparent: !0, palette: B, delay: j }),
								ee === 1
									? m.clearRect(I, A, L, k)
									: ee === 2 && m.putImageData(v, I, A);
						}
						c.finish();
						let N = new File([c.bytesView()], `${t}.gif`, {
							type: "image/gif",
						});
						la.promptToUpload([N], oe.getChannel(o), Wt.ChannelMessage);
					},
					canUseEmote(e, t) {
						if (e.type === 0) return !0;
						if (e.available === !1 || k3(e, this.guildId, !0)) return !1;
						let o = !1;
						if (e.managed && e.guildId) {
							let r = Le.getSelfMember(e.guildId)?.roles ?? [];
							o = e.roles.some((i) => r.includes(i));
						}
						return this.canUseEmotes || o
							? e.guildId === this.guildId || D3(t)
							: !e.animated && e.guildId === this.guildId;
					},
					start() {
						let e = ot.store;
						if (!e.enableEmojiBypass && !e.enableStickerBypass) return;
						function t(r, i) {
							return !r[i] || /\s/.test(r[i]) ? "" : " ";
						}
						function o() {
							return new Promise((r) => {
								Tt.show({
									title: "Hold on!",
									body: n(
										"div",
										null,
										n(
											S.FormText,
											null,
											"You are trying to send/edit a message that contains a FakeNitro emoji or sticker, however you do not have permissions to embed links in the current channel. Are you sure you want to send this message? Your FakeNitro items will appear as a link only."
										),
										n(
											S.FormText,
											{ type: S.FormText.Types.DESCRIPTION },
											"You can disable this notice in the plugin settings."
										)
									),
									confirmText: "Send Anyway",
									cancelText: "Cancel",
									secondaryConfirmText: "Do not show again",
									onConfirm: () => r(!0),
									onCloseCallback: () => setImmediate(() => r(!1)),
									onConfirmSecondary() {
										(ot.store.disableEmbedPermissionCheck = !0), r(!0);
									},
								});
							});
						}
						(this.preSend = yo(async (r, i, s) => {
							let { guildId: l } = this,
								c = !1;
							e: {
								if (!e.enableStickerBypass) break e;
								let u = Ci.getStickerById(s.stickers?.[0]);
								if (!u || "pack_id" in u) break e;
								let p = this.canUseStickers && L3(r);
								if (u.available !== !1 && (p || u.guild_id === l)) break e;
								let m = this.getStickerLink(u.id);
								if (
									(u.format_type === 4 &&
										m.includes(".png") &&
										(m = m.replace(".png", ".gif")),
									u.format_type === 2)
								)
									return (
										E3(r)
											? this.sendAnimatedSticker(m, u.id, r)
											: Tt.show({
													title: "Hold on!",
													body: n(
														"div",
														null,
														n(
															S.FormText,
															null,
															"You cannot send this message because it contains an animated FakeNitro sticker, and you do not have permissions to attach files in the current channel. Please remove the sticker to proceed."
														)
													),
												}),
										{ cancel: !0 }
									);
								{
									c = !0;
									let y = new URL(m);
									y.searchParams.set("name", u.name);
									let v = e.hyperLinkText.replaceAll("{{NAME}}", u.name);
									(i.content += `${t(i.content, i.content.length - 1)}${e.useHyperLinks ? `[${v}](${y})` : y}`),
										(s.stickers.length = 0);
								}
							}
							if (e.enableEmojiBypass)
								for (let u of i.validNonShortcutEmojis) {
									if (this.canUseEmote(u, r)) continue;
									c = !0;
									let p = `<${u.animated ? "a" : ""}:${u.originalName || u.name}:${u.id}>`,
										m = new URL(
											Rt.getEmojiURL({
												id: u.id,
												animated: u.animated,
												size: e.emojiSize,
											})
										);
									m.searchParams.set("size", e.emojiSize.toString()),
										m.searchParams.set("name", u.name);
									let y = e.hyperLinkText.replaceAll("{{NAME}}", u.name);
									i.content = i.content.replace(
										p,
										(v, N, w) =>
											`${t(w, N - 1)}${e.useHyperLinks ? `[${y}](${m})` : m}${t(w, N + v.length)}`
									);
								}
							return c &&
								!e.disableEmbedPermissionCheck &&
								!cx(r) &&
								!(await o())
								? { cancel: !0 }
								: { cancel: !1 };
						})),
							(this.preEdit = Ti(async (r, i, s) => {
								if (!e.enableEmojiBypass) return;
								let l = !1;
								return (
									(s.content = s.content.replace(
										/(?<!\\)<a?:(?:\w+):(\d+)>/gi,
										(c, u, p, m) => {
											let y = dn.getCustomEmojiById(u);
											if (y == null || this.canUseEmote(y, r)) return c;
											l = !0;
											let v = new URL(
												Rt.getEmojiURL({
													id: y.id,
													animated: y.animated,
													size: e.emojiSize,
												})
											);
											v.searchParams.set("size", e.emojiSize.toString()),
												v.searchParams.set("name", y.name);
											let N = e.hyperLinkText.replaceAll("{{NAME}}", y.name);
											return `${t(m, p - 1)}${e.useHyperLinks ? `[${N}](${v})` : v}${t(m, p + c.length)}`;
										}
									)),
									l && !e.disableEmbedPermissionCheck && !cx(r) && !(await o())
										? { cancel: !0 }
										: { cancel: !1 }
								);
							}));
					},
					stop() {
						vo(this.preSend), xi(this.preEdit);
					},
				}));
		});
	var dx = g(() => {});
	function mx(...e) {
		let t = {};
		function o(i) {
			for (let s = e.length - 1; s >= 0; s--) if (i in e[s]) return e[s];
			return t;
		}
		let r = {
			ownKeys() {
				return e.reduce(
					(i, s) => (i.push(...Reflect.ownKeys(s)), i),
					Reflect.ownKeys(t)
				);
			},
		};
		for (let i of [
			"defineProperty",
			"deleteProperty",
			"get",
			"getOwnPropertyDescriptor",
			"has",
			"set",
		])
			r[i] = function (s, ...l) {
				return Reflect[i](o(l[0]), ...l);
			};
		return new Proxy(t, r);
	}
	var fx,
		gx = g(() => {
			"use strict";
			a();
			fx = mx;
			typeof module < "u" && (module.exports = mx);
		});
	function hx(e, t) {
		let o = `[#${e.toString(16).padStart(6, "0")},#${t.toString(16).padStart(6, "0")}]`,
			r = "",
			i = Array.from(o)
				.map((s) => s.codePointAt(0))
				.filter((s) => s >= 32 && s <= 127)
				.map((s) => String.fromCodePoint(s + 917504))
				.join("");
		return (r || "") + " " + i;
	}
	function yx(e) {
		if (e == null) return null;
		let t = e.match(
			/\u{e005b}\u{e0023}([\u{e0061}-\u{e0066}\u{e0041}-\u{e0046}\u{e0030}-\u{e0039}]{1,6})\u{e002c}\u{e0023}([\u{e0061}-\u{e0066}\u{e0041}-\u{e0046}\u{e0030}-\u{e0039}]{1,6})\u{e005d}/u
		);
		if (t != null) {
			let o = [...t[0]]
				.map((i) => String.fromCodePoint(i.codePointAt(0) - 917504))
				.join("");
			return o
				.substring(1, o.length - 1)
				.split(",")
				.map((i) => parseInt(i.replace("#", "0x"), 16));
		} else return null;
	}
	var vx,
		Sx,
		O3,
		F3,
		xp,
		bx = g(() => {
			"use strict";
			a();
			dx();
			F();
			re();
			P();
			Ye();
			me();
			ct();
			T();
			U();
			b();
			gx();
			(vx = x({
				nitroFirst: {
					description: "Default color source if both are present",
					type: 4,
					options: [
						{ label: "Nitro colors", value: !0, default: !0 },
						{ label: "Fake colors", value: !1 },
					],
				},
			})),
				(Sx = ae(
					".Messages.USER_SETTINGS_PROFILE_COLOR_SELECT_COLOR",
					".BACKGROUND_PRIMARY)"
				)),
				(O3 = ae(
					"isTryItOutFlow:",
					"pendingThemeColors:",
					"pendingAvatarDecoration:",
					"EDIT_PROFILE_BANNER"
				)),
				(F3 = Rn("USER_SETTINGS_PROFILE_COLOR_DEFAULT_BUTTON.format")),
				(xp = h({
					name: "FakeProfileThemes",
					description:
						"Allows profile theming by hiding the colors in your bio thanks to invisible 3y3 encoding",
					authors: [d.Alyxia, d.Remty],
					patches: [
						{
							find: "UserProfileStore",
							replacement: {
								match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
								replace: "$self.colorDecodeHook($1)",
							},
						},
						{
							find: ".USER_SETTINGS_RESET_PROFILE_THEME",
							replacement: {
								match:
									/RESET_PROFILE_THEME}\)(?<=color:(\i),.{0,500}?color:(\i),.{0,500}?)/,
								replace: "$&,$self.addCopy3y3Button({primary:$1,accent:$2})",
							},
						},
					],
					settingsAboutComponent: () => {
						let e = yx(eo.getUserProfile(D.getCurrentUser().id).bio) ?? [0, 0],
							[t, o] = z(e[0]),
							[r, i] = z(e[1]),
							[, , s] = pt(F3);
						return n(
							S.FormSection,
							null,
							n(S.FormTitle, { tag: "h3" }, "Usage"),
							n(
								S.FormText,
								null,
								"After enabling this plugin, you will see custom colors in the profiles of other people using compatible plugins.",
								" ",
								n("br", null),
								"To set your own colors:",
								n(
									"ul",
									null,
									n(
										"li",
										null,
										"\u2022 use the color pickers below to choose your colors"
									),
									n("li", null, '\u2022 click the "Copy 3y3" button'),
									n(
										"li",
										null,
										"\u2022 paste the invisible text anywhere in your bio"
									)
								),
								n("br", null),
								n(S.FormDivider, { className: H(G.top8, G.bottom8) }),
								n(S.FormTitle, { tag: "h3" }, "Color pickers"),
								!s &&
									n(
										Wi,
										{
											direction: Wi.Direction.HORIZONTAL,
											style: { gap: "1rem" },
										},
										n(Sx, {
											color: t,
											label: n(
												Z,
												{
													variant: "text-xs/normal",
													style: { marginTop: "4px" },
												},
												"Primary"
											),
											onChange: (l) => {
												o(l);
											},
										}),
										n(Sx, {
											color: r,
											label: n(
												Z,
												{
													variant: "text-xs/normal",
													style: { marginTop: "4px" },
												},
												"Accent"
											),
											onChange: (l) => {
												i(l);
											},
										}),
										n(
											M,
											{
												onClick: () => {
													let l = hx(t, r);
													Kt(l);
												},
												color: M.Colors.PRIMARY,
												size: M.Sizes.XLARGE,
											},
											"Copy 3y3"
										)
									),
								n(S.FormDivider, { className: H(G.top8, G.bottom8) }),
								n(S.FormTitle, { tag: "h3" }, "Preview"),
								n(
									"div",
									{ className: "vc-fpt-preview" },
									n(O3, {
										user: D.getCurrentUser(),
										pendingThemeColors: [t, r],
										onAvatarChange: () => {},
										onBannerChange: () => {},
										canUsePremiumCustomization: !0,
										hideExampleButton: !0,
										hideFakeActivity: !0,
										isTryItOutFlow: !0,
									})
								)
							)
						);
					},
					settings: vx,
					colorDecodeHook(e) {
						if (e) {
							if (vx.store.nitroFirst && e.themeColors) return e;
							let t = yx(e.bio);
							if (t) return fx(e, { premiumType: 2, themeColors: t });
						}
						return e;
					},
					addCopy3y3Button: R.wrap(
						function ({ primary: e, accent: t }) {
							return n(
								M,
								{
									onClick: () => {
										let o = hx(e, t);
										Kt(o);
									},
									color: M.Colors.PRIMARY,
									size: M.Sizes.XLARGE,
									className: G.left16,
								},
								"Copy 3y3"
							);
						},
						{ noop: !0 }
					),
				}));
		});
	var wp,
		Tx = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			wp = h({
				name: "FavoriteEmojiFirst",
				authors: [d.Aria, d.Ven],
				description:
					"Puts your favorite emoji first in the emoji autocomplete.",
				patches: [
					{
						find: "renderResults({results:",
						replacement: [
							{
								match:
									/let \i=.{1,100}renderResults\({results:(\i)\.query\.results,/,
								replace: "$self.sortEmojis($1);$&",
							},
						],
					},
					{
						find: "numLockedEmojiResults:",
						replacement: [
							{
								match:
									/,maxCount:(\i)(.{1,500}\i)=(\i)\.slice\(0,(\i-\i\.length)\)/,
								replace: ",maxCount:Infinity$2=($3.sliceTo = $4, $3)",
							},
						],
					},
				],
				sortEmojis({ query: e }) {
					if (
						e?.type !== "EMOJIS_AND_STICKERS" ||
						e.typeInfo?.sentinel !== ":" ||
						!e.results?.emojis?.length
					)
						return;
					let t = dn.getDisambiguatedEmojiContext();
					e.results.emojis = e.results.emojis
						.sort((o, r) => {
							let i = t.isFavoriteEmojiWithoutFetchingLatest(o),
								s = t.isFavoriteEmojiWithoutFetchingLatest(r);
							return i && !s ? -1 : !i && s ? 1 : 0;
						})
						.slice(0, e.results.emojis.sliceTo ?? 1 / 0);
				},
			});
		});
	function B3({ instance: e, SearchBarComponent: t }) {
		let [o, r] = z(""),
			i = St(null),
			s = ac(
				(l) => {
					r(l);
					let { props: c } = e;
					if (l === "") {
						(c.favorites = c.favCopy), e.forceUpdate();
						return;
					}
					i.current?.containerRef?.current
						.closest("#gif-picker-tab-panel")
						?.querySelector('[class|="content"]')
						?.firstElementChild?.scrollTo(0, 0);
					let u = c.favCopy
						.map((p) => ({
							score: U3(
								l.toLowerCase(),
								wx(p.url ?? p.src)
									.replace(/(%20|[_-])/g, " ")
									.toLowerCase()
							),
							gif: p,
						}))
						.filter((p) => p.score != null);
					u.sort((p, m) => m.score - p.score),
						(c.favorites = u.map((p) => p.gif)),
						e.forceUpdate();
				},
				[e.state]
			);
		return (
			ue(
				() => () => {
					e.dead = !0;
				},
				[]
			),
			n(t, {
				ref: i,
				autoFocus: !0,
				className: _3.searchBar,
				size: t.Sizes.MEDIUM,
				onChange: s,
				onClear: () => {
					r(""),
						e.props.favCopy != null &&
							((e.props.favorites = e.props.favCopy), e.forceUpdate());
				},
				query: o,
				placeholder: "Search Favorite Gifs",
			})
		);
	}
	function wx(e) {
		let t;
		try {
			t = new URL(e);
		} catch {
			return e;
		}
		switch (xx.store.searchOption) {
			case "url":
				return t.href;
			case "path":
				return t.host === "media.discordapp.net" || t.host === "tenor.com"
					? (t.pathname.split("/").at(-1) ?? t.pathname)
					: t.pathname;
			case "hostandpath":
				return t.host === "media.discordapp.net" || t.host === "tenor.com"
					? `${t.host} ${t.pathname.split("/").at(-1) ?? t.pathname}`
					: `${t.host} ${t.pathname}`;
			default:
				return "";
		}
	}
	function U3(e, t) {
		let o = 0,
			r = 0;
		for (let i = 0; i < t.length; i++)
			if ((t[i] === e[o] ? (r++, o++) : r--, o === e.length)) return r;
		return null;
	}
	var _3,
		xx,
		Pp,
		Px = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			T();
			U();
			b();
			(_3 = C("searchBar", "searchBarFullRow")),
				(xx = x({
					searchOption: {
						type: 4,
						description: "The part of the url you want to search",
						options: [
							{ label: "Entire Url", value: "url" },
							{ label: "Path Only (/somegif.gif)", value: "path" },
							{
								label: "Host & Path (tenor.com somgif.gif)",
								value: "hostandpath",
								default: !0,
							},
						],
					},
				})),
				(Pp = h({
					name: "FavoriteGifSearch",
					authors: [d.Aria],
					description: "Adds a search bar to favorite gifs.",
					patches: [
						{
							find: "renderHeaderContent()",
							replacement: [
								{
									match:
										/(renderHeaderContent\(\).{1,150}FAVORITES:return)(.{1,150});(case.{1,200}default:return\(0,\i\.jsx\)\((?<searchComp>\i\..{1,10}),)/,
									replace:
										"$1 this.state.resultType === 'Favorites' ? $self.renderSearchBar(this, $<searchComp>) : $2;$3",
								},
								{
									match: /(,suggestions:\i,favorites:)(\i),/,
									replace: "$1$self.getFav($2),favCopy:$2,",
								},
							],
						},
					],
					settings: xx,
					getTargetString: wx,
					instance: null,
					renderSearchBar(e, t) {
						return (
							(this.instance = e),
							n(R, { noop: !0 }, n(B3, { instance: e, SearchBarComponent: t }))
						);
					},
					getFav(e) {
						if (!this.instance || this.instance.dead) return e;
						let { favorites: t } = this.instance.props;
						return t != null && t?.length !== e.length ? t : e;
					},
				}));
		});
	var Mp,
		Mx = g(() => {
			"use strict";
			a();
			P();
			T();
			Mp = h({
				name: "FixCodeblockGap",
				description: "Removes the gap between codeblocks and text below it",
				authors: [d.Grzesiek11],
				patches: [
					{
						find: String.raw`/^${"```"}(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][^]*?)\n*${"```"}`,
						replacement: {
							match: String.raw`/^${"```"}(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][^]*?)\n*${"```"}`,
							replace: "$&\\n?",
						},
					},
				],
			});
		});
	var Ip,
		Ix = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			Ip = h({
				name: "ForceOwnerCrown",
				description:
					"Force the owner crown next to usernames even if the server is large.",
				authors: [d.D3SOX, d.Nickyux],
				patches: [
					{
						find: ".Messages.GUILD_OWNER,",
						replacement: {
							match: /,isOwner:(\i),/,
							replace: ",_isOwner:$1=$self.isGuildOwner(e),",
						},
					},
				],
				isGuildOwner(e) {
					if (!e?.user?.id || e.channel?.type === 3) return e.isOwner;
					let t = e.guildId ?? e.channel?.guild_id,
						o = e.user.id;
					return le.getGuild(t)?.ownerId === o;
				},
			});
		});
	var O1,
		Cp,
		Cx = g(() => {
			"use strict";
			a();
			jo();
			P();
			T();
			U();
			(O1 = C("createFriendInvite")),
				(Cp = h({
					name: "FriendInvites",
					description:
						"Create and manage friend invite links via slash commands (/create friend invite, /view friend invites, /revoke friend invites).",
					authors: [d.afn, d.Dziurwa],
					dependencies: ["CommandsAPI"],
					commands: [
						{
							name: "create friend invite",
							description: "Generates a friend invite link.",
							inputType: 3,
							execute: async (e, t) => {
								let o = await O1.createFriendInvite();
								Je(t.channel.id, {
									content: `
                        discord.gg/${o.code} \xB7
                        Expires: <t:${new Date(o.expires_at).getTime() / 1e3}:R> \xB7
                        Max uses: \`${o.max_uses}\`
                    `
										.trim()
										.replace(/\s+/g, " "),
								});
							},
						},
						{
							name: "view friend invites",
							description: "View a list of all generated friend invites.",
							inputType: 3,
							execute: async (e, t) => {
								let r = (await O1.getAllFriendInvites()).map((i) =>
									`
                    _discord.gg/${i.code}_ \xB7
                    Expires: <t:${new Date(i.expires_at).getTime() / 1e3}:R> \xB7
                    Times used: \`${i.uses}/${i.max_uses}\`
                    `
										.trim()
										.replace(/\s+/g, " ")
								);
								Je(t.channel.id, {
									content:
										r.join(`
`) || "You have no active friend invites!",
								});
							},
						},
						{
							name: "revoke friend invites",
							description: "Revokes all generated friend invites.",
							inputType: 3,
							execute: async (e, t) => {
								await O1.revokeFriendInvites(),
									Je(t.channel.id, {
										content: "All friend invites have been revoked.",
									});
							},
						},
					],
				}));
		});
	var $3,
		G3,
		Ax,
		Nx,
		H3,
		Ap,
		Rx = g(() => {
			"use strict";
			a();
			re();
			P();
			it();
			De();
			T();
			U();
			b();
			($3 = C("memberSinceWrapper")),
				(G3 = C("memberSince")),
				(Ax = fe('month:"short",day:"numeric"')),
				(Nx = C("getLocale")),
				(H3 = _e(
					(e) =>
						e.section !== void 0 &&
						e.heading !== void 0 &&
						Object.values(e).length === 2
				)),
				(Ap = h({
					name: "FriendsSince",
					description:
						"Shows when you became friends with someone in the user popout",
					authors: [d.Elvyra, d.Antti],
					patches: [
						{
							find: ".PANEL}),nicknameIcons",
							replacement: {
								match:
									/USER_PROFILE_MEMBER_SINCE,.{0,100}userId:(\i\.id)}\)}\)/,
								replace: "$&,$self.friendsSinceNew({userId:$1,isSidebar:true})",
							},
						},
						{
							find: 'action:"PRESS_APP_CONNECTION"',
							replacement: {
								match:
									/USER_PROFILE_MEMBER_SINCE,.{0,100}userId:(\i\.id),.{0,100}}\)}\),/,
								replace:
									"$&,$self.friendsSinceNew({userId:$1,isSidebar:false}),",
							},
						},
					],
					getFriendSince(e) {
						try {
							return Ie.isFriend(e) ? Ie.getSince(e) : null;
						} catch (t) {
							return new V("FriendsSince").error(t), null;
						}
					},
					friendsSinceNew: R.wrap(
						({ userId: e, isSidebar: t }) => {
							if (!Ie.isFriend(e)) return null;
							let o = Ie.getSince(e);
							return o
								? n(
										"section",
										{ className: H3.section },
										n(
											oc,
											{
												variant: "text-xs/semibold",
												style: t ? {} : { color: "var(--header-secondary)" },
											},
											"Friends Since"
										),
										t
											? n(
													Z,
													{ variant: "text-sm/normal" },
													Ax(o, Nx.getLocale())
												)
											: n(
													"div",
													{ className: $3.memberSinceWrapper },
													n(
														"div",
														{ className: G3.memberSince },
														!!fn()?.guild_id &&
															n(
																"svg",
																{
																	"aria-hidden": "true",
																	width: "16",
																	height: "16",
																	viewBox: "0 0 24 24",
																	fill: "var(--interactive-normal)",
																},
																n("path", {
																	d: "M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
																}),
																n("path", {
																	d: "M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z",
																})
															),
														n(
															Z,
															{ variant: "text-sm/normal" },
															Ax(o, Nx.getLocale())
														)
													)
												)
									)
								: null;
						},
						{ noop: !0 }
					),
				}));
		});
	var F1,
		kx = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/gameActivityToggle/style.css",
				{
					name: "src/plugins/gameActivityToggle/style.css",
					source: `[class*="panels"] [class*="avatarWrapper"] {
    min-width: 88px;
}
`,
					classNames: {},
					dom: null,
				}
			);
			F1 = "src/plugins/gameActivityToggle/style.css";
		});
	function W3(e) {
		let { oldIcon: t } = Lx.use(["oldIcon"]),
			o = t
				? "M23 2.27 21.73 1 1 21.73 2.27 23 23 2.27Z"
				: "M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z",
			r = t
				? "M23.27 4.54 19.46.73 .73 19.46 4.54 23.27 23.27 4.54Z"
				: "M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z";
		return function () {
			return n(
				"svg",
				{ width: "20", height: "20", viewBox: "0 0 24 24" },
				n("path", {
					fill: !e && !t ? "var(--status-danger)" : "currentColor",
					mask: e ? void 0 : "url(#gameActivityMask)",
					d: "M3.06 20.4q-1.53 0-2.37-1.065T.06 16.74l1.26-9q.27-1.8 1.605-2.97T6.06 3.6h11.88q1.8 0 3.135 1.17t1.605 2.97l1.26 9q.21 1.53-.63 2.595T20.94 20.4q-.63 0-1.17-.225T18.78 19.5l-2.7-2.7H7.92l-2.7 2.7q-.45.45-.99.675t-1.17.225Zm14.94-7.2q.51 0 .855-.345T19.2 12q0-.51-.345-.855T18 10.8q-.51 0-.855.345T16.8 12q0 .51.345 .855T18 13.2Zm-2.4-3.6q.51 0 .855-.345T16.8 8.4q0-.51-.345-.855T15.6 7.2q-.51 0-.855.345T14.4 8.4q0 .51.345 .855T15.6 9.6ZM6.9 13.2h1.8v-2.1h2.1v-1.8h-2.1v-2.1h-1.8v2.1h-2.1v1.8h2.1v2.1Z",
				}),
				!e &&
					n(
						f,
						null,
						n("path", { fill: "var(--status-danger)", d: o }),
						n(
							"mask",
							{ id: "gameActivityMask" },
							n("rect", {
								fill: "white",
								x: "0",
								y: "0",
								width: "24",
								height: "24",
							}),
							n("path", { fill: "black", d: r })
						)
					)
			);
		};
	}
	function j3() {
		let e = Dx.useSetting();
		return n(z3, {
			tooltipText: e ? "Disable Game Activity" : "Enable Game Activity",
			icon: W3(e),
			role: "switch",
			"aria-checked": !e,
			onClick: () => Dx.updateSetting((t) => !t),
		});
	}
	var z3,
		Dx,
		Lx,
		Np,
		Ex = g(() => {
			"use strict";
			a();
			F();
			tt();
			Ir();
			re();
			P();
			T();
			U();
			kx();
			(z3 = ae("Button.Sizes.NONE,disabled:")),
				(Dx = Uo("status", "showCurrentGame"));
			(Lx = x({
				oldIcon: {
					type: 3,
					description: "Use the old icon style before Discord icon redesign",
					default: !1,
				},
			})),
				(Np = h({
					name: "GameActivityToggle",
					description:
						"Adds a button next to the mic and deafen button to toggle game activity.",
					authors: [d.Nuckyz, d.RuukuLada],
					dependencies: ["UserSettingsAPI"],
					settings: Lx,
					patches: [
						{
							find: ".Messages.ACCOUNT_SPEAKING_WHILE_MUTED",
							replacement: {
								match: /this\.renderNameZone\(\).+?children:\[/,
								replace: "$&$self.GameActivityToggleButton(),",
							},
						},
					],
					GameActivityToggleButton: R.wrap(j3, { noop: !0 }),
					start() {
						fo(F1);
					},
					stop() {
						_o(F1);
					},
				}));
		});
	var Rp,
		Ox = g(() => {
			"use strict";
			a();
			P();
			it();
			T();
			b();
			Rp = h({
				name: "GifPaste",
				description:
					"Makes picking a gif in the gif picker insert a link into the chatbox instead of instantly sending it",
				authors: [d.Ven],
				patches: [
					{
						find: '"handleSelectGIF",',
						replacement: {
							match: /"handleSelectGIF",(\i)=>\{/,
							replace:
								'"handleSelectGIF",$1=>{if (!this.props.className) return $self.handleSelect($1);',
						},
					},
				],
				handleSelect(e) {
					e && (ci(e.url + " "), ua.closeExpressionPicker());
				},
			});
		});
	function _x(e, t, o) {
		let r = Mo.getSendMessageOptionsForReply({
			channel: e,
			message: t,
			shouldMention: !0,
			showMentionToggle: !0,
		});
		if (kp.store.greetMode === "Message" || o.length > 1) {
			r.stickerIds = o;
			let i = {
				content: "",
				tts: !1,
				invalidEmojis: [],
				validNonShortcutEmojis: [],
			};
			Mo._sendMessage(e.id, i, r);
		} else Mo.sendGreetMessage(e.id, o[0], r);
	}
	function q3({ channel: e, message: t }) {
		let o = kp.use(["greetMode", "multiGreetChoices"]),
			{ greetMode: r, multiGreetChoices: i = [] } = o;
		return n(
			E.Menu,
			{
				navId: "greet-sticker-picker",
				onClose: () => _.dispatch({ type: "CONTEXT_MENU_CLOSE" }),
				"aria-label": "Greet Sticker Picker",
			},
			n(
				E.MenuGroup,
				{ label: "Greet Mode" },
				Object.values(Bx).map((s) =>
					n(E.MenuRadioItem, {
						key: s,
						group: "greet-mode",
						id: "greet-mode-" + s,
						label: s,
						checked: s === r,
						action: () => (o.greetMode = s),
					})
				)
			),
			n(E.MenuSeparator, null),
			n(
				E.MenuGroup,
				{ label: "Greet Stickers" },
				Fx.map((s) =>
					n(E.MenuItem, {
						key: s.id,
						id: "greet-" + s.id,
						label: s.description.split(" ")[0],
						action: () => _x(e, t, [s.id]),
					})
				)
			),
			kp.store.unholyMultiGreetEnabled
				? n(
						f,
						null,
						n(E.MenuSeparator, null),
						n(
							E.MenuItem,
							{ label: "Unholy Multi-Greet", id: "unholy-multi-greet" },
							Fx.map((s) => {
								let l = i.some((c) => c === s.id);
								return n(E.MenuCheckboxItem, {
									key: s.id,
									id: "multi-greet-" + s.id,
									label: s.description.split(" ")[0],
									checked: l,
									disabled: !l && i.length >= 3,
									action: () => {
										o.multiGreetChoices = l
											? i.filter((c) => c !== s.id)
											: [...i, s.id];
									},
								});
							}),
							n(E.MenuSeparator, null),
							n(E.MenuItem, {
								id: "multi-greet-submit",
								label: "Send Greets",
								action: () => _x(e, t, i),
								disabled: i.length === 0,
							})
						)
					)
				: null
		);
	}
	var Bx,
		kp,
		Fx,
		Dp,
		Ux = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			U();
			b();
			(Bx = ((o) => ((o.Greet = "Greet"), (o.NormalMessage = "Message"), o))(
				Bx || {}
			)),
				(kp = x({
					greetMode: {
						type: 4,
						options: [
							{
								label: "Greet (you can only greet 3 times)",
								value: "Greet",
								default: !0,
							},
							{
								label: "Normal Message (you can greet spam)",
								value: "Message",
							},
						],
						description: "Choose the greet mode",
					},
				}).withPrivateSettings()),
				(Fx = _e((e) => Array.isArray(e) && e[0]?.name === "Wave"));
			Dp = h({
				name: "GreetStickerPicker",
				description:
					"Allows you to use any greet sticker instead of only the random one by right-clicking the 'Wave to say hi!' button",
				authors: [d.Ven],
				settings: kp,
				patches: [
					{
						find: "Messages.WELCOME_CTA_LABEL",
						replacement: {
							match:
								/innerClassName:\i\.welcomeCTAButton,(?<={channel:\i,message:\i}=(\i).{0,400}?)/,
							replace:
								"$&onContextMenu:(vcEvent)=>$self.pickSticker(vcEvent, $1),",
						},
					},
				],
				pickSticker(e, t) {
					t.message.deleted || Qt.openContextMenu(e, () => n(q3, { ...t }));
				},
			});
		});
	var _1 = {};
	et(_1, {
		_buildPopoverElements: () => Y3,
		addButton: () => Qn,
		buttons: () => Lp,
		removeButton: () => Xn,
	});
	function Qn(e, t) {
		Lp.set(e, t);
	}
	function Xn(e) {
		Lp.delete(e);
	}
	function Y3(e, t) {
		let o = [];
		for (let [r, i] of Lp.entries())
			try {
				let s = i(t);
				s && ((s.key ??= r), o.push(n(R, { noop: !0 }, n(e, { ...s }))));
			} catch (s) {
				K3.error(`[${r}]`, s);
			}
		return n(f, null, o);
	}
	var K3,
		Lp,
		bs = g(() => {
			"use strict";
			a();
			re();
			De();
			(K3 = new V("MessagePopover")), (Lp = new Map());
		});
	var ll,
		Gx,
		cl,
		$x,
		Z3,
		Ep,
		Hx = g(() => {
			"use strict";
			a();
			$o();
			bs();
			yt();
			P();
			T();
			b();
			(Gx = "HideAttachments_HiddenIds"),
				(cl = new Set()),
				($x = () => lt(Gx).then((e) => ((cl = e ?? new Set()), cl))),
				(Z3 = (e) => wt(Gx, e)),
				(Ep = h({
					name: "HideAttachments",
					description:
						"Hide attachments and Embeds for individual messages via hover button",
					authors: [d.Ven],
					dependencies: ["MessagePopoverAPI"],
					async start() {
						(ll = document.createElement("style")),
							(ll.id = "VencordHideAttachments"),
							document.head.appendChild(ll),
							await $x(),
							await this.buildCss(),
							Qn("HideAttachments", (e) => {
								if (
									!e.attachments.length &&
									!e.embeds.length &&
									!e.stickerItems.length
								)
									return null;
								let t = cl.has(e.id);
								return {
									label: t ? "Show Attachments" : "Hide Attachments",
									icon: t ? wa : Pa,
									message: e,
									channel: oe.getChannel(e.channel_id),
									onClick: () => this.toggleHide(e.id),
								};
							});
					},
					stop() {
						ll.remove(), cl.clear(), Xn("HideAttachments");
					},
					async buildCss() {
						let e = [...cl].map((t) => `#message-accessories-${t}`).join(",");
						ll.textContent = `
        :is(${e}) :is([class*="embedWrapper"], [class*="clickableSticker"]) {
            /* important is not necessary, but add it to make sure bad themes won't break it */
            display: none !important;
        }
        :is(${e})::after {
            content: "Attachments hidden";
            color: var(--text-muted);
            font-size: 80%;
        }
        `;
					},
					async toggleHide(e) {
						let t = await $x();
						t.delete(e) || t.add(e), await Z3(t), await this.buildCss();
					},
				}));
		});
	var Op,
		zx = g(() => {
			"use strict";
			a();
			P();
			T();
			Op = h({
				name: "iLoveSpam",
				description: "Do not hide messages from 'likely spammers'",
				authors: [d.botato, d.Nyako],
				patches: [
					{
						find: "hasFlag:{writable",
						replacement: {
							match: /if\((\i)<=(?:1<<30|1073741824)\)return/,
							replace: "if($1===(1<<20))return false;$&",
						},
					},
				],
			});
		});
	function qx(e, t, o, r) {
		return n(te, { text: t }, (i) =>
			n(
				"button",
				{
					...i,
					onClick: (s) => V3(s, e),
					style: {
						all: "unset",
						cursor: "pointer",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
					},
				},
				n(
					"svg",
					{ width: "24", height: "24", viewBox: "0 -960 960 960" },
					n("path", { fill: r, d: o })
				)
			)
		);
	}
	function jx(e, t = !1) {
		let o = So.use(["ignoredActivities"]),
			{ ignoredActivities: r = [] } = o;
		return r.some((i) => i.id === e.id)
			? J3(e, "var(--status-danger)")
			: X3(e, t ? "var(--green-300)" : "var(--primary-400)");
	}
	function V3(e, t) {
		e.stopPropagation();
		let o = Lr().findIndex((r) => r.id === t.id);
		o === -1
			? (So.store.ignoredActivities = Lr().concat(t))
			: (So.store.ignoredActivities = Lr().filter((r, i) => i !== o)),
			Q3.updateSetting((r) => r);
	}
	function ek() {
		return n(
			pe,
			{ flexDirection: "column" },
			n(
				S.FormText,
				{ type: S.FormText.Types.DESCRIPTION },
				"Import the application id of the CustomRPC plugin to the allowed list"
			),
			n(
				"div",
				null,
				n(
					M,
					{
						onClick: () => {
							let e = he.plugins.CustomRPC?.appID;
							if (!e)
								return ft(
									"CustomRPC application ID is not set.",
									X.Type.FAILURE
								);
							B1?.(e) &&
								ft(
									"CustomRPC application ID is already added.",
									X.Type.FAILURE
								);
						},
					},
					"Import CustomRPC ID"
				)
			)
		);
	}
	function tk(e) {
		let [t, o] = z(So.store.allowedIds ?? "");
		(B1 = (i) => {
			let s = new Set(
					t
						.split(",")
						.map((u) => u.trim())
						.filter(Boolean)
				),
				l = s.has(i) || (s.add(i), !1),
				c = Array.from(s).join(", ");
			return o(c), e.setValue(c), l;
		}),
			ue(
				() => () => {
					B1 = null;
				},
				[]
			);
		function r(i) {
			o(i), e.setValue(i);
		}
		return n(
			S.FormSection,
			null,
			n(S.FormTitle, { tag: "h3" }, "Allowed List"),
			n(
				S.FormText,
				{ className: G.bottom8, type: S.FormText.Types.DESCRIPTION },
				"Comma separated list of activity IDs to allow (Useful for allowing RPC activities and CustomRPC)"
			),
			n(mt, {
				type: "text",
				value: t,
				onChange: r,
				placeholder: "235834946571337729, 343383572805058560",
			})
		);
	}
	function Lr() {
		return (So.store.ignoredActivities ??= []);
	}
	function ok(e, t) {
		if (t && So.store.allowedIds.includes(t)) return !1;
		switch (e) {
			case 0:
				return So.store.ignorePlaying;
			case 1:
				return So.store.ignoreStreaming;
			case 2:
				return So.store.ignoreListening;
			case 3:
				return So.store.ignoreWatching;
			case 5:
				return So.store.ignoreCompeting;
		}
		return !1;
	}
	var Wx,
		Q3,
		X3,
		J3,
		B1,
		So,
		Fp,
		Kx = g(() => {
			"use strict";
			a();
			$o();
			F();
			Ir();
			re();
			kt();
			P();
			Ye();
			T();
			U();
			b();
			(Wx = K("RunningGameStore")), (Q3 = Uo("status", "showCurrentGame"));
			(X3 = (e, t) =>
				qx(
					e,
					"Disable Activity",
					"M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z",
					t
				)),
				(J3 = (e, t) =>
					qx(
						e,
						"Enable Activity",
						"m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z",
						t
					));
			B1 = null;
			So = x({
				importCustomRPC: {
					type: 6,
					description: "",
					component: () => n(ek, null),
				},
				allowedIds: {
					type: 6,
					description: "",
					default: "",
					onChange(e) {
						let t = new Set(
							e
								.split(",")
								.map((o) => o.trim())
								.filter(Boolean)
						);
						So.store.allowedIds = Array.from(t).join(", ");
					},
					component: (e) => n(tk, { setValue: e.setValue }),
				},
				ignorePlaying: {
					type: 3,
					description:
						"Ignore all playing activities (These are usually game and RPC activities)",
					default: !1,
				},
				ignoreStreaming: {
					type: 3,
					description: "Ignore all streaming activities",
					default: !1,
				},
				ignoreListening: {
					type: 3,
					description:
						"Ignore all listening activities (These are usually spotify activities)",
					default: !1,
				},
				ignoreWatching: {
					type: 3,
					description: "Ignore all watching activities",
					default: !1,
				},
				ignoreCompeting: {
					type: 3,
					description:
						"Ignore all competing activities (These are normally special game activities)",
					default: !1,
				},
			}).withPrivateSettings();
			Fp = h({
				name: "IgnoreActivities",
				authors: [d.Nuckyz],
				description:
					"Ignore activities from showing up on your status ONLY. You can configure which ones are specifically ignored from the Registered Games and Activities tabs, or use the general settings below.",
				dependencies: ["UserSettingsAPI"],
				settings: So,
				patches: [
					{
						find: '="LocalActivityStore",',
						replacement: [
							{
								match: /HANG_STATUS.+?(?=!\i\(\)\(\i,\i\)&&)(?<=(\i)\.push.+?)/,
								replace: (e, t) =>
									`${e}${t}=${t}.filter($self.isActivityNotIgnored);`,
							},
						],
					},
					{
						find: '="ActivityTrackingStore",',
						replacement: {
							match:
								/getVisibleRunningGames\(\).+?;(?=for)(?<=(\i)=\i\.\i\.getVisibleRunningGames.+?)/,
							replace: (e, t) =>
								`${e}${t}=${t}.filter(({id,name})=>$self.isActivityNotIgnored({type:0,application_id:id,name}));`,
						},
					},
					{
						find: ".Messages.SETTINGS_GAMES_TOGGLE_OVERLAY",
						replacement: {
							match:
								/\.Messages\.SETTINGS_GAMES_TOGGLE_OVERLAY.+?}\(\),(?<={overlay:\i,.+?=(\i),.+?)(?=!(\i))/,
							replace: (e, t, o) =>
								`${e}$self.renderToggleGameActivityButton(${t},${o}),`,
						},
					},
					{
						find: ".activityTitleText,variant",
						replacement: {
							match: /\.activityTitleText.+?children:(\i)\.name.*?}\),/,
							replace: (e, t) => `${e}$self.renderToggleActivityButton(${t}),`,
						},
					},
					{
						find: ".activityCardDetails,children",
						replacement: {
							match:
								/\.activityCardDetails.+?children:(\i\.application)\.name.*?}\),/,
							replace: (e, t) => `${e}$self.renderToggleActivityButton(${t}),`,
						},
					},
				],
				async start() {
					let e = await lt("IgnoreActivities_ignoredActivities");
					if (
						(e != null &&
							((So.store.ignoredActivities = Array.from(e.values()).map(
								(t) => ({ ...t, name: "Unknown Name" })
							)),
							zs("IgnoreActivities_ignoredActivities")),
						Lr().length !== 0)
					) {
						let t = Wx.getGamesSeen();
						for (let [o, r] of Lr().entries())
							r.type === 0 &&
								(t.some((i) => i.id === r.id || i.exePath === r.id) ||
									Lr().splice(o, 1));
					}
				},
				isActivityNotIgnored(e) {
					if (ok(e.type, e.application_id)) return !1;
					if (e.application_id != null)
						return (
							!Lr().some((t) => t.id === e.application_id) ||
							So.store.allowedIds.includes(e.application_id)
						);
					{
						let t = Wx.getRunningGames().find(
							(o) => o.name === e.name
						)?.exePath;
						if (t) return !Lr().some((o) => o.id === t);
					}
					return !0;
				},
				renderToggleGameActivityButton(e, t) {
					return n(
						R,
						{ noop: !0 },
						n(
							"div",
							{ style: { marginLeft: 12, zIndex: 0 } },
							jx({ id: e.id ?? e.exePath, name: e.name, type: 0 }, t)
						)
					);
				},
				renderToggleActivityButton(e) {
					return n(R, { noop: !0 }, jx({ id: e.id, name: e.name, type: 1 }));
				},
			});
		});
	var _p,
		Yx = g(() => {
			"use strict";
			a();
			P();
			T();
			_p = h({
				name: "ImageLink",
				description:
					"Never hide image links in messages, even if it's the only content",
				authors: [d.Kyuuhachi, d.Sqaaakoi],
				patches: [
					{
						find: "unknownUserMentionPlaceholder:",
						replacement: {
							match: /\i\.has\(\i\.type\)&&\(0,\i\.\i\)\(\i\)/,
							replace: "false",
						},
					},
				],
			});
		});
	var ul,
		U1 = g(() => {
			"use strict";
			a();
			ul = "vc-imgzoom-magnify-modal";
		});
	function $1(e, t) {
		e() ? t() : requestAnimationFrame(() => $1(e, t));
	}
	var Zx = g(() => {
		"use strict";
		a();
	});
	var nk,
		G1,
		Qx = g(() => {
			"use strict";
			a();
			tt();
			re();
			b();
			U1();
			H1();
			Zx();
			(nk = be("vc-imgzoom-")),
				(G1 = R.wrap(
					({ instance: e, size: t, zoom: o }) => {
						let [r, i] = z(!1),
							[s, l] = z({ x: 0, y: 0 }),
							[c, u] = z({ x: 0, y: 0 }),
							[p, m] = z(0),
							y = St(!1),
							v = St(o),
							N = St(t),
							w = St(null),
							I = St(null),
							A = St(null),
							L = St(null);
						if (
							(q.useLayoutEffect(() => {
								let $ = (se) => {
										se.key === "Shift" && (y.current = !0);
									},
									j = (se) => {
										se.key === "Shift" && (y.current = !1);
									},
									Q = () => {
										I.current &&
											A.current &&
											(I.current.currentTime = A.current.currentTime);
									},
									ee = (se) => {
										if (!!w.current)
											if (e.state.mouseOver && e.state.mouseDown) {
												let Fe = N.current / 2,
													ve = { x: se.pageX, y: se.pageY },
													Qe = -(
														(ve.x - w.current.getBoundingClientRect().left) *
															v.current -
														Fe
													),
													Ne = -(
														(ve.y - w.current.getBoundingClientRect().top) *
															v.current -
														Fe
													);
												l({ x: se.x - Fe, y: se.y - Fe }),
													u({ x: Qe, y: Ne }),
													m(1);
											} else m(0);
									},
									J = (se) => {
										e.state.mouseOver &&
											se.button === 0 &&
											((v.current = st.store.zoom),
											(N.current = st.store.size),
											document.getElementById("image-context") &&
												_.dispatch({ type: "CONTEXT_MENU_CLOSE" }),
											ee(se),
											m(1));
									},
									B = () => {
										m(0),
											st.store.saveZoomValues &&
												((st.store.zoom = v.current),
												(st.store.size = N.current));
									},
									ie = async (se) => {
										if (e.state.mouseOver && e.state.mouseDown && !y.current) {
											let Fe =
												v.current +
												(se.deltaY / 100) *
													(st.store.invertScroll ? -1 : 1) *
													st.store.zoomSpeed;
											(v.current = Fe <= 1 ? 1 : Fe), ee(se);
										}
										if (e.state.mouseOver && e.state.mouseDown && y.current) {
											let Fe =
												N.current +
												se.deltaY *
													(st.store.invertScroll ? -1 : 1) *
													st.store.zoomSpeed;
											(N.current = Fe <= 50 ? 50 : Fe), ee(se);
										}
									};
								return (
									$1(
										() => e.state.readyState === "READY",
										() => {
											let se = document.getElementById(ul);
											(w.current = se),
												se
													.querySelector("img,video")
													?.setAttribute("draggable", "false"),
												e.props.animated &&
													((A.current = se.querySelector("video")),
													A.current.addEventListener("timeupdate", Q)),
												i(!0);
										}
									),
									document.addEventListener("keydown", $),
									document.addEventListener("keyup", j),
									document.addEventListener("mousemove", ee),
									document.addEventListener("mousedown", J),
									document.addEventListener("mouseup", B),
									document.addEventListener("wheel", ie),
									() => {
										document.removeEventListener("keydown", $),
											document.removeEventListener("keyup", j),
											document.removeEventListener("mousemove", ee),
											document.removeEventListener("mousedown", J),
											document.removeEventListener("mouseup", B),
											document.removeEventListener("wheel", ie),
											st.store.saveZoomValues &&
												((st.store.zoom = v.current),
												(st.store.size = N.current));
									}
								);
							}, []),
							!r)
						)
							return null;
						let k = w.current?.getBoundingClientRect();
						return k
							? n(
									"div",
									{
										className: nk("lens", {
											"nearest-neighbor": st.store.nearestNeighbour,
											square: st.store.square,
										}),
										style: {
											opacity: p,
											width: N.current + "px",
											height: N.current + "px",
											transform: `translate(${s.x}px, ${s.y}px)`,
										},
									},
									e.props.animated
										? n("video", {
												ref: I,
												style: {
													position: "absolute",
													left: `${c.x}px`,
													top: `${c.y}px`,
												},
												width: `${k.width * v.current}px`,
												height: `${k.height * v.current}px`,
												poster: e.props.src,
												src: A.current?.src ?? e.props.src,
												autoPlay: !0,
												loop: !0,
												muted: !0,
											})
										: n("img", {
												ref: L,
												style: {
													position: "absolute",
													transform: `translate(${c.x}px, ${c.y}px)`,
												},
												width: `${k.width * v.current}px`,
												height: `${k.height * v.current}px`,
												src: e.props.src,
												alt: "",
											})
								)
							: null;
					},
					{ noop: !0 }
				));
		});
	var z1,
		Xx = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/imageZoom/styles.css",
				{
					name: "src/plugins/imageZoom/styles.css",
					source: `.vc-imgzoom-lens {
    position: absolute;
    inset: 0;
    z-index: 9999;
    border: 2px solid grey;
    border-radius: 50%;
    overflow: hidden;
    cursor: none;
    box-shadow: inset 0 0 10px 2px grey;
    filter: drop-shadow(0 0 2px grey);
    pointer-events: none;

    /* negate the border offsetting the lens */
    margin: -2px;
}

.vc-imgzoom-square {
    border-radius: 0;
}

.vc-imgzoom-nearest-neighbor>img {
    image-rendering: pixelated;

    /* https://googlechrome.github.io/samples/image-rendering-pixelated/index.html */
}

/* make the carousel take up less space so we can click the backdrop and exit out of it */
[class*="modalCarouselWrapper_"] {
    top: 0 !important;
}

[class*="carouselModal_"] {
    height: 0 !important;
}
`,
					classNames: {},
					dom: null,
				}
			);
			z1 = "src/plugins/imageZoom/styles.css";
		});
	var st,
		rk,
		Bp,
		H1 = g(() => {
			"use strict";
			a();
			F();
			tt();
			ns();
			fr();
			P();
			T();
			b();
			Qx();
			U1();
			Xx();
			(st = x({
				saveZoomValues: {
					type: 3,
					description: "Whether to save zoom and lens size values",
					default: !0,
				},
				invertScroll: { type: 3, description: "Invert scroll", default: !0 },
				nearestNeighbour: {
					type: 3,
					description:
						"Use Nearest Neighbour Interpolation when scaling images",
					default: !1,
				},
				square: { type: 3, description: "Make the lens square", default: !1 },
				zoom: {
					description: "Zoom of the lens",
					type: 5,
					markers: Bo(1, 50, 4),
					default: 2,
					stickToMarkers: !1,
				},
				size: {
					description: "Radius / Size of the lens",
					type: 5,
					markers: Bo(50, 1e3, 50),
					default: 100,
					stickToMarkers: !1,
				},
				zoomSpeed: {
					description: "How fast the zoom / lens size changes",
					type: 5,
					markers: Bo(0.1, 5, 0.2),
					default: 0.5,
					stickToMarkers: !1,
				},
			})),
				(rk = (e) => {
					let { square: t, nearestNeighbour: o } = st.use([
						"square",
						"nearestNeighbour",
					]);
					e.push(
						n(
							E.MenuGroup,
							{ id: "image-zoom" },
							n(E.MenuCheckboxItem, {
								id: "vc-square",
								label: "Square Lens",
								checked: t,
								action: () => {
									st.store.square = !t;
								},
							}),
							n(E.MenuCheckboxItem, {
								id: "vc-nearest-neighbour",
								label: "Nearest Neighbour",
								checked: o,
								action: () => {
									st.store.nearestNeighbour = !o;
								},
							}),
							n(E.MenuControlItem, {
								id: "vc-zoom",
								label: "Zoom",
								control: (r, i) =>
									n(E.MenuSliderControl, {
										ref: i,
										...r,
										minValue: 1,
										maxValue: 50,
										value: st.store.zoom,
										onChange: $t((s) => (st.store.zoom = s), 100),
									}),
							}),
							n(E.MenuControlItem, {
								id: "vc-size",
								label: "Lens Size",
								control: (r, i) =>
									n(E.MenuSliderControl, {
										ref: i,
										...r,
										minValue: 50,
										maxValue: 1e3,
										value: st.store.size,
										onChange: $t((s) => (st.store.size = s), 100),
									}),
							}),
							n(E.MenuControlItem, {
								id: "vc-zoom-speed",
								label: "Zoom Speed",
								control: (r, i) =>
									n(E.MenuSliderControl, {
										ref: i,
										...r,
										minValue: 0.1,
										maxValue: 5,
										value: st.store.zoomSpeed,
										onChange: $t((s) => (st.store.zoomSpeed = s), 100),
										renderValue: (s) => `${s.toFixed(3)}x`,
									}),
							})
						)
					);
				}),
				(Bp = h({
					name: "ImageZoom",
					description:
						"Lets you zoom in to images and gifs. Use scroll wheel to zoom in and shift + scroll wheel to increase lens radius / size",
					authors: [d.Aria],
					tags: ["ImageUtilities"],
					patches: [
						{
							find: "Messages.OPEN_IN_BROWSER",
							replacement: {
								match: /return.{1,200}\.wrapper.{1,200}src:\i,/g,
								replace: `$&id: '${ul}',`,
							},
						},
						{
							find: ".handleImageLoad)",
							replacement: [
								{
									match: /placeholderVersion:\i,(?=.{0,50}children:)/,
									replace: "...$self.makeProps(this),$&",
								},
								{
									match: /componentDidMount\(\){/,
									replace: "$&$self.renderMagnifier(this);",
								},
								{
									match: /componentWillUnmount\(\){/,
									replace: "$&$self.unMountMagnifier();",
								},
							],
						},
						{
							find: ".carouselModal",
							replacement: {
								match: /(?<=\.carouselModal.{0,100}onClick:)\i,/,
								replace: "()=>{},",
							},
						},
					],
					settings: st,
					contextMenus: { "image-context": rk },
					currentMagnifierElement: null,
					element: null,
					Magnifier: G1,
					root: null,
					makeProps(e) {
						return {
							onMouseOver: () => this.onMouseOver(e),
							onMouseOut: () => this.onMouseOut(e),
							onMouseDown: (t) => this.onMouseDown(t, e),
							onMouseUp: () => this.onMouseUp(e),
							id: e.props.id,
						};
					},
					renderMagnifier(e) {
						e.props.id === ul &&
							(this.currentMagnifierElement ||
								((this.currentMagnifierElement = n(G1, {
									size: st.store.size,
									zoom: st.store.zoom,
									instance: e,
								})),
								(this.root = ti.createRoot(this.element)),
								this.root.render(this.currentMagnifierElement)));
					},
					unMountMagnifier() {
						this.root?.unmount(),
							(this.currentMagnifierElement = null),
							(this.root = null);
					},
					onMouseOver(e) {
						e.setState((t) => ({ ...t, mouseOver: !0 }));
					},
					onMouseOut(e) {
						e.setState((t) => ({ ...t, mouseOver: !1 }));
					},
					onMouseDown(e, t) {
						e.button === 0 && t.setState((o) => ({ ...o, mouseDown: !0 }));
					},
					onMouseUp(e) {
						e.setState((t) => ({ ...t, mouseDown: !1 }));
					},
					start() {
						fo(z1),
							(this.element = document.createElement("div")),
							this.element.classList.add("MagnifierContainer"),
							document.body.appendChild(this.element);
					},
					stop() {
						_o(z1), this.root && this.root.unmount(), this.element?.remove();
					},
				}));
		});
	var Jx,
		Vx,
		Up,
		ew = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			U();
			b();
			(Jx = K("UserAffinitiesStore")),
				(Vx = x({
					sortByAffinity: {
						type: 3,
						default: !0,
						description:
							"Whether to sort implicit relationships by their affinity to you.",
						restartNeeded: !0,
					},
				})),
				(Up = h({
					name: "ImplicitRelationships",
					description: "Shows your implicit relationships in the Friends tab.",
					authors: [d.Dolfies],
					settings: Vx,
					patches: [
						{
							find: ".FRIENDS_ALL_HEADER",
							replacement: {
								match: /toString\(\)\}\);case (\i\.\i)\.BLOCKED/,
								replace:
									'toString()});case $1.IMPLICIT:return "Implicit \u2014 "+arguments[1];case $1.BLOCKED',
							},
						},
						{
							find: "FriendsEmptyState: Invalid empty state",
							replacement: {
								match: /case (\i\.\i)\.ONLINE:(?=return (\i)\.SECTION_ONLINE)/,
								replace: "case $1.ONLINE:case $1.IMPLICIT:",
							},
						},
						{
							find: ".FRIENDS_SECTION_ONLINE",
							replacement: {
								match:
									/(\(0,\i\.jsx\)\(\i\.TabBar\.Item,\{id:\i\.\i)\.BLOCKED,className:([^\s]+?)\.item,children:\i\.\i\.Messages\.BLOCKED\}\)/,
								replace:
									'$1.IMPLICIT,className:$2.item,children:"Implicit"}),$&',
							},
						},
						{
							find: '"FriendsStore"',
							replacement: {
								match:
									/(?<=case (\i\.\i)\.BLOCKED:return (\i)\.type===\i\.\i\.BLOCKED)/,
								replace: ";case $1.IMPLICIT:return $2.type===5",
							},
						},
						{
							find: '"FriendsStore',
							replacement: {
								match: /(\i\.\i)\.fetchRelationships\(\)/,
								replace:
									"$1.fetchRelationships(),$self.fetchImplicitRelationships()",
							},
						},
						{
							find: "getRelationshipCounts(){",
							replacement: {
								predicate: () => Vx.store.sortByAffinity,
								match: /\}\)\.sortBy\((.+?)\)\.value\(\)/,
								replace: "}).sortBy(row => $self.wrapSort(($1), row)).value()",
							},
						},
						{
							find: ".REQUEST_GUILD_MEMBERS",
							replacement: {
								match: /\.send\(8,{/,
								replace: "$&nonce:arguments[1].nonce,",
							},
						},
						{
							find: "GUILD_MEMBERS_REQUEST:",
							replacement: {
								match: /presences:!!(\i)\.presences/,
								replace: "$&,nonce:$1.nonce",
							},
						},
						{
							find: ".not_found",
							replacement: {
								match: /notFound:(\i)\.not_found/,
								replace: "$&,nonce:$1.nonce",
							},
						},
					],
					wrapSort(e, t) {
						return t.type === 5
							? -Jx.getUserAffinity(t.user.id)?.affinity
							: e(t);
					},
					async fetchImplicitRelationships() {
						let e = Jx.getUserAffinitiesUserIds(),
							t = Array.from(e).filter((m) => !Ie.getRelationshipType(m)),
							o = new Set(
								Object.values(oe.getSortedPrivateChannels()).flatMap(
									(m) => m.recipients
								)
							),
							r = t.filter((m) => !D.getUser(m) || o.has(m)),
							i = Object.keys(le.getGuilds()),
							s = Po.fromTimestamp(Date.now()),
							l = i.length * Math.ceil(r.length / 100),
							c = new Set(r),
							u = Ie.getRelationships(),
							p = ({ chunks: m }) => {
								for (let y of m) {
									let { nonce: v, members: N } = y;
									if (v !== s) return;
									N.forEach((w) => {
										c.delete(w.user.id);
									}),
										t
											.map((w) => D.getUser(w))
											.filter((w) => w && !c.has(w.id))
											.forEach((w) => (u[w.id] = 5)),
										Ie.emitChange(),
										--l === 0 && _.unsubscribe("GUILD_MEMBERS_CHUNK_BATCH", p);
								}
							};
						_.subscribe("GUILD_MEMBERS_CHUNK_BATCH", p);
						for (let m = 0; m < r.length; m += 100)
							_.dispatch({
								type: "GUILD_MEMBERS_REQUEST",
								guildIds: i,
								userIds: r.slice(m, m + 100),
								nonce: s,
							});
					},
					start() {
						bt.FriendsSections.IMPLICIT = "IMPLICIT";
					},
				}));
		});
	function tw(e, t) {
		!oe.hasChannel(t) || en.transitionTo(`/channels/${e ?? "@me"}/${t}`);
	}
	var $p,
		Ko,
		Gp,
		ow = g(() => {
			"use strict";
			a();
			$o();
			P();
			T();
			b();
			$p = !1;
			Gp = h({
				name: "KeepCurrentChannel",
				description:
					"Attempt to navigate to the channel you were in before switching accounts or loading Discord.",
				authors: [d.Nuckyz],
				flux: {
					LOGOUT(e) {
						({ isSwitchingAccount: $p } = e);
					},
					CONNECTION_OPEN() {
						!$p || (($p = !1), Ko?.channelId && tw(Ko.guildId, Ko.channelId));
					},
					async CHANNEL_SELECT({ guildId: e, channelId: t }) {
						$p ||
							((Ko = { guildId: e, channelId: t }),
							await wt("KeepCurrentChannel_previousData", Ko));
					},
				},
				async start() {
					(Ko = await lt("KeepCurrentChannel_previousData")),
						Ko
							? Ko.channelId && tw(Ko.guildId, Ko.channelId)
							: ((Ko = {
									guildId: to.getGuildId(),
									channelId: xe.getChannelId() ?? null,
								}),
								await wt("KeepCurrentChannel_previousData", Ko));
				},
			});
		});
	async function W1(e) {
		return (await ii.fetchAssetIds(j1, [e]))[0];
	}
	function ak(e) {
		_.dispatch({
			type: "LOCAL_ACTIVITY_UPDATE",
			activity: e,
			socketId: "LastFM",
		});
	}
	var j1,
		ik,
		nw,
		sk,
		bo,
		Hp,
		rw = g(() => {
			"use strict";
			a();
			F();
			no();
			P();
			De();
			T();
			U();
			b();
			(j1 = "1108588077900898414"),
				(ik = "2a96cbd8b46e442fc41c2b86b821562f"),
				(nw = new V("LastFMRichPresence")),
				(sk = K("SelfPresenceStore"));
			(bo = x({
				username: { description: "last.fm username", type: 0 },
				apiKey: { description: "last.fm api key", type: 0 },
				shareUsername: {
					description: "show link to last.fm profile",
					type: 3,
					default: !1,
				},
				shareSong: {
					description: "show link to song on last.fm",
					type: 3,
					default: !0,
				},
				hideWithSpotify: {
					description: "hide last.fm presence if spotify is running",
					type: 3,
					default: !0,
				},
				statusName: {
					description: "custom status text",
					type: 0,
					default: "some music",
				},
				nameFormat: {
					description: "Show name of song and artist in status name",
					type: 4,
					options: [
						{
							label: "Use custom status name",
							value: "status-name",
							default: !0,
						},
						{ label: "Use format 'artist - song'", value: "artist-first" },
						{ label: "Use format 'song - artist'", value: "song-first" },
						{ label: "Use artist name only", value: "artist" },
						{ label: "Use song name only", value: "song" },
						{
							label:
								"Use album name (falls back to custom status text if song has no album)",
							value: "album",
						},
					],
				},
				useListeningStatus: {
					description: 'show "Listening to" status instead of "Playing"',
					type: 3,
					default: !1,
				},
				missingArt: {
					description: "When album or album art is missing",
					type: 4,
					options: [
						{
							label: "Use large Last.fm logo",
							value: "lastfmLogo",
							default: !0,
						},
						{ label: "Use generic placeholder", value: "placeholder" },
					],
				},
				showLastFmLogo: {
					description: "show the Last.fm logo by the album cover",
					type: 3,
					default: !0,
				},
			})),
				(Hp = h({
					name: "LastFMRichPresence",
					description: "Little plugin for Last.fm rich presence",
					authors: [d.dzshn, d.RuiNtD, d.blahajZip, d.archeruwu],
					settingsAboutComponent: () =>
						n(
							f,
							null,
							n(S.FormTitle, { tag: "h3" }, "How to get an API key"),
							n(
								S.FormText,
								null,
								"An API key is required to fetch your current track. To get one, you can visit ",
								n(
									He,
									{ href: "https://www.last.fm/api/account/create" },
									"this page"
								),
								" and fill in the following information: ",
								n("br", null),
								" ",
								n("br", null),
								"Application name: Discord Rich Presence ",
								n("br", null),
								"Application description: (personal use) ",
								n("br", null),
								" ",
								n("br", null),
								"And copy the API key (not the shared secret!)"
							)
						),
					settings: bo,
					start() {
						this.updatePresence(),
							(this.updateInterval = setInterval(() => {
								this.updatePresence();
							}, 16e3));
					},
					stop() {
						clearInterval(this.updateInterval);
					},
					async fetchTrackData() {
						if (!bo.store.username || !bo.store.apiKey) return null;
						try {
							let e = new URLSearchParams({
									method: "user.getrecenttracks",
									api_key: bo.store.apiKey,
									user: bo.store.username,
									limit: "1",
									format: "json",
								}),
								t = await fetch(`https://ws.audioscrobbler.com/2.0/?${e}`);
							if (!t.ok) throw `${t.status} ${t.statusText}`;
							let o = await t.json();
							if (o.error)
								return (
									nw.error(
										"Error from Last.fm API",
										`${o.error}: ${o.message}`
									),
									null
								);
							let r = o.recenttracks?.track[0];
							return r?.["@attr"]?.nowplaying
								? {
										name: r.name || "Unknown",
										album: r.album["#text"],
										artist: r.artist["#text"] || "Unknown",
										url: r.url,
										imageUrl: r.image?.find((i) => i.size === "large")?.[
											"#text"
										],
									}
								: null;
						} catch (e) {
							return nw.error("Failed to query Last.fm API", e), null;
						}
					},
					async updatePresence() {
						ak(await this.getActivity());
					},
					getLargeImage(e) {
						if (e.imageUrl && !e.imageUrl.includes(ik)) return e.imageUrl;
						if (bo.store.missingArt === "placeholder") return "placeholder";
					},
					async getActivity() {
						if (bo.store.hideWithSpotify) {
							for (let s of sk.getActivities())
								if (s.type === 2 && s.application_id !== j1) return null;
						}
						let e = await this.fetchTrackData();
						if (!e) return null;
						let t = this.getLargeImage(e),
							o = t
								? {
										large_image: await W1(t),
										large_text: e.album || void 0,
										...(bo.store.showLastFmLogo && {
											small_image: await W1("lastfm-small"),
											small_text: "Last.fm",
										}),
									}
								: {
										large_image: await W1("lastfm-large"),
										large_text: e.album || void 0,
									},
							r = [];
						bo.store.shareUsername &&
							r.push({
								label: "Last.fm Profile",
								url: `https://www.last.fm/user/${bo.store.username}`,
							}),
							bo.store.shareSong && r.push({ label: "View Song", url: e.url });
						let i = (() => {
							switch (bo.store.nameFormat) {
								case "artist-first":
									return e.artist + " - " + e.name;
								case "song-first":
									return e.name + " - " + e.artist;
								case "artist":
									return e.artist;
								case "song":
									return e.name;
								case "album":
									return e.album || bo.store.statusName;
								default:
									return bo.store.statusName;
							}
						})();
						return {
							application_id: j1,
							name: i,
							details: e.name,
							state: e.artist,
							assets: o,
							buttons: r.length ? r.map((s) => s.label) : void 0,
							metadata: { button_urls: r.map((s) => s.url) },
							type: bo.store.useListeningStatus ? 2 : 0,
							flags: 1,
						};
					},
				}));
		});
	var iw,
		sw = g(() => {
			a();
			iw = `# Blank lines and lines starting with "#" are ignored

Explode
Read if cute
Have a nice day!
Starting Lightcord...
Loading 0BDFDB.plugin.js...
Installing BetterDiscord...
h
shhhhh did you know that you're my favourite user? But don't tell the others!!
Today's video is sponsored by Raid Shadow Legends, one of the biggest mobile role-playing games of 2019 and it's totally free!
Never gonna give you up, Never gonna let you down
( \u0361\xB0 \u035C\u0296 \u0361\xB0)
(\uFF89\u25D5\u30EE\u25D5)\uFF89*:\uFF65\uFF9F\u2727
You look so pretty today!
Thinking of a funny quote...
3.141592653589793
meow
Welcome, friend
If you, or someone you love, has Ligma, please see the Ligma health line at https://bit.ly/ligma_hotline
Trans Rights
I\u2019d just like to interject for a moment. What you\u2019re refering to as Linux, is in fact, GNU/Linux, or as I\u2019ve recently taken to calling it, GNU plus Linux.
You're doing good today!
Don't worry, it's nothing 9 cups of coffee couldn't solve!
\uFFFD(repeat like 30 times)
a light amount of tomfoolery is okay
do you love?
horror
so eepy
So without further ado, let's just jump right into it!
Dying is absolutely safe
hey you! you're cute :))
heya ~
<:trolley:997086295010594867>
Time is gone, space is insane. Here it comes, here again.
sometimes it's okay to just guhhhhhhhhhhhhhh
Welcome to nginx!`;
		});
	var lk,
		ck,
		q1,
		zp,
		aw = g(() => {
			"use strict";
			a();
			F();
			P();
			De();
			T();
			sw();
			(lk = iw
				.split(
					`
`
				)
				.map((e) => /^\s*[^#\s]/.test(e) && e.trim())
				.filter(Boolean)),
				(ck =
					"Did you really disable all loading quotes? What a buffoon you are..."),
				(q1 = x({
					replaceEvents: {
						description:
							"Should this plugin also apply during events with special event themed quotes? (e.g. Halloween)",
						type: 3,
						default: !0,
					},
					enablePluginPresetQuotes: {
						description: "Enable the quotes preset by this plugin",
						type: 3,
						default: !0,
					},
					enableDiscordPresetQuotes: {
						description:
							"Enable Discord's preset quotes (including event quotes, during events)",
						type: 3,
						default: !1,
					},
					additionalQuotes: {
						description:
							"Additional custom quotes to possibly appear, separated by the below delimiter",
						type: 0,
						default: "",
					},
					additionalQuotesDelimiter: {
						description: "Delimiter for additional quotes",
						type: 0,
						default: "|",
					},
				})),
				(zp = h({
					name: "LoadingQuotes",
					description: "Replace Discords loading quotes",
					authors: [d.Ven, d.KraXen72, d.UlyssesZhan],
					settings: q1,
					patches: [
						{
							find: ".LOADING_DID_YOU_KNOW",
							replacement: [
								{
									match: /"_loadingText".+?(?=(\i)\[.{0,10}\.random)/,
									replace: "$&$self.mutateQuotes($1),",
								},
								{
									match: /"_eventLoadingText".+?(?=(\i)\[.{0,10}\.random)/,
									replace: "$&$self.mutateQuotes($1),",
									predicate: () => q1.store.replaceEvents,
								},
							],
						},
					],
					mutateQuotes(e) {
						try {
							let {
								enableDiscordPresetQuotes: t,
								additionalQuotes: o,
								additionalQuotesDelimiter: r,
								enablePluginPresetQuotes: i,
							} = q1.store;
							t || (e.length = 0),
								i && e.push(...lk),
								e.push(...o.split(r).filter(Boolean)),
								e.length || e.push(ck);
						} catch (t) {
							new V("LoadingQuotes").error("Failed to mutate quotes", t);
						}
					},
				}));
		});
	var lw = g(() => {});
	var Wp,
		cw = g(() => {
			"use strict";
			a();
			co();
			me();
			di();
			b();
			Wp = Dt(() => {
				let e = new Oo(),
					t = new Map();
				class o extends oi.Store {
					getCount(i) {
						return t.get(i);
					}
					async _ensureCount(i) {
						t.has(i) || (await sa.preload(i, yr.getDefaultChannel(i).id));
					}
					ensureCount(i) {
						t.has(i) ||
							e.push(() =>
								this._ensureCount(i).then(
									() => Xo(200),
									() => Xo(200)
								)
							);
					}
				}
				return new o(_, {
					GUILD_MEMBER_LIST_UPDATE({ guildId: r, groups: i }) {
						t.set(
							r,
							i.reduce((s, l) => s + (l.id === "offline" ? 0 : l.count), 0)
						);
					},
					ONLINE_GUILD_MEMBER_COUNT_UPDATE({ guildId: r, count: i }) {
						t.set(r, i);
					},
				});
			});
		});
	function Q1({ isTooltip: e, tooltipGuildId: t }) {
		let o = Oe([xe], () => fn()),
			r = e ? t : o.guild_id,
			i = Oe([K1], () => K1.getMemberCount(r)),
			s = Oe([Wp], () => Wp.getCount(r)),
			{ groups: l } = Oe([Y1], () => Y1.getProps(r, o?.id)),
			c = Oe([Z1], () => Z1.getMemberListSections(o.id));
		if (
			(!e &&
				(l.length >= 1 || l[0].id !== "unknown") &&
				(s = l.reduce((p, m) => p + (m.id === "offline" ? 0 : m.count), 0)),
			!e &&
				c &&
				!jr(c) &&
				(s = Object.values(c).reduce(
					(p, m) => p + (m.sectionId === "offline" ? 0 : m.userIds.length),
					0
				)),
			ue(() => {
				Wp.ensureCount(r);
			}, [r]),
			i == null)
		)
			return null;
		let u = s != null ? jp(s) : "?";
		return n(
			"div",
			{ className: Ts("widget", { tooltip: e, "member-list": !e }) },
			n(te, { text: `${u} online in this channel`, position: "bottom" }, (p) =>
				n(
					"div",
					{ ...p },
					n("span", { className: Ts("online-dot") }),
					n("span", { className: Ts("online") }, u)
				)
			),
			n(
				te,
				{ text: `${jp(i)} total server members`, position: "bottom" },
				(p) =>
					n(
						"div",
						{ ...p },
						n("span", { className: Ts("total-dot") }),
						n("span", { className: Ts("total") }, jp(i))
					)
			)
		);
	}
	var uw = g(() => {
		"use strict";
		a();
		it();
		me();
		b();
		X1();
		cw();
	});
	var K1,
		Y1,
		Z1,
		J1,
		uk,
		jp,
		Ts,
		qp,
		X1 = g(() => {
			"use strict";
			a();
			lw();
			F();
			tt();
			re();
			P();
			T();
			U();
			uw();
			(K1 = K("GuildMemberCountStore")),
				(Y1 = K("ChannelMemberStore")),
				(Z1 = K("ThreadMemberListStore")),
				(J1 = x({
					toolTip: {
						type: 3,
						description:
							"If the member count should be displayed on the server tooltip",
						default: !0,
						restartNeeded: !0,
					},
					memberList: {
						type: 3,
						description:
							"If the member count should be displayed on the member list",
						default: !0,
						restartNeeded: !0,
					},
				})),
				(uk = new Intl.NumberFormat()),
				(jp = (e) => uk.format(e)),
				(Ts = be("vc-membercount-")),
				(qp = h({
					name: "MemberCount",
					description:
						"Shows the amount of online & total members in the server member list and tooltip",
					authors: [d.Ven, d.Commandtechno],
					settings: J1,
					patches: [
						{
							find: "{isSidebarVisible:",
							replacement: {
								match:
									/(?<=let\{className:(\i),.+?children):\[(\i\.useMemo[^}]+"aria-multiselectable")/,
								replace: ":[$1?.startsWith('members')?$self.render():null,$2",
							},
							predicate: () => J1.store.memberList,
						},
						{
							find: ".invitesDisabledTooltip",
							replacement: {
								match: /\.VIEW_AS_ROLES_MENTIONS_WARNING.{0,100}(?=])/,
								replace: "$&,$self.renderTooltip(arguments[0].guild)",
							},
							predicate: () => J1.store.toolTip,
						},
					],
					render: R.wrap(Q1, { noop: !0 }),
					renderTooltip: R.wrap(
						(e) => n(Q1, { isTooltip: !0, tooltipGuildId: e.id }),
						{ noop: !0 }
					),
				}));
		});
	var pw = g(() => {});
	function dw(e) {
		return mw.store.showAtSymbol ? `@${e}` : e;
	}
	var mw,
		Kp,
		fw = g(() => {
			"use strict";
			a();
			pw();
			F();
			re();
			P();
			T();
			b();
			(mw = x({
				showAtSymbol: {
					type: 3,
					description: "Whether the the @ symbol should be displayed",
					default: !0,
				},
			})),
				(Kp = h({
					name: "MentionAvatars",
					description: "Shows user avatars inside mentions",
					authors: [d.Ven],
					patches: [
						{
							find: ".USER_MENTION)",
							replacement: {
								match:
									/children:"@"\.concat\((null!=\i\?\i:\i)\)(?<=\.useName\((\i)\).+?)/,
								replace: "children:$self.renderUsername({username:$1,user:$2})",
							},
						},
					],
					settings: mw,
					renderUsername: R.wrap(
						(e) => {
							let { user: t, username: o } = e,
								[r, i] = z(!1);
							return t
								? n(
										"span",
										{ onMouseEnter: () => i(!0), onMouseLeave: () => i(!1) },
										n("img", {
											src: t.getAvatarURL(to.getGuildId(), 16, r),
											className: "vc-mentionAvatars-avatar",
										}),
										dw(o)
									)
								: n(f, null, dw(o));
						},
						{ noop: !0 }
					),
				}));
		});
	var gw,
		pk,
		V1,
		hw,
		yw,
		xs,
		Yp,
		vw = g(() => {
			"use strict";
			a();
			Sn();
			F();
			P();
			T();
			U();
			b();
			(gw = C("deleteMessage", "startEditMessage")),
				(pk = K("EditMessageStore")),
				(V1 = !1),
				(hw = (e) => e.key === "Backspace" && (V1 = !0)),
				(yw = (e) => e.key === "Backspace" && (V1 = !1)),
				(xs = x({
					enableDeleteOnClick: {
						type: 3,
						description: "Enable delete on click while holding backspace",
						default: !0,
					},
					enableDoubleClickToEdit: {
						type: 3,
						description: "Enable double click to edit",
						default: !0,
					},
					enableDoubleClickToReply: {
						type: 3,
						description: "Enable double click to reply",
						default: !0,
					},
					requireModifier: {
						type: 3,
						description: "Only do double click actions when shift/ctrl is held",
						default: !1,
					},
				})),
				(Yp = h({
					name: "MessageClickActions",
					description:
						"Hold Backspace and click to delete, double click to edit/reply",
					authors: [d.Ven],
					dependencies: ["MessageEventsAPI"],
					settings: xs,
					start() {
						document.addEventListener("keydown", hw),
							document.addEventListener("keyup", yw),
							(this.onClick = e1((e, t, o) => {
								let r = e.author.id === D.getCurrentUser().id;
								if (V1)
									xs.store.enableDeleteOnClick &&
										(r || qe.can(we.MANAGE_MESSAGES, t)) &&
										(e.deleted
											? _.dispatch({
													type: "MESSAGE_DELETE",
													channelId: t.id,
													id: e.id,
													mlDeleted: !0,
												})
											: gw.deleteMessage(t.id, e.id),
										o.preventDefault());
								else {
									if (
										o.detail < 2 ||
										(xs.store.requireModifier && !o.ctrlKey && !o.shiftKey) ||
										(t.guild_id && !qe.can(we.SEND_MESSAGES, t)) ||
										e.deleted === !0
									)
										return;
									if (r) {
										if (
											!xs.store.enableDoubleClickToEdit ||
											pk.isEditing(t.id, e.id)
										)
											return;
										gw.startEditMessage(t.id, e.id, e.content),
											o.preventDefault();
									} else {
										if (!xs.store.enableDoubleClickToReply) return;
										let i = 64;
										if (e.hasFlag(i)) return;
										let s = o.shiftKey && !xs.store.requireModifier,
											l = Vencord.Plugins.plugins.NoReplyMention,
											c = Vencord.Plugins.isPluginEnabled("NoReplyMention")
												? l.shouldMention(e, s)
												: !s;
										_.dispatch({
											type: "CREATE_PENDING_REPLY",
											channel: t,
											message: e,
											shouldMention: c,
											showMentionToggle: t.guild_id !== null,
										});
									}
								}
							}));
					},
					stop() {
						t1(this.onClick),
							document.removeEventListener("keydown", hw),
							document.removeEventListener("keyup", yw);
					},
				}));
		});
	var Sw,
		dk,
		Zp,
		bw = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			Yi();
			T();
			U();
			b();
			(Sw = 1471228928),
				(dk = po("HiddenVisually")),
				(Zp = h({
					name: "MessageLatency",
					description:
						"Displays an indicator for messages that took \u2265n seconds to send",
					authors: [d.arHSM],
					settings: x({
						latency: {
							type: 1,
							description: "Threshold in seconds for latency indicator",
							default: 2,
						},
						detectDiscordKotlin: {
							type: 3,
							description: "Detect old Discord Android clients",
							default: !0,
						},
						showMillis: {
							type: 3,
							description: "Show milliseconds",
							default: !1,
						},
					}),
					patches: [
						{
							find: "showCommunicationDisabledStyles",
							replacement: {
								match:
									/(message:(\i),avatar:\i,username:\(0,\i.jsxs\)\(\i.Fragment,\{children:\[)(\i&&)/,
								replace: "$1$self.Tooltip()({ message: $2 }),$3",
							},
						},
					],
					stringDelta(e, t) {
						let o = {
								days: Math.round(e / 864e5),
								hours: Math.round((e / 36e5) % 24),
								minutes: Math.round((e / 6e4) % 60),
								seconds: Math.round((e / 1e3) % 60),
								milliseconds: Math.round(e % 1e3),
							},
							r = (l) =>
								o[l] > 0
									? `${o[l]} ${o[l] > 1 ? l : l.substring(0, l.length - 1)}`
									: null;
						return (
							Object.keys(o).reduce((l, c) => {
								let u = r(c);
								return (
									l +
									(En(u)
										? (l !== ""
												? (t ? c === "milliseconds" : c === "seconds")
													? " and "
													: " "
												: "") + u
										: "")
								);
							}, "") || "0 seconds"
						);
					},
					latencyTooltipData(e) {
						let {
								latency: t,
								detectDiscordKotlin: o,
								showMillis: r,
							} = this.settings.store,
							{ id: i, nonce: s } = e;
						if (!En(s) || e.bot) return null;
						let l = !1,
							c = Po.extractTimestamp(i) - Po.extractTimestamp(s);
						r || (c = Math.round(c / 1e3) * 1e3),
							-c >= Sw - 864e5 && ((l = o), (c += Sw));
						let u = Math.abs(c),
							p = u !== c,
							m = t * 1e3,
							y = u >= m ? this.stringDelta(u, r) : null,
							v = 2 * 60 * 1e3,
							N = l
								? ["status-positive", "status-positive", "text-muted"]
								: c >= v || p
									? ["text-muted", "text-muted", "text-muted"]
									: c >= m * 2
										? ["status-danger", "text-muted", "text-muted"]
										: ["status-warning", "status-warning", "text-muted"];
						return u >= m || l
							? { delta: y, ahead: p, fill: N, isDiscordKotlin: l }
							: null;
					},
					Tooltip() {
						return R.wrap(({ message: e }) => {
							let t = this.latencyTooltipData(e);
							if (!En(t)) return null;
							let o;
							return (
								t.delta
									? (o =
											(t.ahead
												? `This user's clock is ${t.delta} ahead.`
												: `This message was sent with a delay of ${t.delta}.`) +
											(t.isDiscordKotlin
												? " User is suspected to be on an old Discord Android client."
												: ""))
									: (o =
											"User is suspected to be on an old Discord Android client"),
								n(te, { text: o, position: "top" }, (r) =>
									n(
										f,
										null,
										n(this.Icon, { delta: t.delta, fill: t.fill, props: r }),
										n(dk, null, "Delayed Message")
									)
								)
							);
						});
					},
					Icon({ delta: e, fill: t, props: o }) {
						return n(
							"svg",
							{
								xmlns: "http://www.w3.org/2000/svg",
								viewBox: "0 0 16 16",
								width: "12",
								height: "12",
								role: "img",
								fill: "none",
								style: { marginRight: "8px", verticalAlign: -1 },
								"aria-label": e ?? "Old Discord Android client",
								"aria-hidden": "false",
								...o,
							},
							n("path", {
								fill: `var(--${t[0]})`,
								d: "M4.8001 12C4.8001 11.5576 4.51344 11.2 4.16023 11.2H2.23997C1.88676 11.2 1.6001 11.5576 1.6001 12V13.6C1.6001 14.0424 1.88676 14.4 2.23997 14.4H4.15959C4.5128 14.4 4.79946 14.0424 4.79946 13.6L4.8001 12Z",
							}),
							n("path", {
								fill: `var(--${t[1]})`,
								d: "M9.6001 7.12724C9.6001 6.72504 9.31337 6.39998 8.9601 6.39998H7.0401C6.68684 6.39998 6.40011 6.72504 6.40011 7.12724V13.6727C6.40011 14.0749 6.68684 14.4 7.0401 14.4H8.9601C9.31337 14.4 9.6001 14.0749 9.6001 13.6727V7.12724Z",
							}),
							n("path", {
								fill: `var(--${t[2]})`,
								d: "M14.4001 2.31109C14.4001 1.91784 14.1134 1.59998 13.7601 1.59998H11.8401C11.4868 1.59998 11.2001 1.91784 11.2001 2.31109V13.6888C11.2001 14.0821 11.4868 14.4 11.8401 14.4H13.7601C14.1134 14.4 14.4001 14.0821 14.4001 13.6888V2.31109Z",
							})
						);
					},
				}));
		});
	var ey = {};
	et(ey, { updateMessage: () => pl });
	function pl(e, t, o) {
		let r = uc.getOrCreate(e);
		if (!r.has(t)) return;
		let i = r.update(t, (s) => (o ? s.merge(o) : new s.constructor(s)));
		uc.commit(i), jt.emitChange();
	}
	var Qp = g(() => {
		"use strict";
		a();
		b();
	});
	async function yk(e, t) {
		let o = ws.get(t);
		if (o) return o.message;
		ws.set(t, { fetched: !1 });
		let i = (
			await Pt.get({
				url: bt.Endpoints.MESSAGES(e),
				query: { limit: 1, around: t },
				retries: 2,
			}).catch(() => null)
		)?.body?.[0];
		if (!i) return;
		let s = jt.getMessages(i.channel_id).receiveMessage(i).get(i.id);
		if (!!s) return ws.set(s.id, { message: s, fetched: !0 }), s;
	}
	function vk(e) {
		let t = [];
		for (let {
			content_type: o,
			height: r,
			width: i,
			url: s,
			proxy_url: l,
		} of e.attachments ?? [])
			o?.startsWith("image/") &&
				t.push({ height: r, width: i, url: s, proxyURL: l });
		for (let { type: o, image: r, thumbnail: i, url: s } of e.embeds ?? [])
			o === "image"
				? t.push({ ...(r ?? i) })
				: s &&
					o === "gifv" &&
					!ww.test(s) &&
					t.push({ height: i.height, width: i.width, url: s });
		return t;
	}
	function Sk(e, t) {
		return !e && !t
			? ""
			: e
				? t
					? `[no content, ${e} attachment${e !== 1 ? "s" : ""} and ${t} embed${t !== 1 ? "s" : ""}]`
					: `[no content, ${e} attachment${e !== 1 ? "s" : ""}]`
				: `[no content, ${t} embed${t !== 1 ? "s" : ""}]`;
	}
	function bk(e) {
		return !!(
			e.components.length ||
			e.attachments.some((t) => !t.content_type?.startsWith("image/")) ||
			e.embeds.some(
				(t) => t.type !== "image" && (t.type !== "gifv" || ww.test(t.url))
			)
		);
	}
	function Tk(e, t) {
		if (e > t) {
			let s = Math.min(e, 400);
			return { width: s, height: Math.round(t / (e / s)) };
		}
		let i = Math.min(t, 300);
		return { width: Math.round(e / (t / i)), height: i };
	}
	function xk(e, t) {
		return new Proxy(e, {
			get(o, r, i) {
				return r === "vencordEmbeddedBy" ? t : Reflect.get(o, r, i);
			},
		});
	}
	function wk({ message: e }) {
		let t = e.vencordEmbeddedBy ?? [],
			o = [];
		for (let [r, i, s] of e.content.matchAll(oy)) {
			if (t.includes(s) || t.length > 2) continue;
			let l = oe.getChannel(i);
			if (!l || (!l.isPrivate() && !qe.can(we.VIEW_CHANNEL, l))) continue;
			let { listMode: c, idList: u } = Xp.store,
				p = [l.guild_id, i, e.author.id].some((N) => N && u.includes(N));
			if ((c === "blacklist" && p) || (c === "whitelist" && !p)) continue;
			let m = ws.get(s)?.message;
			if (!m)
				if (((m ??= jt.getMessage(i, s)), m))
					ws.set(s, { message: m, fetched: !0 });
				else {
					hk.unshift(() => yk(i, s).then((N) => N && pl(e.channel_id, e.id)));
					continue;
				}
			let y = { message: xk(m, [...t, e.id]), channel: l },
				v = Xp.store.automodEmbeds;
			o.push(
				v === "always" || (v === "prefer" && !bk(m))
					? n(Mk, { ...y })
					: n(Pk, { ...y })
			);
		}
		return o.length ? n(f, null, o) : null;
	}
	function Pw(e) {
		return e.isDM()
			? ["Direct Message", Rt.getUserAvatarURL(D.getUser(e.recipients[0]))]
			: e.isGroupDM()
				? ["Group DM", Rt.getChannelIconURL(e)]
				: ["Server", Rt.getGuildIconURL(le.getGuild(e.guild_id))];
	}
	function Pk({ message: e, channel: t }) {
		let o = xw.useSetting(),
			r = D.getUser(oe.getChannel(t.id).recipients?.[0]),
			[i, s] = Pw(t);
		return n(mk, {
			embed: {
				rawDescription: "",
				color: "var(--background-secondary)",
				author: {
					name: n(
						Z,
						{ variant: "text-xs/medium", tag: "span" },
						n("span", null, i, " - "),
						Ce.parse(t.isDM() ? `<@${r.id}>` : `<#${t.id}>`)
					),
					iconProxyURL: s,
				},
			},
			renderDescription: () =>
				n(
					"div",
					{
						key: e.id,
						className: H(
							Tw.message,
							Xp.store.messageBackgroundColor && Tw.searchResult
						),
					},
					n(gk, {
						id: `message-link-embeds-${e.id}`,
						message: e,
						channel: t,
						subscribeToComponentDispatch: !1,
						compact: o,
					})
				),
		});
	}
	function Mk(e) {
		let { message: t, channel: o } = e,
			r = xw.useSetting(),
			i = vk(t),
			{ parse: s } = Ce,
			[l, c] = Pw(o);
		return n(fk, {
			channel: o,
			childrenAccessories: n(
				Z,
				{
					color: "text-muted",
					variant: "text-xs/medium",
					tag: "span",
					className: `${ty.embedAuthor} ${ty.embedMargin}`,
				},
				c && n("img", { src: c, className: ty.embedAuthorIcon, alt: "" }),
				n(
					"span",
					null,
					n("span", null, l, " - "),
					o.isDM()
						? Ce.parse(`<@${oe.getChannel(o.id).recipients[0]}>`)
						: Ce.parse(`<#${o.id}>`)
				)
			),
			compact: r,
			content: n(
				f,
				null,
				t.content || t.attachments.length <= i.length
					? s(t.content)
					: [Sk(t.attachments.length, t.embeds.length)],
				i.map((u) => {
					let { width: p, height: m } = Tk(u.width, u.height);
					return n("div", null, n("img", { src: u.url, width: p, height: m }));
				})
			),
			hideTimestamp: !1,
			message: t,
			_messageEmbed: "automod",
		});
	}
	var ws,
		mk,
		fk,
		gk,
		Tw,
		ty,
		xw,
		oy,
		ww,
		hk,
		Xp,
		Jp,
		Mw = g(() => {
			"use strict";
			a();
			Xa();
			Qp();
			F();
			Ir();
			re();
			P();
			me();
			di();
			T();
			U();
			b();
			(ws = new Map()),
				(mk = ae(".inlineMediaEmbed")),
				(fk = ae(".withFooter]:", "childrenMessageContent:")),
				(gk = ae("childrenExecutedCommand:", ".hideAccessories")),
				(Tw = C("message", "searchResult")),
				(ty = C("embedAuthorIcon", "embedAuthor", "embedAuthor")),
				(xw = Uo("textAndImages", "messageDisplayCompact")),
				(oy =
					/(?<!<)https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/g),
				(ww = /^https:\/\/(?:www\.)?tenor\.com\//),
				(hk = new Oo()),
				(Xp = x({
					messageBackgroundColor: {
						description: "Background color for messages in rich embeds",
						type: 3,
					},
					automodEmbeds: {
						description:
							"Use automod embeds instead of rich embeds (smaller but less info)",
						type: 4,
						options: [
							{ label: "Always use automod embeds", value: "always" },
							{
								label:
									"Prefer automod embeds, but use rich embeds if some content can't be shown",
								value: "prefer",
							},
							{
								label: "Never use automod embeds",
								value: "never",
								default: !0,
							},
						],
					},
					listMode: {
						description: "Whether to use ID list as blacklist or whitelist",
						type: 4,
						options: [
							{ label: "Blacklist", value: "blacklist", default: !0 },
							{ label: "Whitelist", value: "whitelist" },
						],
					},
					idList: {
						description:
							"Guild/channel/user IDs to blacklist or whitelist (separate with comma)",
						type: 0,
						default: "",
					},
					clearMessageCache: {
						type: 6,
						description: "Clear the linked message cache",
						component: () =>
							n(
								M,
								{ onClick: () => ws.clear() },
								"Clear the linked message cache"
							),
					},
				}));
			Jp = h({
				name: "MessageLinkEmbeds",
				description: "Adds a preview to messages that link another message",
				authors: [d.TheSun, d.Ven, d.RyanCaoDev],
				dependencies: [
					"MessageAccessoriesAPI",
					"MessageUpdaterAPI",
					"UserSettingsAPI",
				],
				settings: Xp,
				start() {
					bi(
						"messageLinkEmbed",
						(e) =>
							oy.test(e.message.content)
								? ((oy.lastIndex = 0),
									n(R, null, n(wk, { message: e.message })))
								: null,
						4
					);
				},
				stop() {
					Qa("messageLinkEmbed");
				},
			});
		});
	var Iw = g(() => {});
	var ny,
		Cw = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/messageLogger/deleteStyleOverlay.css",
				{
					name: "src/plugins/messageLogger/deleteStyleOverlay.css",
					source: `.messagelogger-deleted {
    background-color: hsla(var(--red-430-hsl, 0 85% 61%) / 15%) !important;
}
`,
					classNames: {},
					dom: null,
				}
			);
			ny = "src/plugins/messageLogger/deleteStyleOverlay.css";
		});
	var ry,
		Aw = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/messageLogger/deleteStyleText.css",
				{
					name: "src/plugins/messageLogger/deleteStyleText.css",
					source: `/* Message content highlighting */
.messagelogger-deleted [class*="contents"] > :is(div, h1, h2, h3, p) {
    color: var(--status-danger, #f04747) !important;
}

/* Markdown title highlighting */
.messagelogger-deleted [class*="contents"] :is(h1, h2, h3) {
    color: var(--status-danger, #f04747) !important;
}

/* Bot "thinking" text highlighting */
.messagelogger-deleted [class*="colorStandard"] {
    color: var(--status-danger, #f04747) !important;
}

/* Embed highlighting */
.messagelogger-deleted article :is(div, span, h1, h2, h3, p) {
    color: var(--status-danger, #f04747) !important;
}

.messagelogger-deleted a {
    color: var(--red-460, #be3535) !important;
    text-decoration: underline;
}
`,
					classNames: {},
					dom: null,
				}
			);
			ry = "src/plugins/messageLogger/deleteStyleText.css";
		});
	function Nw(e) {
		ge((t) => n(R, null, n(Ak, { modalProps: t, message: e })));
	}
	function Ak({ modalProps: e, message: t }) {
		let [o, r] = z(t.editHistory.length),
			i = [t.firstEditTimestamp, ...t.editHistory.map((l) => l.timestamp)],
			s = [...t.editHistory.map((l) => l.content), t.content];
		return n(
			Te,
			{ ...e, size: "large" },
			n(
				Ee,
				{ className: dl("head") },
				n(
					Z,
					{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
					"Message Edit History"
				),
				n(rt, { onClick: e.onClose })
			),
			n(
				Ae,
				{ className: dl("contents") },
				n(
					mo,
					{
						type: "top",
						look: "brand",
						className: H("vc-settings-tab-bar", dl("tab-bar")),
						selectedItem: o,
						onItemSelect: r,
					},
					t.firstEditTimestamp.getTime() !== t.timestamp.getTime() &&
						n(
							hr,
							{
								text: "This edit state was not logged so it can't be displayed.",
							},
							n(
								mo.Item,
								{ className: "vc-settings-tab-bar-item", id: -1, disabled: !0 },
								n(Zt, {
									className: dl("timestamp"),
									timestamp: t.timestamp,
									isEdited: !0,
									isInline: !1,
								})
							)
						),
					i.map((l, c) =>
						n(
							mo.Item,
							{ className: "vc-settings-tab-bar-item", id: c },
							n(Zt, {
								className: dl("timestamp"),
								timestamp: l,
								isEdited: !0,
								isInline: !1,
							})
						)
					)
				),
				n(
					"div",
					{ className: H(Ik.markup, Ck.messageContent, G.top20) },
					iy(s[o], t)
				)
			)
		);
	}
	var Ik,
		Ck,
		dl,
		Rw = g(() => {
			"use strict";
			a();
			tt();
			re();
			Ye();
			me();
			Ke();
			U();
			b();
			sy();
			(Ik = C("markup", "codeContainer")),
				(Ck = C("messageContent", "markupRtl")),
				(dl = be("vc-ml-modal-"));
		});
	function Lw() {
		Ps.store.deleteStyle === "text" ? (fo(ry), _o(ny)) : (_o(ry), fo(ny));
	}
	function iy(e, t) {
		return Ce.parse(e, !0, {
			channelId: t.channel_id,
			messageId: t.id,
			allowLinks: !0,
			allowHeading: !0,
			allowList: !0,
			allowEmojiLinks: !0,
			viewingChannelId: xe.getChannelId(),
		});
	}
	var Nk,
		Rk,
		kw,
		Dw,
		kk,
		Vp,
		Ps,
		ed,
		sy = g(() => {
			"use strict";
			a();
			Iw();
			ho();
			Qp();
			F();
			tt();
			re();
			P();
			co();
			De();
			me();
			T();
			U();
			b();
			Cw();
			Aw();
			Rw();
			(Nk = C("edited", "communicationDisabled", "isSystemMessage")),
				(Rk = fe('replace(/^\\n+|\\n+$/g,"")'));
			(kw = "ml-remove-history"),
				(Dw = "ml-toggle-style"),
				(kk = (e, t) => {
					let { message: o } = t,
						{ deleted: r, editHistory: i, id: s, channel_id: l } = o;
					if (!r && !i?.length) return;
					e: {
						if (!r) break e;
						let c = document.getElementById(`chat-messages-${l}-${s}`);
						if (!c) break e;
						e.push(
							n(E.MenuItem, {
								id: Dw,
								key: Dw,
								label: "Toggle Deleted Highlight",
								action: () => c.classList.toggle("messagelogger-deleted"),
							})
						);
					}
					e.push(
						n(E.MenuItem, {
							id: kw,
							key: kw,
							label: "Remove Message History",
							color: "danger",
							action: () => {
								r
									? _.dispatch({
											type: "MESSAGE_DELETE",
											channelId: l,
											id: s,
											mlDeleted: !0,
										})
									: (o.editHistory = []);
							},
						})
					);
				}),
				(Vp = (e, { channel: t }) => {
					let o = jt.getMessages(t?.id);
					if (!o?.some((i) => i.deleted || i.editHistory?.length)) return;
					(Ve("mark-channel-read", e) ?? e).push(
						n(E.MenuItem, {
							id: "vc-ml-clear-channel",
							label: "Clear Message Log",
							color: "danger",
							action: () => {
								o.forEach((i) => {
									i.deleted
										? _.dispatch({
												type: "MESSAGE_DELETE",
												channelId: t.id,
												id: i.id,
												mlDeleted: !0,
											})
										: pl(t.id, i.id, { editHistory: [] });
								});
							},
						})
					);
				});
			(Ps = x({
				deleteStyle: {
					type: 4,
					description: "The style of deleted messages",
					default: "text",
					options: [
						{ label: "Red text", value: "text", default: !0 },
						{ label: "Red overlay", value: "overlay" },
					],
					onChange: () => Lw(),
				},
				logDeletes: {
					type: 3,
					description: "Whether to log deleted messages",
					default: !0,
				},
				collapseDeleted: {
					type: 3,
					description:
						"Whether to collapse deleted messages, similar to blocked messages",
					default: !1,
				},
				logEdits: {
					type: 3,
					description: "Whether to log edited messages",
					default: !0,
				},
				inlineEdits: {
					type: 3,
					description:
						"Whether to display edit history as part of message content",
					default: !0,
				},
				ignoreBots: {
					type: 3,
					description: "Whether to ignore messages by bots",
					default: !1,
				},
				ignoreSelf: {
					type: 3,
					description: "Whether to ignore messages by yourself",
					default: !1,
				},
				ignoreUsers: {
					type: 0,
					description: "Comma-separated list of user IDs to ignore",
					default: "",
				},
				ignoreChannels: {
					type: 0,
					description: "Comma-separated list of channel IDs to ignore",
					default: "",
				},
				ignoreGuilds: {
					type: 0,
					description: "Comma-separated list of guild IDs to ignore",
					default: "",
				},
			})),
				(ed = h({
					name: "MessageLogger",
					description: "Temporarily logs deleted and edited messages.",
					authors: [d.rushii, d.Ven, d.AutumnVN, d.Nickyux, d.Kyuuhachi],
					dependencies: ["MessageUpdaterAPI"],
					settings: Ps,
					contextMenus: {
						message: kk,
						"channel-context": Vp,
						"thread-context": Vp,
						"user-context": Vp,
						"gdm-context": Vp,
					},
					start() {
						Lw();
					},
					renderEdits: R.wrap(
						({ message: { id: e, channel_id: t } }) => {
							let o = Oe(
								[jt],
								() => jt.getMessage(t, e),
								null,
								(r, i) => r?.editHistory === i?.editHistory
							);
							return (
								Ps.store.inlineEdits &&
								n(
									f,
									null,
									o.editHistory?.map((r) =>
										n(
											"div",
											{ className: "messagelogger-edited" },
											iy(r.content, o),
											n(
												Zt,
												{ timestamp: r.timestamp, isEdited: !0, isInline: !1 },
												n(
													"span",
													{ className: Nk.edited },
													" ",
													"(",
													Se.Messages.MESSAGE_EDITED,
													")"
												)
											)
										)
									)
								)
							);
						},
						{ noop: !0 }
					),
					makeEdit(e, t) {
						return {
							timestamp: new Date(e.edited_timestamp),
							content: t.content,
						};
					},
					handleDelete(e, t, o) {
						try {
							if (e == null || (!o && !e.has(t.id))) return e;
							let r = (i) => {
								let s = e.get(i);
								if (!s) return;
								let l = 64;
								t.mlDeleted || (s.flags & l) === l || this.shouldIgnore(s)
									? (e = e.remove(i))
									: (e = e.update(i, (u) =>
											u.set("deleted", !0).set(
												"attachments",
												u.attachments.map((p) => ((p.deleted = !0), p))
											)
										));
							};
							o ? t.ids.forEach(r) : r(t.id);
						} catch (r) {
							new V("MessageLogger").error("Error during handleDelete", r);
						}
						return e;
					},
					shouldIgnore(e, t = !1) {
						let {
								ignoreBots: o,
								ignoreSelf: r,
								ignoreUsers: i,
								ignoreChannels: s,
								ignoreGuilds: l,
								logEdits: c,
								logDeletes: u,
							} = Ps.store,
							p = D.getCurrentUser().id;
						return (
							(o && e.author?.bot) ||
							(r && e.author?.id === p) ||
							i.includes(e.author?.id) ||
							s.includes(e.channel_id) ||
							s.includes(oe.getChannel(e.channel_id)?.parent_id) ||
							(t ? !c : !u) ||
							l.includes(oe.getChannel(e.channel_id)?.guild_id) ||
							(e.channel_id === "1026515880080842772" &&
								e.author?.id === "1017176847865352332")
						);
					},
					EditMarker({ message: e, className: t, children: o, ...r }) {
						return n(
							"span",
							{
								...r,
								className: H("messagelogger-edit-marker", t),
								onClick: () => Nw(e),
								"aria-role": "button",
							},
							o
						);
					},
					Messages: Dt(() => ({
						DELETED_MESSAGE_COUNT: Rk(
							"{count, plural, =0 {No deleted messages} one {{count} deleted message} other {{count} deleted messages}}"
						),
					})),
					patches: [
						{
							find: '"MessageStore"',
							replacement: [
								{
									match:
										/MESSAGE_DELETE:function\((\i)\){let.+?((?:\i\.){2})getOrCreate.+?},/,
									replace:
										"MESSAGE_DELETE:function($1){   var cache = $2getOrCreate($1.channelId);   cache = $self.handleDelete(cache, $1, false);   $2commit(cache);},",
								},
								{
									match:
										/MESSAGE_DELETE_BULK:function\((\i)\){let.+?((?:\i\.){2})getOrCreate.+?},/,
									replace:
										"MESSAGE_DELETE_BULK:function($1){   var cache = $2getOrCreate($1.channelId);   cache = $self.handleDelete(cache, $1, true);   $2commit(cache);},",
								},
								{
									match: /(MESSAGE_UPDATE:function\((\i)\).+?)\.update\((\i)/,
									replace:
										"$1.update($3,m =>   (($2.message.flags & 64) === 64 || $self.shouldIgnore($2.message, true)) ? m :   $2.message.edited_timestamp && $2.message.content !== m.content ?       m.set('editHistory',[...(m.editHistory || []), $self.makeEdit($2.message, m)]) :       m).update($3",
								},
								{
									match:
										/(?<=getLastEditableMessage\(\i\)\{.{0,200}\.find\((\i)=>)/,
									replace: "!$1.deleted &&",
								},
							],
						},
						{
							find: "}addReaction(",
							replacement: [
								{
									match:
										/this\.customRenderedContent=(\i)\.customRenderedContent,/,
									replace:
										"this.customRenderedContent = $1.customRenderedContent,this.deleted = $1.deleted || false,this.editHistory = $1.editHistory || [],this.firstEditTimestamp = $1.firstEditTimestamp || this.editedTimestamp || this.timestamp,",
								},
							],
						},
						{
							find: "THREAD_STARTER_MESSAGE?null===",
							replacement: [
								{
									match:
										/(?<=null!=\i\.edited_timestamp\)return )\i\(\i,\{reactions:(\i)\.reactions.{0,50}\}\)/,
									replace:
										"Object.assign($&,{ deleted:$1.deleted, editHistory:$1.editHistory, firstEditTimestamp:$1.firstEditTimestamp })",
								},
								{
									match: /attachments:(\i)\((\i)\)/,
									replace:
										"attachments: $1((() => {   if ($self.shouldIgnore($2)) return $2;   let old = arguments[1]?.attachments;   if (!old) return $2;   let new_ = $2.attachments?.map(a => a.id) ?? [];   let diff = old.filter(a => !new_.includes(a.id));   old.forEach(a => a.deleted = true);   $2.attachments = [...diff, ...$2.attachments];   return $2;})()),deleted: arguments[1]?.deleted,editHistory: arguments[1]?.editHistory,firstEditTimestamp: new Date(arguments[1]?.firstEditTimestamp ?? $2.editedTimestamp ?? $2.timestamp)",
								},
								{
									match: /(\((\i)\){return null==\2\.attachments.+?)spoiler:/,
									replace: "$1deleted: arguments[0]?.deleted,spoiler:",
								},
							],
						},
						{
							find: ".removeMosaicItemHoverButton",
							group: !0,
							replacement: [
								{
									match: /(className:\i,item:\i),/,
									replace: "$1,item: deleted,",
								},
								{
									match: /\[\i\.obscured\]:.+?,/,
									replace: "$& 'messagelogger-deleted-attachment': deleted,",
								},
							],
						},
						{
							find: "Message must not be a thread starter message",
							replacement: [
								{
									match: /\)\("li",\{(.+?),className:/,
									replace:
										')("li",{$1,className:(arguments[0].message.deleted ? "messagelogger-deleted " : "")+',
								},
							],
						},
						{
							find: 'Messages.MESSAGE_EDITED,")"',
							replacement: [
								{
									match: /(\)\("div",\{id:.+?children:\[)/,
									replace:
										"$1 (!!arguments[0].message.editHistory?.length && $self.renderEdits(arguments[0])),",
								},
								{
									match: /"span",\{(?=className:\i\.edited,)/,
									replace: "$self.EditMarker,{message:arguments[0].message,",
								},
							],
						},
						{
							find: '"ReferencedMessageStore"',
							replacement: [
								{
									match: /MESSAGE_DELETE:function\((\i)\).+?},/,
									replace: "MESSAGE_DELETE:function($1){},",
								},
								{
									match: /MESSAGE_DELETE_BULK:function\((\i)\).+?},/,
									replace: "MESSAGE_DELETE_BULK:function($1){},",
								},
							],
						},
						{
							find: "useMessageMenu:",
							replacement: [
								{
									match: /children:(\[""===.+?\])/,
									replace: "children:arguments[0].message.deleted?[]:$1",
								},
							],
						},
						{
							find: "NON_COLLAPSIBLE.has(",
							replacement: {
								match:
									/if\((\i)\.blocked\)return \i\.\i\.MESSAGE_GROUP_BLOCKED;/,
								replace: '$&else if($1.deleted) return"MESSAGE_GROUP_DELETED";',
							},
							predicate: () => Ps.store.collapseDeleted,
						},
						{
							find: "Messages.NEW_MESSAGES_ESTIMATED_WITH_DATE",
							replacement: [
								{
									match: /(\i).type===\i\.\i\.MESSAGE_GROUP_BLOCKED\|\|/,
									replace: '$&$1.type==="MESSAGE_GROUP_DELETED"||',
								},
								{
									match: /(\i).type===\i\.\i\.MESSAGE_GROUP_BLOCKED\?.*?:/,
									replace:
										'$&$1.type==="MESSAGE_GROUP_DELETED"?$self.Messages.DELETED_MESSAGE_COUNT:',
								},
							],
							predicate: () => Ps.store.collapseDeleted,
						},
					],
				}));
		});
	function Ew(e) {
		ts(
			{
				name: e.name,
				description: e.name,
				inputType: 1,
				execute: async (t, o) =>
					(await td(e.name))
						? (Ow.store.clyde &&
								Je(o.channel.id, {
									content: `${Er} The tag **${e.name}** has been sent!`,
								}),
							{
								content: e.message.replaceAll(
									"\\n",
									`
`
								),
							})
						: (Je(o.channel.id, {
								content: `${Er} The tag **${e.name}** does not exist anymore! Please reload ur Discord to fix :)`,
							}),
							{ content: `/${e.name}` }),
				[Dk]: !0,
			},
			"CustomTags"
		);
	}
	var Er,
		nd,
		Dk,
		od,
		td,
		Lk,
		Ek,
		Ow,
		rd,
		Fw = g(() => {
			"use strict";
			a();
			jo();
			$o();
			F();
			P();
			T();
			(Er = "<:luna:1035316192220553236>"),
				(nd = "MessageTags_TAGS"),
				(Dk = Symbol("MessageTags")),
				(od = () => lt(nd).then((e) => e ?? [])),
				(td = (e) =>
					lt(nd).then((t) => (t ?? []).find((o) => o.name === e) ?? null)),
				(Lk = async (e) => {
					let t = await od();
					return t.push(e), wt(nd, t), t;
				}),
				(Ek = async (e) => {
					let t = await od();
					return (t = await t.filter((o) => o.name !== e)), wt(nd, t), t;
				});
			(Ow = x({
				clyde: {
					name: "Clyde message on send",
					description:
						"If enabled, clyde will send you an ephemeral message when a tag was used.",
					type: 3,
					default: !0,
				},
			})),
				(rd = h({
					name: "MessageTags",
					description:
						"Allows you to save messages and to use them with a simple command.",
					authors: [d.Luna],
					settings: Ow,
					dependencies: ["CommandsAPI"],
					async start() {
						for (let e of await od()) Ew(e);
					},
					commands: [
						{
							name: "tags",
							description: "Manage all the tags for yourself",
							inputType: 0,
							options: [
								{
									name: "create",
									description: "Create a new tag",
									type: 1,
									options: [
										{
											name: "tag-name",
											description:
												"The name of the tag to trigger the response",
											type: 3,
											required: !0,
										},
										{
											name: "message",
											description:
												"The message that you will send when using this tag",
											type: 3,
											required: !0,
										},
									],
								},
								{
									name: "list",
									description: "List all tags from yourself",
									type: 1,
									options: [],
								},
								{
									name: "delete",
									description: "Remove a tag from your yourself",
									type: 1,
									options: [
										{
											name: "tag-name",
											description:
												"The name of the tag to trigger the response",
											type: 3,
											required: !0,
										},
									],
								},
								{
									name: "preview",
									description: "Preview a tag without sending it publicly",
									type: 1,
									options: [
										{
											name: "tag-name",
											description:
												"The name of the tag to trigger the response",
											type: 3,
											required: !0,
										},
									],
								},
							],
							async execute(e, t) {
								switch (e[0].name) {
									case "create": {
										let o = qt(e[0].options, "tag-name", ""),
											r = qt(e[0].options, "message", "");
										if (await td(o))
											return Je(t.channel.id, {
												content: `${Er} A Tag with the name **${o}** already exists!`,
											});
										let i = { name: o, enabled: !0, message: r };
										Ew(i),
											await Lk(i),
											Je(t.channel.id, {
												content: `${Er} Successfully created the tag **${o}**!`,
											});
										break;
									}
									case "delete": {
										let o = qt(e[0].options, "tag-name", "");
										if (!(await td(o)))
											return Je(t.channel.id, {
												content: `${Er} A Tag with the name **${o}** does not exist!`,
											});
										Ga(o),
											await Ek(o),
											Je(t.channel.id, {
												content: `${Er} Successfully deleted the tag **${o}**!`,
											});
										break;
									}
									case "list": {
										Je(t.channel.id, {
											embeds: [
												{
													title: "All Tags:",
													description:
														(await od()).map(
															(o) =>
																`\`${o.name}\`: ${o.message.slice(0, 72).replaceAll("\\n", " ")}${o.message.length > 72 ? "..." : ""}`
														).join(`
`) || `${Er} Woops! There are no tags yet, use \`/tags create\` to create one!`,
													color: 14122879,
													type: "rich",
												},
											],
										});
										break;
									}
									case "preview": {
										let o = qt(e[0].options, "tag-name", ""),
											r = await td(o);
										if (!r)
											return Je(t.channel.id, {
												content: `${Er} A Tag with the name **${o}** does not exist!`,
											});
										Je(t.channel.id, {
											content: r.message.replaceAll(
												"\\n",
												`
`
											),
										});
										break;
									}
									default: {
										Je(t.channel.id, { content: "Invalid sub-command" });
										break;
									}
								}
							},
						},
					],
				}));
		});
	function Ok(e) {
		let t = "";
		for (let o = 0; o < e.length; o++)
			t += o % 2 ? e[o].toUpperCase() : e[o].toLowerCase();
		return t;
	}
	var id,
		_w = g(() => {
			"use strict";
			a();
			jo();
			P();
			T();
			id = h({
				name: "MoreCommands",
				description: "echo, lenny, mock",
				authors: [d.Arjix, d.echo, d.Samu],
				dependencies: ["CommandsAPI"],
				commands: [
					{
						name: "echo",
						description: "Sends a message as Clyde (locally)",
						options: [Pr],
						inputType: 3,
						execute: (e, t) => {
							let o = qt(e, "message", "");
							Je(t.channel.id, { content: o });
						},
					},
					{
						name: "lenny",
						description: "Sends a lenny face",
						options: [Pr],
						execute: (e) => ({
							content:
								qt(e, "message", "") + " ( \u0361\xB0 \u035C\u0296 \u0361\xB0)",
						}),
					},
					{
						name: "mock",
						description: "mOcK PeOpLe",
						options: [$a],
						execute: (e) => ({ content: Ok(qt(e, "message", "")) }),
					},
				],
			});
		});
	var sd,
		Bw = g(() => {
			"use strict";
			a();
			jo();
			P();
			T();
			sd = h({
				name: "MoreKaomoji",
				description: "Adds more Kaomoji to discord. \u30FD(\xB4\u25BD`)/",
				authors: [d.JacobTm],
				dependencies: ["CommandsAPI"],
				commands: [
					{ name: "dissatisfaction", description: " \uFF1E\uFE4F\uFF1C" },
					{ name: "smug", description: "\u0CA0_\u0CA0" },
					{ name: "happy", description: "\u30FD(\xB4\u25BD`)/" },
					{ name: "crying", description: "\u0CA5_\u0CA5" },
					{ name: "angry", description: "\u30FD(\uFF40\u0414\xB4)\uFF89" },
					{
						name: "anger",
						description: "\u30FD(\uFF4F`\u76BF\u2032\uFF4F)\uFF89",
					},
					{ name: "joy", description: "<(\uFFE3\uFE36\uFFE3)>" },
					{
						name: "blush",
						description: "\u0AEE \u02F6\u1D54 \u1D55 \u1D54\u02F6 \u10D0",
					},
					{ name: "confused", description: "(\u2022\u0E34_\u2022\u0E34)?" },
					{ name: "sleeping", description: "(\u1D17_\u1D17)" },
					{ name: "laughing", description: "o(\u2267\u25BD\u2266)o" },
				].map((e) => ({
					...e,
					options: [Pr],
					execute: (t) => ({
						content: qt(t, "message", "") + " " + e.description,
					}),
				})),
			});
		});
	function _k() {
		let e = (ml.store.tagSettings ??= $w);
		return n(
			pe,
			{ flexDirection: "column" },
			Ms.map((t) =>
				n(
					Nt,
					{ style: { padding: "1em 1em 0" } },
					n(
						S.FormTitle,
						{ style: { width: "fit-content" } },
						n(
							te,
							{ text: t.description },
							({ onMouseEnter: o, onMouseLeave: r }) =>
								n(
									"div",
									{ onMouseEnter: o, onMouseLeave: r },
									t.displayName,
									" Tag ",
									n(Jn, { type: Jn.Types[t.name] })
								)
						)
					),
					n(mt, {
						type: "text",
						value: e[t.name]?.text ?? t.displayName,
						placeholder: `Text on tag (default: ${t.displayName})`,
						onChange: (o) => (e[t.name].text = o),
						className: G.bottom16,
					}),
					n(
						Vt,
						{
							value: e[t.name]?.showInChat ?? !0,
							onChange: (o) => (e[t.name].showInChat = o),
							hideBorder: !0,
						},
						"Show in messages"
					),
					n(
						Vt,
						{
							value: e[t.name]?.showInNotChat ?? !0,
							onChange: (o) => (e[t.name].showInNotChat = o),
							hideBorder: !0,
						},
						"Show in member list and profiles"
					)
				)
			)
		);
	}
	var Fk,
		Jn,
		Uw,
		Ms,
		$w,
		ml,
		ad,
		Gw = g(() => {
			"use strict";
			a();
			F();
			kt();
			P();
			Ye();
			T();
			U();
			b();
			(Fk = fe(".getCurrentUser()", ".computeLurkerPermissionsAllowList()")),
				(Jn = ae(".DISCORD_SYSTEM_MESSAGE_BOT_TAG_TOOLTIP_OFFICIAL,")),
				(Uw = (e, t) => !!e?.webhookId && t.isNonUserBot()),
				(Ms = [
					{
						name: "WEBHOOK",
						displayName: "Webhook",
						description: "Messages sent by webhooks",
						condition: Uw,
					},
					{
						name: "OWNER",
						displayName: "Owner",
						description: "Owns the server",
						condition: (e, t, o) => le.getGuild(o?.guild_id)?.ownerId === t.id,
					},
					{
						name: "ADMINISTRATOR",
						displayName: "Admin",
						description: "Has the administrator permission",
						permissions: ["ADMINISTRATOR"],
					},
					{
						name: "MODERATOR_STAFF",
						displayName: "Staff",
						description: "Can manage the server, channels or roles",
						permissions: ["MANAGE_GUILD", "MANAGE_CHANNELS", "MANAGE_ROLES"],
					},
					{
						name: "MODERATOR",
						displayName: "Mod",
						description: "Can manage messages or kick/ban people",
						permissions: ["MANAGE_MESSAGES", "KICK_MEMBERS", "BAN_MEMBERS"],
					},
					{
						name: "VOICE_MODERATOR",
						displayName: "VC Mod",
						description: "Can manage voice chats",
						permissions: ["MOVE_MEMBERS", "MUTE_MEMBERS", "DEAFEN_MEMBERS"],
					},
					{
						name: "CHAT_MODERATOR",
						displayName: "Chat Mod",
						description: "Can timeout people",
						permissions: ["MODERATE_MEMBERS"],
					},
				]),
				($w = Object.fromEntries(
					Ms.map(({ name: e, displayName: t }) => [
						e,
						{ text: t, showInChat: !0, showInNotChat: !0 },
					])
				));
			(ml = x({
				dontShowForBots: {
					description: "Don't show extra tags for bots (excluding webhooks)",
					type: 3,
				},
				dontShowBotTag: {
					description: "Only show extra tags for bots / Hide [BOT] text",
					type: 3,
				},
				tagSettings: { type: 6, component: _k, description: "fill me" },
			})),
				(ad = h({
					name: "MoreUserTags",
					description:
						"Adds tags for webhooks and moderative roles (owner, admin, etc.)",
					authors: [d.Cyn, d.TheSun, d.RyanCaoDev, d.LordElias, d.AutumnVN],
					settings: ml,
					patches: [
						{
							find: ".ORIGINAL_POSTER=",
							replacement: {
								match: /\((\i)=\{\}\)\)\[(\i)\.BOT/,
								replace: "($1=$self.getTagTypes()))[$2.BOT",
							},
						},
						{
							find: ".DISCORD_SYSTEM_MESSAGE_BOT_TAG_TOOLTIP_OFFICIAL,",
							replacement: [
								{
									match:
										/(switch\((\i)\){.+?)case (\i(?:\.\i)?)\.BOT:default:(\i)=.{0,40}(\i\.\i\.Messages)\.APP_TAG/,
									replace: (e, t, o, r, i, s) =>
										`${t}default:{${i} = $self.getTagText(${r}[${o}], ${s})}`,
								},
								{
									match: /(\i)=(\i)===\i(?:\.\i)?\.ORIGINAL_POSTER/,
									replace: "$1=$self.isOPTag($2)",
								},
								{
									match: /.botText,children:(\i)}\)]/,
									replace: "$&,'data-tag':$1.toLowerCase()",
								},
							],
						},
						{
							find: ".Types.ORIGINAL_POSTER",
							replacement: {
								match:
									/;return\((\(null==\i\?void 0:\i\.isSystemDM\(\).+?.Types.ORIGINAL_POSTER\)),null==(\i)\)/,
								replace:
									";$1;$2=$self.getTag({...arguments[0],origType:$2,location:'chat'});return $2 == null",
							},
						},
						{
							find: ".Messages.GUILD_OWNER,",
							replacement: {
								match:
									/(?<type>\i)=\(null==.{0,100}\.BOT;return null!=(?<user>\i)&&\i\.bot/,
								replace:
									"$<type> = $self.getTag({user: $<user>, channel: arguments[0].channel, origType: $<user>.bot ? 0 : null, location: 'not-chat' }); return typeof $<type> === 'number'",
							},
						},
						{
							find: ".hasAvatarForGuild(null==",
							replacement: {
								match: /(?=usernameIcon:)/,
								replace: "moreTags_channelId:arguments[0].channelId,",
							},
						},
						{
							find: ".Messages.USER_PROFILE_PRONOUNS",
							replacement: {
								match: /(?=,hideBotTag:!0)/,
								replace: ",moreTags_channelId:arguments[0].moreTags_channelId",
							},
						},
						{
							find: ",overrideDiscriminator:",
							group: !0,
							replacement: [
								{ match: /user:\i,nick:\i,/, replace: "$&moreTags_channelId," },
								{
									match: /,botType:(\i),(?<=user:(\i).+?)/g,
									replace:
										",botType:$self.getTag({user:$2,channelId:moreTags_channelId,origType:$1,location:'not-chat'}),",
								},
							],
						},
					],
					start() {
						(ml.store.tagSettings ??= $w),
							(ml.store.tagSettings.CHAT_MODERATOR ??= {
								text: "Chat Mod",
								showInChat: !0,
								showInNotChat: !0,
							});
					},
					getPermissions(e, t) {
						let o = le.getGuild(t?.guild_id);
						if (!o) return [];
						let r = Fk({
							user: e,
							context: o,
							overwrites: t.permissionOverwrites,
						});
						return Object.entries(we)
							.map(([i, s]) => (r & s ? i : ""))
							.filter(Boolean);
					},
					getTagTypes() {
						let e = {},
							t = 100;
						return (
							Ms.forEach(({ name: o }) => {
								(e[o] = ++t),
									(e[t] = o),
									(e[`${o}-BOT`] = ++t),
									(e[t] = `${o}-BOT`),
									(e[`${o}-OP`] = ++t),
									(e[t] = `${o}-OP`);
							}),
							e
						);
					},
					isOPTag: (e) =>
						e === Jn.Types.ORIGINAL_POSTER ||
						Ms.some((t) => e === Jn.Types[`${t.name}-OP`]),
					getTagText(e, t) {
						if (!e) return t.APP_TAG;
						let [o, r] = e.split("-"),
							i = Ms.find(({ name: l }) => o === l);
						if (
							!i ||
							(r === "BOT" &&
								o !== "WEBHOOK" &&
								this.settings.store.dontShowForBots)
						)
							return t.APP_TAG;
						let s = ml.store.tagSettings?.[i.name]?.text || i.displayName;
						switch (r) {
							case "OP":
								return `${t.BOT_TAG_FORUM_ORIGINAL_POSTER} \u2022 ${s}`;
							case "BOT":
								return `${t.APP_TAG} \u2022 ${s}`;
							default:
								return s;
						}
					},
					getTag({
						message: e,
						user: t,
						channelId: o,
						origType: r,
						location: i,
						channel: s,
					}) {
						if (!t) return null;
						if (i === "chat" && t.id === "1") return Jn.Types.OFFICIAL;
						if (t.isClyde()) return Jn.Types.AI;
						let l = typeof r == "number" ? r : null;
						if (((s ??= oe.getChannel(o)), !s)) return l;
						let c = this.settings.store,
							u = this.getPermissions(t, s);
						for (let p of Ms)
							if (
								!(i === "chat" && !c.tagSettings[p.name].showInChat) &&
								!(i === "not-chat" && !c.tagSettings[p.name].showInNotChat) &&
								!(
									(p.name !== "OWNER" &&
										le.getGuild(s?.guild_id)?.ownerId === t.id &&
										i === "chat" &&
										!c.tagSettings.OWNER.showInChat) ||
									(i === "not-chat" && !c.tagSettings.OWNER.showInNotChat)
								) &&
								(p.permissions?.some((m) => u.includes(m)) ||
									p.condition?.(e, t, s))
							) {
								(s.isForumPost() || s.isMediaPost()) && s.ownerId === t.id
									? (l = Jn.Types[`${p.name}-OP`])
									: t.bot && !Uw(e, t) && !c.dontShowBotTag
										? (l = Jn.Types[`${p.name}-BOT`])
										: (l = Jn.Types[p.name]);
								break;
							}
						return l;
					},
				}));
		});
	function $k(e, t) {
		let o = 0,
			r = 0;
		for (; (r = e.indexOf(t, r) + 1) !== 0; ) o++;
		return o;
	}
	function Gk(e, t) {
		if (!t.global) throw new Error("pattern must be global");
		let o = 0;
		for (; t.test(e); ) o++;
		return o;
	}
	function zk(e) {
		let t = $k(e, ly) + Gk(e, Hk);
		return Math.min(t, 10);
	}
	function ay() {
		if (!Or.store.triggerWhenUnfocused && !document.hasFocus()) return;
		let e = document.createElement("audio");
		(e.src = Or.store.quality === "HD" ? Uk : Bk),
			(e.volume = Or.store.volume),
			e.play();
	}
	var ly,
		Bk,
		Uk,
		Or,
		ld,
		Hk,
		Hw = g(() => {
			"use strict";
			a();
			F();
			gh();
			P();
			me();
			T();
			b();
			(ly = "\u{1F5FF}"),
				(Bk =
					"https://raw.githubusercontent.com/MeguminSama/VencordPlugins/main/plugins/moyai/moyai.mp3"),
				(Uk =
					"https://raw.githubusercontent.com/MeguminSama/VencordPlugins/main/plugins/moyai/moyai_hd.wav"),
				(Or = x({
					volume: {
						description: "Volume of the \u{1F5FF}\u{1F5FF}\u{1F5FF}",
						type: 5,
						markers: Bo(0, 1, 0.1),
						default: 0.5,
						stickToMarkers: !1,
					},
					quality: {
						description: "Quality of the \u{1F5FF}\u{1F5FF}\u{1F5FF}",
						type: 4,
						options: [
							{ label: "Normal", value: "Normal", default: !0 },
							{ label: "HD", value: "HD" },
						],
					},
					triggerWhenUnfocused: {
						description:
							"Trigger the \u{1F5FF} even when the window is unfocused",
						type: 3,
						default: !0,
					},
					ignoreBots: { description: "Ignore bots", type: 3, default: !0 },
					ignoreBlocked: {
						description: "Ignore blocked users",
						type: 3,
						default: !0,
					},
				})),
				(ld = h({
					name: "Moyai",
					authors: [d.Megu, d.Nuckyz],
					description:
						"\u{1F5FF}\u{1F5FF}\u{1F5FF}\u{1F5FF}\u{1F5FF}\u{1F5FF}\u{1F5FF}\u{1F5FF}",
					settings: Or,
					flux: {
						async MESSAGE_CREATE({
							optimistic: e,
							type: t,
							message: o,
							channelId: r,
						}) {
							if (
								e ||
								t !== "MESSAGE_CREATE" ||
								o.state === "SENDING" ||
								(Or.store.ignoreBots && o.author?.bot) ||
								(Or.store.ignoreBlocked && Ie.isBlocked(o.author?.id)) ||
								!o.content ||
								r !== xe.getChannelId()
							)
								return;
							let i = zk(o.content);
							for (let s = 0; s < i; s++) ay(), await Xo(300);
						},
						MESSAGE_REACTION_ADD({
							optimistic: e,
							type: t,
							channelId: o,
							userId: r,
							messageAuthorId: i,
							emoji: s,
						}) {
							if (
								e ||
								t !== "MESSAGE_REACTION_ADD" ||
								(Or.store.ignoreBots && D.getUser(r)?.bot) ||
								(Or.store.ignoreBlocked && Ie.isBlocked(i)) ||
								o !== xe.getChannelId()
							)
								return;
							let l = s.name.toLowerCase();
							(l !== ly && !l.includes("moyai") && !l.includes("moai")) || ay();
						},
						VOICE_CHANNEL_EFFECT_SEND({ emoji: e }) {
							if (!e?.name) return;
							let t = e.name.toLowerCase();
							(t !== ly && !t.includes("moyai") && !t.includes("moai")) || ay();
						},
					},
				}));
			Hk = /<a?:\w*moy?ai\w*:\d{17,20}>/gi;
		});
	function Kk(e) {
		return (
			e.name ||
			e.recipients
				.map(D.getUser)
				.filter(En)
				.map((t) => Ie.getNickname(t.id) || jk.getName(t))
				.join(", ")
		);
	}
	function Zk(e) {
		let t = Ww(e.id).length;
		return `${t === 0 ? "No" : t} Mutual Group${t !== 1 ? "s" : ""}`;
	}
	var Wk,
		jk,
		Fr,
		qk,
		Ww,
		Yk,
		zw,
		cd,
		jw = g(() => {
			"use strict";
			a();
			re();
			P();
			Yi();
			T();
			U();
			b();
			(Wk = C("selectPrivateChannel")),
				(jk = C("getGlobalName")),
				(Fr = C("emptyIconFriends", "emptyIconGuilds")),
				(qk = C("guildNick", "guildAvatarWithoutIcon"));
			(Ww = (e) =>
				oe
					.getSortedPrivateChannels()
					.filter((t) => t.isGroupDM() && t.recipients.includes(e))),
				(Yk = (e) => e.bot || e.id === D.getCurrentUser().id);
			(zw = Symbol("MutualGroupDMs.Patched")),
				(cd = h({
					name: "MutualGroupDMs",
					description: "Shows mutual group dms in profiles",
					authors: [d.amia],
					patches: [
						{
							find: ".MUTUAL_FRIENDS?(",
							replacement: [
								{
									match: /\i\.useEffect.{0,100}(\i)\[0\]\.section/,
									replace: "$self.pushSection($1, arguments[0].user);$&",
								},
								{
									match: /\(0,\i\.jsx\)\(\i,\{items:\i,section:(\i)/,
									replace:
										"$1==='MUTUAL_GDMS'?$self.renderMutualGDMs(arguments[0]):$&",
								},
							],
						},
					],
					pushSection(e, t) {
						Yk(t) ||
							e[zw] ||
							((e[zw] = !0), e.push({ section: "MUTUAL_GDMS", text: Zk(t) }));
					},
					renderMutualGDMs: R.wrap(({ user: e, onClose: t }) => {
						let r = dt(() => Ww(e.id), [e.id]).map((i) =>
							n(
								Hi,
								{
									className: Fr.listRow,
									onClick: () => {
										t(), Wk.selectPrivateChannel(i.id);
									},
								},
								n(zi, {
									src: Rt.getChannelIconURL({
										id: i.id,
										icon: i.icon,
										size: 32,
									}),
									size: "SIZE_40",
									className: Fr.listAvatar,
								}),
								n(
									"div",
									{ className: Fr.listRowContent },
									n("div", { className: Fr.listName }, Kk(i)),
									n(
										"div",
										{ className: qk.guildNick },
										i.recipients.length + 1,
										" Members"
									)
								)
							)
						);
						return n(
							Gi,
							{ className: Fr.listScroller, fade: !0, onClose: t },
							r.length > 0
								? r
								: n(
										"div",
										{ className: Fr.empty },
										n("div", { className: Fr.emptyIconFriends }),
										n(
											"div",
											{ className: Fr.emptyText },
											"No group dms in common"
										)
									)
						);
					}),
				}));
		});
	function Yw(e) {
		e === "@me" ||
			e === "null" ||
			e == null ||
			(qw(e, {
				muted: Vn.store.guild,
				suppress_everyone: Vn.store.everyone,
				suppress_roles: Vn.store.role,
				mute_scheduled_events: Vn.store.events,
				notify_highlights: Vn.store.highlights ? 1 : 0,
			}),
			Vn.store.messages !== 3 &&
				qw(e, { message_notifications: Vn.store.messages }),
			Vn.store.showAllChannels && Xk(e) && Qk(e));
	}
	var qw,
		Qk,
		Xk,
		Vn,
		Kw,
		ud,
		Zw = g(() => {
			"use strict";
			a();
			ho();
			F();
			yt();
			P();
			T();
			U();
			b();
			(qw = Bi("updateGuildNotificationSettings")),
				({ toggleShowAllChannels: Qk } = zt(".onboardExistingMember(", {
					toggleShowAllChannels: (e) => {
						let t = String(e);
						return (
							t.length < 100 &&
							!t.includes("onboardExistingMember") &&
							!t.includes("getOptedInChannels")
						);
					},
				})),
				(Xk = fe(".COMMUNITY)||", ".isOptInEnabled(")),
				(Vn = x({
					guild: {
						description: "Mute Guild automatically",
						type: 3,
						default: !0,
					},
					messages: {
						description: "Server Notification Settings",
						type: 4,
						options: [
							{ label: "All messages", value: 0 },
							{ label: "Only @mentions", value: 1 },
							{ label: "Nothing", value: 2 },
							{ label: "Server default", value: 3, default: !0 },
						],
					},
					everyone: {
						description: "Suppress @everyone and @here",
						type: 3,
						default: !0,
					},
					role: {
						description: "Suppress All Role @mentions",
						type: 3,
						default: !0,
					},
					highlights: {
						description: "Suppress Highlights automatically",
						type: 3,
						default: !0,
					},
					events: {
						description: "Mute New Events automatically",
						type: 3,
						default: !0,
					},
					showAllChannels: {
						description: "Show all channels automatically",
						type: 3,
						default: !0,
					},
				})),
				(Kw =
					(e) =>
					(t, { guild: o }) => {
						if (!o) return;
						Ve("privacy", t)?.push(
							n(E.MenuItem, {
								label: "Apply NewGuildSettings",
								id: "vc-newguildsettings-apply",
								icon: e ? Ma : void 0,
								action: () => Yw(o.id),
							})
						);
					});
			rn("NewGuildSettings", "MuteNewGuild");
			ud = h({
				name: "NewGuildSettings",
				description:
					"Automatically mute new servers and change various other settings upon joining",
				tags: ["MuteNewGuild", "mute", "server"],
				authors: [d.Glitch, d.Nuckyz, d.carince, d.Mopi, d.GabiRP],
				contextMenus: {
					"guild-context": Kw(!1),
					"guild-header-popout": Kw(!0),
				},
				patches: [
					{
						find: ",acceptInvite(",
						replacement: {
							match: /INVITE_ACCEPT_SUCCESS.+?,(\i)=null!==.+?;/,
							replace: (e, t) => `${e}$self.applyDefaultSettings(${t});`,
						},
					},
					{
						find: "{joinGuild:",
						replacement: {
							match: /guildId:(\i),lurker:(\i).{0,20}}\)\);/,
							replace: (e, t, o) =>
								`${e}if(!${o})$self.applyDefaultSettings(${t});`,
						},
					},
				],
				settings: Vn,
				applyDefaultSettings: Yw,
			});
		});
	var Qw,
		pd,
		Xw = g(() => {
			"use strict";
			a();
			F();
			P();
			De();
			T();
			b();
			(Qw = x({
				ignoreBlockedMessages: {
					description:
						"Completely ignores (recent) incoming messages from blocked users (locally).",
					type: 3,
					default: !1,
					restartNeeded: !0,
				},
			})),
				(pd = h({
					name: "NoBlockedMessages",
					description: "Hides all blocked messages from chat completely.",
					authors: [d.rushii, d.Samu],
					settings: Qw,
					patches: [
						{
							find: "Messages.BLOCKED_MESSAGES_HIDE",
							replacement: [
								{
									match: /let\{[^}]*collapsedReason[^}]*\}/,
									replace: "return null;$&",
								},
							],
						},
						...['="MessageStore",', '"displayName","ReadStateStore")'].map(
							(e) => ({
								find: e,
								predicate: () => Qw.store.ignoreBlockedMessages === !0,
								replacement: [
									{
										match: /(?<=MESSAGE_CREATE:function\((\i)\){)/,
										replace: (t, o) =>
											`if($self.isBlocked(${o}.message))return;`,
									},
								],
							})
						),
					],
					options: {
						ignoreBlockedMessages: {
							description:
								"Completely ignores (recent) incoming messages from blocked users (locally).",
							type: 3,
							default: !1,
							restartNeeded: !0,
						},
					},
					isBlocked(e) {
						try {
							return Ie.isBlocked(e.author.id);
						} catch (t) {
							new V("NoBlockedMessages").error(
								"Failed to check if user is blocked:",
								t
							);
						}
					},
				}));
		});
	var dd,
		Jw = g(() => {
			"use strict";
			a();
			P();
			T();
			dd = h({
				name: "NoDefaultHangStatus",
				description:
					"Disable the default hang status when joining voice channels",
				authors: [d.D3SOX],
				patches: [
					{
						find: ".CHILLING)",
						replacement: {
							match: /{enableHangStatus:(\i),/,
							replace: "{_enableHangStatus:$1=false,",
						},
					},
				],
			});
		});
	var md,
		Vw = g(() => {
			"use strict";
			a();
			P();
			T();
			md = h({
				name: "NoDevtoolsWarning",
				description:
					"Disables the 'HOLD UP' banner in the console. As a side effect, also prevents Discord from hiding your token, which prevents random logouts.",
				authors: [d.Ven],
				patches: [
					{
						find: "setDevtoolsCallbacks",
						replacement: {
							match: /if\(null!=\i&&"0.0.0"===\i\.remoteApp\.getVersion\(\)\)/,
							replace: "if(true)",
						},
					},
				],
			});
		});
	var fd,
		eP = g(() => {
			"use strict";
			a();
			P();
			T();
			fd = h({
				name: "NoF1",
				description: "Disables F1 help bind.",
				authors: [d.Cyn],
				patches: [
					{
						find: ',"f1"],comboKeysBindGlobal:',
						replacement: {
							match: ',"f1"],comboKeysBindGlobal:',
							replace: "],comboKeysBindGlobal:",
						},
					},
				],
			});
		});
	var gd,
		tP = g(() => {
			"use strict";
			a();
			P();
			T();
			gd = h({
				name: "NoMaskedUrlPaste",
				authors: [d.CatNoir],
				description:
					"Pasting a link while having text selected will not paste as masked URL",
				patches: [
					{
						find: ".selection,preventEmojiSurrogates:",
						replacement: {
							match:
								/if\(null!=\i.selection&&\i.\i.isExpanded\(\i.selection\)\)/,
							replace: "if(false)",
						},
					},
				],
			});
		});
	var oP,
		hd,
		nP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(oP = x({
				inlineVideo: {
					description: "Play videos without carousel modal",
					type: 3,
					default: !0,
					restartNeeded: !0,
				},
			})),
				(hd = h({
					name: "NoMosaic",
					authors: [d.AutumnVN],
					description: "Removes Discord new image mosaic",
					tags: ["image", "mosaic", "media"],
					settings: oP,
					patches: [
						{
							find: '=>"IMAGE"===',
							replacement: {
								match: /=>"IMAGE"===\i\|\|"VIDEO"===\i;/,
								replace: "=>false;",
							},
						},
						{
							find: "renderAttachments(",
							predicate: () => oP.store.inlineVideo,
							replacement: {
								match: /url:(\i)\.url\}\);return /,
								replace: "$&$1.content_type?.startsWith('image/')&&",
							},
						},
					],
				}));
		});
	var yd,
		rP = g(() => {
			"use strict";
			a();
			P();
			T();
			yd = h({
				name: "NoOnboardingDelay",
				description: "Skips the slow and annoying onboarding delay",
				authors: [d.nekohaxx],
				patches: [
					{
						find: "Messages.ONBOARDING_COVER_WELCOME_SUBTITLE",
						replacement: { match: "3e3", replace: "0" },
					},
				],
			});
		});
	var Jk,
		Is,
		vd,
		iP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			U();
			(Jk = K("MessageRequestStore")),
				(Is = x({
					hideFriendRequestsCount: {
						type: 3,
						description: "Hide incoming friend requests count",
						default: !0,
						restartNeeded: !0,
					},
					hideMessageRequestsCount: {
						type: 3,
						description: "Hide message requests count",
						default: !0,
						restartNeeded: !0,
					},
					hidePremiumOffersCount: {
						type: 3,
						description: "Hide nitro offers count",
						default: !0,
						restartNeeded: !0,
					},
				})),
				(vd = h({
					name: "NoPendingCount",
					description:
						"Removes the ping count of incoming friend requests, message requests, and nitro offers.",
					authors: [d.amia],
					settings: Is,
					patches: [
						{
							find: "getPendingCount(){",
							predicate: () => Is.store.hideFriendRequestsCount,
							replacement: {
								match: /(?<=getPendingCount\(\)\{)/,
								replace: "return 0;",
							},
						},
						{
							find: 'location:"use-message-requests-count"',
							predicate: () => Is.store.hideMessageRequestsCount,
							replacement: {
								match:
									/getNonChannelAckId\(\i\.\i\.MESSAGE_REQUESTS\).+?return /,
								replace: "$&0;",
							},
						},
						{
							find: "getMessageRequestsCount(){",
							predicate: () => Is.store.hideMessageRequestsCount,
							replacement: {
								match: /(?<=getMessageRequestsCount\(\)\{)/,
								replace: "return 0;",
							},
						},
						{
							find: ".getSpamChannelsCount(),",
							predicate: () => Is.store.hideMessageRequestsCount,
							replacement: {
								match:
									/(?<=getSpamChannelsCount\(\),\i=)\i\.getMessageRequestsCount\(\)/,
								replace: "$self.getRealMessageRequestCount()",
							},
						},
						{
							find: "showProgressBadge:",
							predicate: () => Is.store.hidePremiumOffersCount,
							replacement: {
								match:
									/(?<=\{unviewedTrialCount:(\i),unviewedDiscountCount:(\i)\}.{0,200}\i=)\1\+\2/,
								replace: "0",
							},
						},
					],
					getRealMessageRequestCount() {
						return Jk.getMessageRequestChannelIds().size;
					},
				}));
		});
	var Sd,
		sP = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			Sd = h({
				name: "NoProfileThemes",
				description:
					"Completely removes Nitro profile themes from everyone but yourself",
				authors: [d.TheKodeToad],
				patches: [
					{
						find: "hasThemeColors(){",
						replacement: {
							match: /get canUsePremiumProfileCustomization\(\){return /,
							replace: "$&$self.isCurrentUser(this.userId)&&",
						},
					},
				],
				isCurrentUser: (e) => e === D.getCurrentUser()?.id,
			});
		});
	var bd,
		Td,
		aP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(bd = x({
				userList: {
					description:
						"List of users to allow or exempt pings for (separated by commas or spaces)",
					type: 0,
					default: "1234567890123445,1234567890123445",
				},
				shouldPingListed: {
					description: "Behaviour",
					type: 4,
					options: [
						{ label: "Do not ping the listed users", value: !1 },
						{ label: "Only ping the listed users", value: !0, default: !0 },
					],
				},
				inverseShiftReply: {
					description:
						"Invert Discord's shift replying behaviour (enable to make shift reply mention user)",
					type: 3,
					default: !1,
				},
			})),
				(Td = h({
					name: "NoReplyMention",
					description: "Disables reply pings by default",
					authors: [d.DustyAngel47, d.axyie, d.pylix, d.outfoxxed],
					settings: bd,
					shouldMention(e, t) {
						let o = bd.store.userList.includes(e.author.id),
							r = bd.store.shouldPingListed ? o : !o;
						return bd.store.inverseShiftReply ? t !== r : !t && r;
					},
					patches: [
						{
							find: ',"Message")}function',
							replacement: {
								match: /:(\i),shouldMention:!(\i)\.shiftKey/,
								replace:
									":$1,shouldMention:$self.shouldMention($1,$2.shiftKey)",
							},
						},
					],
				}));
		});
	var xd,
		lP = g(() => {
			"use strict";
			a();
			P();
			T();
			xd = h({
				name: "NoScreensharePreview",
				description: "Disables screenshare previews from being sent.",
				authors: [d.Nuckyz],
				patches: [
					{
						find: '"ApplicationStreamPreviewUploadManager"',
						replacement: {
							match:
								/await \i\.\i\.(makeChunkedRequest\(|post\(\{url:)\i\.\i\.STREAM_PREVIEW.+?\}\)/g,
							replace: "0",
						},
					},
				],
			});
		});
	var cy,
		wd,
		cP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(cy = x({
				shownEmojis: {
					description: "The types of emojis to show in the autocomplete menu.",
					type: 4,
					default: "onlyUnicode",
					options: [
						{ label: "Only unicode emojis", value: "onlyUnicode" },
						{
							label: "Unicode emojis and server emojis from current server",
							value: "currentServer",
						},
						{
							label: "Unicode emojis and all server emojis (Discord default)",
							value: "all",
						},
					],
				},
			})),
				(wd = h({
					name: "NoServerEmojis",
					authors: [d.UlyssesZhan],
					description: "Do not show server emojis in the autocomplete menu.",
					settings: cy,
					patches: [
						{
							find: "}searchWithoutFetchingLatest(",
							replacement: {
								match:
									/searchWithoutFetchingLatest.{20,300}get\((\i).{10,40}?reduce\(\((\i),(\i)\)=>\{/,
								replace: "$& if ($self.shouldSkip($1, $3)) return $2;",
							},
						},
					],
					shouldSkip(e, t) {
						return t.type !== "GUILD_EMOJI"
							? !1
							: cy.store.shownEmojis === "onlyUnicode"
								? !0
								: cy.store.shownEmojis === "currentServer"
									? t.guildId !== e
									: !1;
					},
				}));
		});
	var Pd,
		uP = g(() => {
			"use strict";
			a();
			P();
			T();
			Pd = h({
				name: "NoTypingAnimation",
				authors: [d.AutumnVN],
				description: "Disables the CPU-intensive typing dots animation",
				patches: [
					{
						find: "dotCycle",
						replacement: { match: /document.hasFocus\(\)/, replace: "false" },
					},
				],
			});
		});
	var Md,
		pP = g(() => {
			"use strict";
			a();
			P();
			T();
			Md = h({
				name: "NoUnblockToJump",
				description:
					"Allows you to jump to messages of blocked users without unblocking them",
				authors: [d.dzshn],
				patches: [
					{
						find: '.id,"Search Results"',
						replacement: {
							match:
								/if\(.{1,10}\)(.{1,10}\.show\({.{1,50}UNBLOCK_TO_JUMP_TITLE)/,
							replace: "if(false)$1",
						},
					},
					{
						find: "renderJumpButton()",
						replacement: {
							match:
								/if\(.{1,10}\)(.{1,10}\.show\({.{1,50}UNBLOCK_TO_JUMP_TITLE)/,
							replace: "if(false)$1",
						},
					},
					{
						find: "flash:!0,returnMessageId",
						replacement: {
							match: /.\?(.{1,10}\.show\({.{1,50}UNBLOCK_TO_JUMP_TITLE)/,
							replace: "false?$1",
						},
					},
				],
			});
		});
	var Id,
		dP = g(() => {
			"use strict";
			a();
			P();
			T();
			Id = h({
				name: "NormalizeMessageLinks",
				description: "Strip canary/ptb from message links",
				authors: [d.bb010g],
				patches: [
					{
						find: ".Messages.COPY_MESSAGE_LINK,",
						replacement: {
							match: /\.concat\(location\.host\)/,
							replace: ".concat($self.normalizeHost(location.host))",
						},
					},
				],
				normalizeHost(e) {
					return e.replace(/(^|\b)(canary\.|ptb\.)(discord.com)$/, "$1$3");
				},
			});
		});
	var Vk,
		Cd,
		mP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(Vk = x({
				notificationVolume: {
					type: 5,
					description: "Notification volume",
					markers: [0, 25, 50, 75, 100],
					default: 100,
					stickToMarkers: !1,
				},
			})),
				(Cd = h({
					name: "NotificationVolume",
					description:
						"Save your ears and set a separate volume for notifications and in-app sounds",
					authors: [d.philipbry],
					settings: Vk,
					patches: [
						{
							find: "_ensureAudio(){",
							replacement: {
								match: /(?=Math\.min\(\i\.\i\.getOutputVolume\(\)\/100)/,
								replace: "$self.settings.store.notificationVolume/100*",
							},
						},
					],
				}));
		});
	var Ad,
		fP = g(() => {
			"use strict";
			a();
			P();
			T();
			Ad = h({
				name: "NSFWGateBypass",
				description:
					"Allows you to access NSFW channels without setting/verifying your age",
				authors: [d.Commandtechno],
				patches: [
					{
						find: ".nsfwAllowed=null",
						replacement: {
							match: /(?<=\.nsfwAllowed=)null!==.+?(?=[,;])/,
							replace: "!0",
						},
					},
				],
			});
		});
	var fl,
		Nd,
		gP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			b();
			(fl = x({
				channelToAffect: {
					type: 4,
					description: "Select the type of DM for the plugin to affect",
					options: [
						{ label: "Both", value: "both_dms", default: !0 },
						{ label: "User DMs", value: "user_dm" },
						{ label: "Group DMs", value: "group_dm" },
					],
				},
				allowMentions: {
					type: 3,
					description: "Receive audio pings for @mentions",
					default: !1,
				},
				allowEveryone: {
					type: 3,
					description:
						"Receive audio pings for @everyone and @here in group DMs",
					default: !1,
				},
			})),
				(Nd = h({
					name: "OnePingPerDM",
					description:
						"If unread messages are sent by a user in DMs multiple times, you'll only receive one audio ping. Read the messages to reset the limit",
					authors: [d.ProffDea],
					settings: fl,
					patches: [
						{
							find: ".getDesktopType()===",
							replacement: [
								{
									match: /(\i\.\i\.getDesktopType\(\)===\i\.\i\.NEVER)\)/,
									replace:
										"$&if(!$self.isPrivateChannelRead(arguments[0]?.message))return;else ",
								},
								{
									match: /sound:(\i\?\i:void 0,soundpack:\i,volume:\i,onClick)/,
									replace:
										"sound:!$self.isPrivateChannelRead(arguments[0]?.message)?undefined:$1",
								},
							],
						},
					],
					isPrivateChannelRead(e) {
						let t = oe.getChannel(e.channel_id)?.type;
						return (t !== 1 && t !== 3) ||
							(t === 1 && fl.store.channelToAffect === "group_dm") ||
							(t === 3 && fl.store.channelToAffect === "user_dm") ||
							(fl.store.allowMentions &&
								e.mentions.some((o) => o.id === D.getCurrentUser().id)) ||
							(fl.store.allowEveryone && e.mention_everyone)
							? !0
							: ji.getOldestUnreadMessageId(e.channel_id) === e.id;
					},
				}));
		});
	var Rd,
		hP = g(() => {
			"use strict";
			a();
			P();
			T();
			Rd = h({
				name: "oneko",
				description: "cat follow mouse (real)",
				authors: [d.Ven, d.adryd],
				start() {
					fetch(
						"https://raw.githubusercontent.com/adryd325/oneko.js/8fa8a1864aa71cd7a794d58bc139e755e96a236c/oneko.js"
					)
						.then((e) => e.text())
						.then((e) =>
							e
								.replace(
									"./oneko.gif",
									"https://raw.githubusercontent.com/adryd325/oneko.js/14bab15a755d0e35cd4ae19c931d96d306f99f42/oneko.gif"
								)
								.replace("(isReducedMotion)", "(false)")
						)
						.then(eval);
				},
				stop() {
					document.getElementById("oneko")?.remove();
				},
			});
		});
	var uy,
		kd,
		eD,
		Dd,
		yP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			b();
			(uy = {
				spotify: {
					match:
						/^https:\/\/open\.spotify\.com\/(track|album|artist|playlist|user|episode)\/(.+)(?:\?.+?)?$/,
					replace: (e, t, o) => `spotify://${t}/${o}`,
					description: "Open Spotify links in the Spotify app",
					shortlinkMatch: /^https:\/\/spotify\.link\/.+$/,
					accountViewReplace: (e) => `spotify:user:${e}`,
				},
				steam: {
					match:
						/^https:\/\/(steamcommunity\.com|(?:help|store)\.steampowered\.com)\/.+$/,
					replace: (e) => `steam://openurl/${e}`,
					description: "Open Steam links in the Steam app",
					shortlinkMatch: /^https:\/\/s.team\/.+$/,
					accountViewReplace: (e) =>
						`steam://openurl/https://steamcommunity.com/profiles/${e}`,
				},
				epic: {
					match: /^https:\/\/store\.epicgames\.com\/(.+)$/,
					replace: (e, t) => `com.epicgames.launcher://store/${t}`,
					description: "Open Epic Games links in the Epic Games Launcher",
				},
				tidal: {
					match:
						/^https:\/\/tidal\.com\/browse\/(track|album|artist|playlist|user|video|mix)\/(.+)(?:\?.+?)?$/,
					replace: (e, t, o) => `tidal://${t}/${o}`,
					description: "Open Tidal links in the Tidal app",
				},
				itunes: {
					match:
						/^https:\/\/music\.apple\.com\/([a-z]{2}\/)?(album|artist|playlist|song|curator)\/([^/?#]+)\/?([^/?#]+)?(?:\?.*)?(?:#.*)?$/,
					replace: (e, t, o, r, i) =>
						i
							? `itunes://music.apple.com/us/${o}/${r}/${i}`
							: `itunes://music.apple.com/us/${o}/${r}`,
					description: "Open Apple Music links in the iTunes app",
				},
			}),
				(kd = x(
					Object.entries(uy).reduce(
						(e, [t, o]) => (
							(e[t] = { type: 3, description: o.description, default: !0 }), e
						),
						{}
					)
				)),
				(eD = VencordNative.pluginHelpers.OpenInApp),
				(Dd = h({
					name: "OpenInApp",
					description:
						"Open links in their respective apps instead of your browser",
					authors: [d.Ven, d.surgedevs],
					settings: kd,
					patches: [
						{
							find: "trackAnnouncementMessageLinkClicked({",
							replacement: {
								match: /function (\i\(\i,\i\)\{)(?=.{0,100}trusted:)/,
								replace:
									"async function $1 if(await $self.handleLink(...arguments)) return;",
							},
						},
						{
							find: "WEB_OPEN(",
							predicate: () => kd.store.spotify,
							replacement: {
								match: /\i\.\i\.isProtocolRegistered\(\)(.{0,100})window.open/g,
								replace: "true$1VencordNative.native.openExternal",
							},
						},
						{
							find: ".CONNECTED_ACCOUNT_VIEWED,",
							replacement: {
								match:
									/(?<=href:\i,onClick:(\i)=>\{)(?=.{0,10}\i=(\i)\.type,.{0,100}CONNECTED_ACCOUNT_VIEWED)/,
								replace:
									"if($self.handleAccountView($1,$2.type,$2.id)) return;",
							},
						},
					],
					async handleLink(e, t) {
						if (!e) return !1;
						let o = e.href;
						if (!o) return !1;
						for (let [r, i] of Object.entries(uy))
							if (
								!!kd.store[r] &&
								(i.shortlinkMatch?.test(o) &&
									(t?.preventDefault(), (o = await eD.resolveRedirect(o))),
								i.match.test(o))
							) {
								ft("Opened link in native app", X.Type.SUCCESS);
								let s = o.replace(i.match, i.replace);
								return (
									VencordNative.native.openExternal(s), t?.preventDefault(), !0
								);
							}
						return t?.defaultPrevented ? (window.open(o, "_blank"), !0) : !1;
					},
					handleAccountView(e, t, o) {
						let r = uy[t];
						if (r?.accountViewReplace && kd.store[t])
							return (
								VencordNative.native.openExternal(r.accountViewReplace(o)),
								e.preventDefault(),
								!0
							);
					},
				}));
		});
	var py,
		Ld,
		vP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(py = x({
				defaultLayout: {
					type: 4,
					options: [
						{ label: "List", value: 1, default: !0 },
						{ label: "Gallery", value: 2 },
					],
					description: "Which layout to use as default",
				},
				defaultSortOrder: {
					type: 4,
					options: [
						{ label: "Recently Active", value: 0, default: !0 },
						{ label: "Date Posted", value: 1 },
					],
					description: "Which sort order to use as default",
				},
			})),
				(Ld = h({
					name: "OverrideForumDefaults",
					description:
						"Allows you to override default forum layout/sort order. you can still change it on a per-channel basis",
					authors: [d.Inbestigator],
					patches: [
						{
							find: "getDefaultLayout(){",
							replacement: [
								{
									match: /getDefaultLayout\(\){/,
									replace: "$&return $self.getLayout();",
								},
								{
									match: /getDefaultSortOrder\(\){/,
									replace: "$&return $self.getSortOrder();",
								},
							],
						},
					],
					getLayout: () => py.store.defaultLayout,
					getSortOrder: () => py.store.defaultSortOrder,
					settings: py,
				}));
		});
	function bP(e) {
		_.dispatch({
			type: "POGGERMODE_SETTINGS_UPDATE",
			settings: { enabled: e, settingsVisible: e },
		});
	}
	function TP(e) {
		let t = {
			screenshakeEnabledLocations: { 0: !0, 1: !0, 2: !0 },
			shakeIntensity: 1,
			confettiSize: 16,
			confettiCount: 5,
			combosRequiredCount: 1,
		};
		switch (e) {
			case 0: {
				Object.assign(t, {
					screenshakeEnabledLocations: { 0: !0, 1: !1, 2: !1 },
					combosRequiredCount: 5,
				});
				break;
			}
			case 1: {
				Object.assign(t, { confettiSize: 12, confettiCount: 8 });
				break;
			}
			case 2: {
				Object.assign(t, {
					shakeIntensity: 20,
					confettiSize: 25,
					confettiCount: 15,
				});
				break;
			}
		}
		_.dispatch({ type: "POGGERMODE_SETTINGS_UPDATE", settings: t });
	}
	var SP,
		Ed,
		xP = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			b();
			SP = x({
				superIntensePartyMode: {
					description: "Party intensity",
					type: 4,
					options: [
						{ label: "Normal", value: 0, default: !0 },
						{ label: "Better", value: 1 },
						{ label: "Project X", value: 2 },
					],
					restartNeeded: !1,
					onChange: TP,
				},
			});
			rn("PartyMode", "Party mode \u{1F389}");
			Ed = h({
				name: "PartyMode",
				description:
					"Allows you to use party mode cause the party never ends \u2728",
				authors: [d.UwUDev],
				reporterTestable: 2,
				settings: SP,
				start() {
					bP(!0), TP(SP.store.superIntensePartyMode);
				},
				stop() {
					bP(!1);
				},
			});
		});
	function tD(e) {
		return !le.getGuild(e).hasFeature("INVITES_DISABLED");
	}
	function oD(e) {
		let o = [...le.getGuild(e).features, "INVITES_DISABLED"];
		Pt.patch({ url: bt.Endpoints.GUILD(e), body: { features: o } });
	}
	var Od,
		wP = g(() => {
			"use strict";
			a();
			re();
			P();
			T();
			b();
			Od = h({
				name: "PauseInvitesForever",
				tags: ["DisableInvitesForever"],
				description:
					"Brings back the option to pause invites indefinitely that stupit Discord removed.",
				authors: [d.Dolfies, d.amia],
				patches: [
					{
						find: "Messages.GUILD_INVITE_DISABLE_ACTION_SHEET_DESCRIPTION",
						group: !0,
						replacement: [
							{
								match:
									/children:\i\.\i\.\i\.GUILD_INVITE_DISABLE_ACTION_SHEET_DESCRIPTION/,
								replace:
									"children: $self.renderInvitesLabel({guildId:arguments[0].guildId,setChecked})",
							},
							{
								match:
									/\.INVITES_DISABLED\)(?=.+?\.Messages\.INVITES_PERMANENTLY_DISABLED_TIP.+?checked:(\i)).+?\[\1,(\i)\]=\i.useState\(\i\)/,
								replace: "$&,setChecked=$2",
							},
						],
					},
				],
				renderInvitesLabel: R.wrap(({ guildId: e, setChecked: t }) =>
					n(
						"div",
						null,
						Se.Messages.GUILD_INVITE_DISABLE_ACTION_SHEET_DESCRIPTION,
						tD(e) &&
							n(
								"a",
								{
									role: "button",
									onClick: () => {
										t(!0), oD(e);
									},
								},
								" Pause Indefinitely."
							)
					)
				),
			});
		});
	var dy,
		Fd,
		PP = g(() => {
			"use strict";
			a();
			F();
			P();
			Jo();
			T();
			(dy = x({
				lockout: {
					type: 3,
					default: !0,
					description: `Bypass the permission lockout prevention ("Pretty sure you don't want to do this")`,
					restartNeeded: !0,
				},
				onboarding: {
					type: 3,
					default: !0,
					description:
						'Bypass the onboarding requirements ("Making this change will make your server incompatible [...]")',
					restartNeeded: !0,
				},
			})),
				(Fd = h({
					name: "PermissionFreeWill",
					description:
						"Disables the client-side restrictions for channel permission management.",
					authors: [d.lewisakura],
					patches: [
						{
							find: ".STAGE_CHANNEL_CANNOT_OVERWRITE_PERMISSION",
							replacement: [
								{
									match: /case"DENY":.{0,50}if\((?=\i\.\i\.can)/,
									replace: "$&true||",
								},
							],
							predicate: () => dy.store.lockout,
						},
						{
							find: ".ONBOARDING_CHANNEL_THRESHOLD_WARNING",
							replacement: [
								{
									match: /{(\i:function\(\){return \i},?){2}}/,
									replace: (e) =>
										e.replaceAll(
											Yt(/return \i/g),
											"return ()=>Promise.resolve(true)"
										),
								},
							],
							predicate: () => dy.store.onboarding,
						},
					],
					settings: dy,
				}));
		});
	var MP = g(() => {});
	function nD(e) {
		return mi(e.toLowerCase().split("_"));
	}
	function _d(e) {
		return (e = IP[e] || e), Se.Messages[e] || nD(e);
	}
	function CP(e) {
		e === "USE_APPLICATION_COMMANDS"
			? (e = "USE_APPLICATION_COMMANDS_GUILD")
			: e === "SEND_VOICE_MESSAGES"
				? (e = "SEND_VOICE_MESSAGE_GUILD")
				: e !== "STREAM" && (e = IP[e] || e);
		let t = Se.Messages[`ROLE_PERMISSIONS_${e}_DESCRIPTION`];
		return t?.hasMarkdown ? Ce.parse(t.message) : typeof t == "string" ? t : "";
	}
	function Bd({ id: e }, t) {
		let o = le.getRoles(e);
		return [...t.roles, e]
			.map((r) => o[r])
			.sort((r, i) => i.position - r.position);
	}
	function AP(e) {
		switch (er.store.permissionsSortOrder) {
			case 0:
				return e.sort((t, o) => o.position - t.position);
			case 1:
				return e.sort((t, o) => t.position - o.position);
			default:
				return e;
		}
	}
	function Ud(e, t) {
		let o = le.getRoles(t);
		return e.sort((r, i) => {
			if (r.type !== 0 || i.type !== 0) return 0;
			let s = o[r.id];
			return o[i.id].position - s.position;
		});
	}
	var io,
		IP,
		gl = g(() => {
			"use strict";
			a();
			tt();
			On();
			b();
			yl();
			hl();
			io = be("vc-permviewer-");
			IP = {
				MANAGE_GUILD: "MANAGE_SERVER",
				MANAGE_GUILD_EXPRESSIONS: "MANAGE_EXPRESSIONS",
				CREATE_GUILD_EXPRESSIONS: "CREATE_EXPRESSIONS",
				MODERATE_MEMBERS: "MODERATE_MEMBER",
				STREAM: "VIDEO",
				SEND_VOICE_MESSAGES: "ROLE_PERMISSIONS_SEND_VOICE_MESSAGE",
			};
		});
	function my() {
		return n(
			"svg",
			{ height: "24", width: "24", viewBox: "0 0 24 24" },
			n("title", null, "Denied"),
			n("path", {
				fill: "var(--status-danger)",
				d: "M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z",
			})
		);
	}
	function fy() {
		return n(
			"svg",
			{ height: "24", width: "24", viewBox: "0 0 24 24" },
			n("title", null, "Allowed"),
			n("path", {
				fill: "var(--text-positive)",
				d: "M8.99991 16.17L4.82991 12L3.40991 13.41L8.99991 19L20.9999 7.00003L19.5899 5.59003L8.99991 16.17ZZ",
			})
		);
	}
	function RP() {
		return n(
			"svg",
			{ height: "24", width: "24", viewBox: "0 0 16 16" },
			n(
				"g",
				null,
				n("title", null, "Not overwritten"),
				n("polygon", {
					fill: "var(--text-normal)",
					points: "12 2.32 10.513 2 4 13.68 5.487 14",
				})
			)
		);
	}
	var kP = g(() => {
		"use strict";
		a();
	});
	function iD(e, t, o) {
		return ge((r) =>
			n(cD, { modalProps: r, permissions: e, guild: t, header: o })
		);
	}
	function sD({ permissions: e, guild: t, modalProps: o, header: r }) {
		e.sort((u, p) => u.type - p.type),
			Oe(
				[Le],
				() => Le.getMemberIds(t.id),
				null,
				(u, p) => u.length === p.length
			),
			ue(() => {
				let u = e
					.filter((p) => p.type === 1 && !Le.isMember(t.id, p.id))
					.map(({ id: p }) => p);
				_.dispatch({
					type: "GUILD_MEMBERS_REQUEST",
					guildIds: [t.id],
					userIds: u,
				});
			}, []);
		let [i, s] = z(0),
			l = e[i],
			c = le.getRoles(t.id);
		return n(
			Te,
			{ ...o, size: "large" },
			n(
				Ee,
				null,
				n(
					Z,
					{ className: io("perms-title"), variant: "heading-lg/semibold" },
					r,
					" permissions:"
				),
				n(rt, { onClick: o.onClose })
			),
			n(
				Ae,
				null,
				!l &&
					n(
						"div",
						{ className: io("perms-no-perms") },
						n(Z, { variant: "heading-lg/normal" }, "No permissions to display!")
					),
				l &&
					n(
						"div",
						{ className: io("perms-container") },
						n(
							"div",
							{ className: io("perms-list") },
							e.map((u, p) => {
								let m = D.getUser(u.id ?? ""),
									y = c[u.id ?? ""];
								return n(
									"button",
									{ className: io("perms-list-item-btn"), onClick: () => s(p) },
									n(
										"div",
										{
											className: io("perms-list-item", {
												"perms-list-item-active": i === p,
											}),
											onContextMenu: (v) => {
												u.type === 0
													? Qt.openContextMenu(v, () =>
															n(aD, {
																guild: t,
																roleId: u.id,
																onClose: o.onClose,
															})
														)
													: u.type === 1 &&
														Qt.openContextMenu(v, () =>
															n(lD, { userId: u.id, onClose: o.onClose })
														);
											},
										},
										(u.type === 0 || u.type === 2) &&
											n("span", {
												className: io("perms-role-circle"),
												style: {
													backgroundColor:
														y?.colorString ?? "var(--primary-300)",
												},
											}),
										u.type === 1 &&
											m !== void 0 &&
											n("img", {
												className: io("perms-user-img"),
												src: m.getAvatarURL(void 0, void 0, !1),
											}),
										n(
											Z,
											{ variant: "text-md/normal" },
											u.type === 0
												? (y?.name ?? "Unknown Role")
												: u.type === 1
													? ((m && Ln(m)) ?? "Unknown User")
													: n(
															pe,
															{
																style: { gap: "0.2em", justifyItems: "center" },
															},
															"@owner",
															n(Ig, {
																height: 18,
																width: 18,
																"aria-hidden": "true",
															})
														)
										)
									)
								);
							})
						),
						n(
							"div",
							{ className: io("perms-perms") },
							Object.entries(we).map(([u, p]) =>
								n(
									"div",
									{ className: io("perms-perms-item") },
									n(
										"div",
										{ className: io("perms-perms-item-icon") },
										(() => {
											let {
												permissions: m,
												overwriteAllow: y,
												overwriteDeny: v,
											} = l;
											return m
												? (m & p) === p
													? fy()
													: my()
												: y && (y & p) === p
													? fy()
													: v && (v & p) === p
														? my()
														: RP();
										})()
									),
									n(Z, { variant: "text-md/normal" }, _d(u)),
									n(te, { text: CP(u) || "No Description" }, (m) =>
										n(xa, { ...m })
									)
								)
							)
						)
					)
			)
		);
	}
	function aD({ guild: e, roleId: t, onClose: o }) {
		return n(
			E.Menu,
			{
				navId: io("role-context-menu"),
				onClose: Qt.closeContextMenu,
				"aria-label": "Role Options",
			},
			n(E.MenuItem, {
				id: "vc-copy-role-id",
				label: Se.Messages.COPY_ID_ROLE,
				action: () => {
					Gt.copy(t);
				},
			}),
			er.store.unsafeViewAsRole &&
				n(E.MenuItem, {
					id: "vc-pw-view-as-role",
					label: Se.Messages.VIEW_AS_ROLE,
					action: () => {
						let r = le.getRole(e.id, t);
						!r ||
							(o(),
							_.dispatch({
								type: "IMPERSONATE_UPDATE",
								guildId: e.id,
								data: { type: "ROLES", roles: { [t]: r } },
							}));
					},
				})
		);
	}
	function lD({ userId: e, onClose: t }) {
		return n(
			E.Menu,
			{
				navId: io("user-context-menu"),
				onClose: Qt.closeContextMenu,
				"aria-label": "User Options",
			},
			n(E.MenuItem, {
				id: "vc-copy-user-id",
				label: Se.Messages.COPY_ID_USER,
				action: () => {
					Gt.copy(e);
				},
			})
		);
	}
	var cD,
		Cs,
		hl = g(() => {
			"use strict";
			a();
			re();
			kt();
			yt();
			it();
			Ke();
			b();
			yl();
			gl();
			kP();
			(cD = R.wrap(sD)), (Cs = iD);
		});
	function dD({ guild: e, guildMember: t, forceOpen: o = !1 }) {
		let r = er.use(["permissionsSortOrder"]),
			[i, s] = dt(() => {
				let l = [],
					c = Bd(e, t),
					u = c.map((p) => ({ type: 0, ...p }));
				if (e.ownerId === t.userId) {
					u.push({
						type: 2,
						permissions: Object.values(we).reduce((m, y) => m | y, 0n),
					});
					let p = Se.Messages.GUILD_OWNER || "Server Owner";
					l.push({
						permission: p,
						roleColor: "var(--primary-300)",
						rolePosition: 1 / 0,
					});
				}
				AP(c);
				for (let [p, m] of Object.entries(we))
					for (let { permissions: y, colorString: v, position: N } of c)
						if ((y & m) === m) {
							l.push({
								permission: _d(p),
								roleColor: v || "var(--primary-300)",
								rolePosition: N,
							});
							break;
						}
				return l.sort((p, m) => m.rolePosition - p.rolePosition), [u, l];
			}, [r.permissionsSortOrder]);
		return n(
			Pg,
			{
				forceOpen: o,
				headerText: "Permissions",
				moreTooltipText: "Role Details",
				onMoreClick: () => Cs(i, e, t.nick || D.getUser(t.userId).username),
				onDropDownClick: (l) => (er.store.defaultPermissionsDropdownState = !l),
				defaultState: er.store.defaultPermissionsDropdownState,
				buttons: [
					n(
						te,
						{
							text: `Sorting by ${r.permissionsSortOrder === 0 ? "Highest Role" : "Lowest Role"}`,
						},
						(l) =>
							n(
								"button",
								{
									...l,
									className: io("userperms-sortorder-btn"),
									onClick: () => {
										r.permissionsSortOrder =
											r.permissionsSortOrder === 0 ? 1 : 0;
									},
								},
								n(
									"svg",
									{
										width: "20",
										height: "20",
										viewBox: "0 96 960 960",
										transform:
											r.permissionsSortOrder === 0
												? "scale(1 1)"
												: "scale(1 -1)",
									},
									n("path", {
										fill: "var(--text-normal)",
										d: "M440 896V409L216 633l-56-57 320-320 320 320-56 57-224-224v487h-80Z",
									})
								)
							)
					),
				],
			},
			s.length > 0 &&
				n(
					"div",
					{ className: H(uD.root) },
					s.map(({ permission: l, roleColor: c }) =>
						n(
							"div",
							{ className: H(vl.role) },
							n(
								"div",
								{ className: vl.roleRemoveButton },
								n("span", {
									className: H(pD.roleCircle, vl.roleCircle),
									style: { backgroundColor: c },
								})
							),
							n(
								"div",
								{ className: vl.roleName },
								n(
									Z,
									{ className: vl.roleNameOverflow, variant: "text-xs/medium" },
									l
								)
							)
						)
					)
				)
		);
	}
	var uD,
		vl,
		pD,
		DP,
		LP = g(() => {
			"use strict";
			a();
			re();
			Mg();
			me();
			U();
			b();
			yl();
			gl();
			hl();
			(uD = C("root", "showMoreButton", "collapseButton")),
				(vl = C("role", "roleCircle", "roleName")),
				(pD = C("roleCircle", "dot", "dotBorderColor"));
			DP = R.wrap(dD, { noop: !0 });
		});
	function gy(e, t, o) {
		return o === 0 && !Le.isMember(e, t)
			? null
			: n(E.MenuItem, {
					id: "perm-viewer-permissions",
					label: "Permissions",
					action: () => {
						let r = le.getGuild(e),
							i,
							s;
						switch (o) {
							case 0: {
								let l = Le.getMember(e, t);
								(i = Bd(r, l).map((c) => ({ type: 0, ...c }))),
									r.ownerId === t &&
										i.push({
											type: 2,
											permissions: Object.values(we).reduce(
												(c, u) => c | u,
												0n
											),
										}),
									(s = l.nick ?? D.getUser(l.userId).username);
								break;
							}
							case 1: {
								let l = oe.getChannel(t);
								(i = Ud(
									Object.values(l.permissionOverwrites).map(
										({ id: c, allow: u, deny: p, type: m }) => ({
											type: m,
											id: c,
											overwriteAllow: u,
											overwriteDeny: p,
										})
									),
									e
								)),
									(s = l.name);
								break;
							}
							default: {
								(i = Object.values(le.getRoles(r.id)).map((l) => ({
									type: 0,
									...l,
								}))),
									(s = r.name);
								break;
							}
						}
						Cs(i, r, s);
					},
				});
	}
	function Gd(e, t) {
		return (o, r) => {
			if (
				!r ||
				(t === 0 && !r.user) ||
				(t === 2 && !r.guild) ||
				(t === 1 && (!r.channel || !r.guild))
			)
				return;
			let i = Ve(e, o),
				s = (() => {
					switch (t) {
						case 0:
							return gy(r.guildId, r.user.id, t);
						case 1:
							return gy(r.guild.id, r.channel.id, t);
						case 2:
							return gy(r.guild.id);
						default:
							return null;
					}
				})();
			s != null &&
				(i
					? i.push(s)
					: e === "roles" &&
						r.guildId &&
						o.splice(-1, 0, n(E.MenuGroup, null, s)));
		};
	}
	var mD,
		$d,
		er,
		Hd,
		yl = g(() => {
			"use strict";
			a();
			MP();
			ho();
			F();
			re();
			yt();
			P();
			me();
			T();
			U();
			b();
			hl();
			LP();
			gl();
			(mD = C("container", "scroller", "list")),
				($d = C("button", "buttonInner", "icon", "banner")),
				(er = x({
					permissionsSortOrder: {
						description:
							"The sort method used for defining which role grants an user a certain permission",
						type: 4,
						options: [
							{ label: "Highest Role", value: 0, default: !0 },
							{ label: "Lowest Role", value: 1 },
						],
					},
					defaultPermissionsDropdownState: {
						description:
							"Whether the permissions dropdown on user popouts should be open by default",
						type: 3,
						default: !1,
					},
				}));
			Hd = h({
				name: "PermissionsViewer",
				description:
					"View the permissions a user or channel has, and the roles of a server",
				authors: [d.Nuckyz, d.Ven],
				settings: er,
				patches: [
					{
						find: ".VIEW_ALL_ROLES,",
						replacement: {
							match:
								/children:"\+"\.concat\(\i\.length-\i\.length\).{0,20}\}\),/,
							replace: "$&$self.ViewPermissionsButton(arguments[0]),",
						},
					},
				],
				ViewPermissionsButton: R.wrap(
					({ guild: e, guildMember: t }) =>
						n(
							Jr,
							{
								position: "bottom",
								align: "center",
								renderPopout: () =>
									n(
										ic,
										{ className: mD.container, style: { width: "500px" } },
										n(DP, { guild: e, guildMember: t, forceOpen: !0 })
									),
							},
							(o) =>
								n(
									hr,
									{ text: "View Permissions" },
									n(
										M,
										{
											...o,
											color: M.Colors.CUSTOM,
											look: M.Looks.FILLED,
											size: M.Sizes.NONE,
											innerClassName: H($d.buttonInner, $d.icon),
											className: H(
												$d.button,
												$d.icon,
												"vc-permviewer-role-button"
											),
										},
										n(Rg, { height: "16", width: "16" })
									)
								)
						),
					{ noop: !0 }
				),
				contextMenus: {
					"user-context": Gd("roles", 0),
					"channel-context": Gd(["mute-channel", "unmute-channel"], 1),
					"guild-context": Gd("privacy", 2),
					"guild-header-popout": Gd("privacy", 2),
				},
			});
		});
	function EP(e) {
		let t = e instanceof File,
			o = t ? URL.createObjectURL(e) : e;
		return new Promise((r, i) => {
			let s = new Image();
			(s.onload = () => {
				t && URL.revokeObjectURL(o), r(s);
			}),
				(s.onerror = (l, c, u, p, m) => i(m || l)),
				(s.crossOrigin = "Anonymous"),
				(s.src = o);
		});
	}
	async function vD(e, t, o) {
		for (let r of e)
			switch (r.name) {
				case "image":
					let i = yD.getUpload(t.channel.id, r.name, Wt.SlashCommand);
					if (i) {
						if (!i.isImage)
							throw (
								(ri.clearAll(t.channel.id, Wt.SlashCommand),
								"Upload is not an image")
							);
						return i.item.file;
					}
					break;
				case "url":
					return r.value;
				case "user":
					try {
						return (await oo.getUser(r.value))
							.getAvatarURL(o ? void 0 : t.guild?.id, 2048)
							.replace(/\?size=\d+$/, "?size=2048");
					} catch (s) {
						throw (
							(console.error(
								`[petpet] Failed to fetch user
`,
								s
							),
							ri.clearAll(t.channel.id, Wt.SlashCommand),
							"Failed to fetch user. Check the console for more info.")
						);
					}
			}
		return ri.clearAll(t.channel.id, Wt.SlashCommand), null;
	}
	var As,
		fD,
		gD,
		zd,
		hD,
		yD,
		Wd,
		OP = g(() => {
			"use strict";
			a();
			jo();
			P();
			co();
			T();
			U();
			b();
			(As = j0(k1())),
				(fD = 20),
				(gD = 128),
				(zd = 10),
				(hD = pn(() =>
					Promise.all(
						Array.from({ length: zd }, (e, t) =>
							EP(
								`https://raw.githubusercontent.com/VenPlugs/petpet/main/frames/pet${t}.gif`
							)
						)
					)
				)),
				(yD = K("UploadAttachmentStore"));
			Wd = h({
				name: "petpet",
				description:
					"Adds a /petpet slash command to create headpet gifs from any image",
				authors: [d.Ven],
				dependencies: ["CommandsAPI"],
				commands: [
					{
						inputType: 0,
						name: "petpet",
						description:
							"Create a petpet gif. You can only specify one of the image options",
						options: [
							{
								name: "delay",
								description: "The delay between each frame. Defaults to 20.",
								type: 4,
							},
							{
								name: "resolution",
								description:
									"Resolution for the gif. Defaults to 120. If you enter an insane number and it freezes Discord that's your fault.",
								type: 4,
							},
							{
								name: "image",
								description: "Image attachment to use",
								type: 11,
							},
							{ name: "url", description: "URL to fetch image from", type: 3 },
							{
								name: "user",
								description: "User whose avatar to use as image",
								type: 6,
							},
							{
								name: "no-server-pfp",
								description:
									"Use the normal avatar instead of the server specific one when using the 'user' option",
								type: 5,
							},
						],
						execute: async (e, t) => {
							let o = await hD(),
								r = qt(e, "no-server-pfp", !1);
							try {
								var i = await vD(e, t, r);
								if (!i) throw "No Image specified!";
							} catch (v) {
								ri.clearAll(t.channel.id, Wt.SlashCommand),
									Je(t.channel.id, { content: String(v) });
								return;
							}
							let s = await EP(i),
								l = qt(e, "delay", fD),
								c = qt(e, "resolution", gD),
								u = (0, As.GIFEncoder)(),
								p = document.createElement("canvas");
							p.width = p.height = c;
							let m = p.getContext("2d");
							ri.clearAll(t.channel.id, Wt.SlashCommand);
							for (let v = 0; v < zd; v++) {
								m.clearRect(0, 0, p.width, p.height);
								let N = v < zd / 2 ? v : zd - v,
									w = 0.8 + N * 0.02,
									I = 0.8 - N * 0.05,
									A = (1 - w) * 0.5 + 0.1,
									L = 1 - I - 0.08;
								m.drawImage(s, A * c, L * c, w * c, I * c),
									m.drawImage(o[v], 0, 0, c, c);
								let { data: k } = m.getImageData(0, 0, c, c),
									$ = (0, As.quantize)(k, 256),
									j = (0, As.applyPalette)(k, $);
								u.writeFrame(j, c, c, {
									transparent: !0,
									palette: $,
									delay: l,
								});
							}
							u.finish();
							let y = new File([u.bytesView()], "petpet.gif", {
								type: "image/gif",
							});
							setTimeout(
								() => la.promptToUpload([y], t.channel, Wt.ChannelMessage),
								10
							);
						},
					},
				],
			});
		});
	var FP = g(() => {});
	var _P,
		jd,
		BP = g(() => {
			"use strict";
			a();
			FP();
			F();
			re();
			P();
			T();
			b();
			(_P = x({
				loop: {
					description: "Whether to make the PiP video loop or not",
					type: 3,
					default: !0,
					restartNeeded: !1,
				},
			})),
				(jd = h({
					name: "PictureInPicture",
					description:
						"Adds picture in picture to videos (next to the Download button)",
					authors: [d.Lumap],
					settings: _P,
					patches: [
						{
							find: ".removeMosaicItemHoverButton),",
							replacement: {
								match: /\.nonMediaMosaicItem\]:!(\i).{0,50}?children:\[\S,(\S)/,
								replace: "$&,$1&&$2&&$self.renderPiPButton(),",
							},
						},
					],
					renderPiPButton: R.wrap(
						() =>
							n(te, { text: "Toggle Picture in Picture" }, (e) =>
								n(
									"div",
									{
										...e,
										className: "vc-pip-button",
										role: "button",
										style: {
											cursor: "pointer",
											paddingTop: "4px",
											paddingLeft: "4px",
											paddingRight: "4px",
										},
										onClick: (t) => {
											let o =
													t.currentTarget.parentNode.parentNode.querySelector(
														"video"
													),
												r = document.body.appendChild(o.cloneNode(!0));
											(r.loop = _P.store.loop),
												(r.style.display = "none"),
												(r.onleavepictureinpicture = () => r.remove());
											function i() {
												(r.currentTime = o.currentTime),
													r.requestPictureInPicture(),
													o.pause(),
													r.play();
											}
											r.readyState === 4 ? i() : (r.onloadedmetadata = i);
										},
									},
									n(
										"svg",
										{ width: "24px", height: "24px", viewBox: "0 0 24 24" },
										n("path", {
											fill: "currentColor",
											d: "M21 3a1 1 0 0 1 1 1v7h-2V5H4v14h6v2H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h18zm0 10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h8zm-1 2h-6v4h6v-4z",
										})
									)
								)
							),
						{ noop: !0 }
					),
				}));
		});
	var UP = g(() => {});
	var $P,
		qd = g(() => {
			"use strict";
			a();
			$P = [
				1752220, 3066993, 3447003, 10181046, 15277667, 15844367, 15105570,
				15158332, 9807270, 6323595, 1146986, 2067276, 2123412, 7419530,
				11342935, 12745742, 11027200, 10038562, 9936031, 5533306,
			];
		});
	async function tr(e) {
		let { id: t } = D.getCurrentUser();
		await wt(GP + t, e);
	}
	async function yy() {
		let e = D.getCurrentUser()?.id;
		await bD(e), await PD(e), so();
	}
	async function bD(e) {
		ye = (await lt(GP + e)) ?? [];
	}
	function zP(e) {
		return ye.find((t) => t.id === e);
	}
	async function WP(e) {
		ye.push(e), await tr(ye);
	}
	async function jP(e) {
		let t = ye.findIndex((o) => o.id === e.id);
		t !== -1 && ((ye[t] = e), await tr(ye));
	}
	async function qP(e, t) {
		let o = ye.find((r) => r.id === t);
		!o || o.channels.includes(e) || (o.channels.push(e), await tr(ye));
	}
	async function KP(e) {
		let t = ye.find((o) => o.channels.includes(e));
		!t || ((t.channels = t.channels.filter((o) => o !== e)), await tr(ye));
	}
	async function YP(e) {
		!ye.find((o) => o.id === e) ||
			((ye = ye.filter((o) => o.id !== e)), await tr(ye));
	}
	async function ZP(e, t = !0) {
		let o = ye.find((r) => r.id === e);
		!o || ((o.collapsed = t), await tr(ye));
	}
	function bl(e) {
		return ye.some((t) => t.channels.includes(e));
	}
	function QP() {
		return ye.length;
	}
	function XP() {
		if (Yo.store.pinOrder === 0) {
			let e = Ty.getPrivateChannelIds();
			return ye
				.filter((t) => !t.collapsed)
				.flatMap((t) => e.filter((o) => t.channels.includes(o)));
		}
		return ye.filter((e) => !e.collapsed).flatMap((e) => e.channels);
	}
	function JP() {
		return ye.reduce(
			(e, t) => (e.push(t.channels.length === 0 ? 1 : t.channels.length), e),
			[]
		);
	}
	function tM(e, t, o) {
		!e[t] || !e[o] || ([e[t], e[o]] = [e[o], e[t]]);
	}
	async function Sy(e, t) {
		let o = ye.findIndex((i) => i.id === e),
			r = o + t;
		tM(ye, o, r), await tr(ye);
	}
	async function by(e, t) {
		let o = ye.find((s) => s.channels.includes(e));
		if (!o) return;
		let r = o.channels.indexOf(e),
			i = r + t;
		tM(o.channels, r, i), await tr(ye);
	}
	async function xD() {
		if (ye.some((o) => o.id === "oldPins")) return await wt(hy, !0);
		let e = TD(),
			t = [...new Set(e)].filter(
				(o) => !ye.some((r) => r.channels.includes(o))
			);
		t?.length &&
			ye.push({ id: "oldPins", name: "Pins", color: 10070709, channels: t }),
			await wt(hy, !0);
	}
	async function wD(e) {
		let t = await lt(SD + e);
		ye.length === 0 &&
			t?.length &&
			ye.push(...t.filter((o) => o.id !== "oldPins")),
			await wt(HP, !0);
	}
	async function PD(e) {
		let t = await lt(HP),
			o = await lt(hy);
		(t && o) || (t || (await wD(e)), o || (await xD()), await tr(ye));
	}
	var GP,
		hy,
		HP,
		SD,
		ye,
		VP,
		Sl,
		eM,
		vy,
		TD,
		Yd = g(() => {
			"use strict";
			a();
			$o();
			F();
			b();
			qd();
			Tl();
			(GP = "PinDMsCategories-"),
				(hy = "PinDMsMigratedPinDMs"),
				(HP = "PinDMsMigratedOldCategories"),
				(SD = "BetterPinDMsCategories-"),
				(ye = []);
			(VP = (e, t, o) => {
				let r = e[t],
					i = e[t + o];
				return r && i;
			}),
				(Sl = (e, t) => {
					let o = ye.findIndex((r) => r.id === e);
					return VP(ye, o, t);
				}),
				(eM = (e) => Sl(e, -1) || Sl(e, 1)),
				(vy = (e, t) => {
					let o = ye.find((i) => i.channels.includes(e));
					if (!o) return !1;
					let r = o.channels.indexOf(e);
					return VP(o.channels, r, t);
				});
			TD = () => (he.plugins.PinDMs.pinnedDMs || void 0)?.split(",");
		});
	function ND(e, t) {
		let [o, r] = z(null);
		return (
			ue(() => {
				e
					? r(zP(e))
					: t &&
						r({
							id: X.genId(),
							name: `Pin Category ${ye.length + 1}`,
							color: 10070709,
							collapsed: !1,
							channels: [t],
						});
			}, [e, t]),
			{ category: o, setCategory: r }
		);
	}
	function RD({ categoryId: e, modalProps: t, initalChannelId: o }) {
		let { category: r, setCategory: i } = ND(e, o);
		if (!r) return null;
		let s = async (l) => {
			l.preventDefault(), e ? await jP(r) : await WP(r), so(), t.onClose();
		};
		return n(
			Te,
			{ ...t },
			n(
				Ee,
				null,
				n(
					Z,
					{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
					e ? "Edit" : "New",
					" Category"
				)
			),
			n(
				"form",
				{ onSubmit: s },
				n(
					Ae,
					{ className: AD("content") },
					n(
						S.FormSection,
						null,
						n(S.FormTitle, null, "Name"),
						n(mt, { value: r.name, onChange: (l) => i({ ...r, name: l }) })
					),
					n(S.FormDivider, null),
					n(
						S.FormSection,
						null,
						n(S.FormTitle, null, "Color"),
						n(CD, {
							key: r.name,
							defaultColor: 10070709,
							colors: $P,
							onChange: (l) => i({ ...r, color: l }),
							value: r.color,
							renderDefaultButton: () => null,
							renderCustomButton: () =>
								n(ID, {
									color: r.color,
									onChange: (l) => i({ ...r, color: l }),
									key: r.name,
									showEyeDropper: !1,
								}),
						})
					)
				),
				n(
					ht,
					null,
					n(
						M,
						{ type: "submit", onClick: s, disabled: !r.name },
						e ? "Save" : "Create"
					)
				)
			)
		);
	}
	var ID,
		CD,
		xy,
		AD,
		Zd,
		wy = g(() => {
			"use strict";
			a();
			tt();
			Ke();
			U();
			b();
			qd();
			Yd();
			Tl();
			(ID = ae(
				".Messages.USER_SETTINGS_PROFILE_COLOR_SELECT_COLOR",
				".BACKGROUND_PRIMARY)"
			)),
				(CD = po("ColorPicker", "CustomColorPicker")),
				(xy = Rn(
					'name:"UserSettings"',
					/createPromise:.{0,20}Promise\.all\((\[\i\.\i\("?.+?"?\).+?\])\).then\(\i\.bind\(\i,"?(.+?)"?\)\).{0,50}"UserSettings"/
				)),
				(AD = be("vc-pindms-modal-"));
			Zd = (e, t) =>
				pa(
					async () => (
						await xy(),
						(o) => n(RD, { categoryId: e, modalProps: o, initalChannelId: t })
					)
				);
		});
	function oM(e) {
		let t = bl(e);
		return n(
			E.MenuItem,
			{ id: "pin-dm", label: "Pin DMs" },
			!t &&
				n(
					f,
					null,
					n(E.MenuItem, {
						id: "vc-add-category",
						label: "Add Category",
						color: "brand",
						action: () => Zd(null, e),
					}),
					n(E.MenuSeparator, null),
					ye.map((o) =>
						n(E.MenuItem, {
							id: `pin-category-${o.name}`,
							label: o.name,
							action: () => qP(e, o.id).then(so),
						})
					)
				),
			t &&
				n(
					f,
					null,
					n(E.MenuItem, {
						id: "unpin-dm",
						label: "Unpin DM",
						color: "danger",
						action: () => KP(e).then(so),
					}),
					Yo.store.pinOrder === 1 &&
						vy(e, -1) &&
						n(E.MenuItem, {
							id: "move-up",
							label: "Move Up",
							action: () => by(e, -1).then(so),
						}),
					Yo.store.pinOrder === 1 &&
						vy(e, 1) &&
						n(E.MenuItem, {
							id: "move-down",
							label: "Move Down",
							action: () => by(e, 1).then(so),
						})
				)
		);
	}
	var kD,
		DD,
		nM,
		rM = g(() => {
			"use strict";
			a();
			ho();
			b();
			Yd();
			Tl();
			wy();
			(kD = (e, t) => {
				Ve("leave-channel", e)?.unshift(oM(t.channel.id));
			}),
				(DD = (e, t) => {
					let o = Ve("close-dm", e);
					if (o) {
						let r = o.findIndex((i) => i?.props?.id === "close-dm");
						o.splice(r, 0, oM(t.channel.id));
					}
				}),
				(nM = { "gdm-context": kD, "user-context": DD });
		});
	var iM,
		Ty,
		sM,
		so,
		Yo,
		Qd,
		Tl = g(() => {
			"use strict";
			a();
			UP();
			F();
			re();
			P();
			me();
			T();
			U();
			b();
			rM();
			wy();
			qd();
			Yd();
			(iM = C("privateChannelsHeaderContainer")),
				(Ty = K("PrivateChannelSortStore")),
				(so = () => sM?.props?._forceUpdate?.()),
				(Yo = x({
					pinOrder: {
						type: 4,
						description: "Which order should pinned DMs be displayed in?",
						options: [
							{ label: "Most recent message", value: 0, default: !0 },
							{ label: "Custom (right click channels to reorder)", value: 1 },
						],
						onChange: () => so(),
					},
					dmSectioncollapsed: {
						type: 3,
						description: "Collapse DM sections",
						default: !1,
						onChange: () => so(),
					},
				})),
				(Qd = h({
					name: "PinDMs",
					description:
						"Allows you to pin private channels to the top of your DM list. To pin/unpin or reorder pins, right click DMs",
					authors: [d.Ven, d.Aria],
					settings: Yo,
					contextMenus: nM,
					patches: [
						{
							find: ".privateChannelsHeaderContainer,",
							replacement: [
								{
									match: /(?<=\i,{channels:\i,)privateChannelIds:(\i)/,
									replace: "privateChannelIds:$1.filter(c=>!$self.isPinned(c))",
								},
								{
									match: /(?<=renderRow:this\.renderRow,)sections:\[.+?1\)]/,
									replace: "...$self.makeProps(this,{$&})",
								},
								{
									match:
										/"renderRow",(\i)=>{(?<="renderDM",.+?(\i\.\i),\{channel:.+?)/,
									replace:
										"$&if($self.isChannelIndex($1.section, $1.row))return $self.renderChannel($1.section,$1.row,$2)();",
								},
								{
									match: /"renderSection",(\i)=>{/,
									replace:
										"$&if($self.isCategoryIndex($1.section))return $self.renderCategory($1);",
								},
								{
									match: /(?<=span",{)className:\i\.headerText,/,
									replace: "...$self.makeSpanProps(),$&",
								},
								{
									match: /(?<="getRowHeight",.{1,100}return 1===)\i/,
									replace: "($&-$self.categoryLen())",
								},
								{
									match: /"getRowHeight",\((\i),(\i)\)=>{/,
									replace: "$&if($self.isChannelHidden($1,$2))return 0;",
								},
								{
									match: /(?<=scrollTo\(\{to:\i\}\):\(\i\+=)(\d+)\*\(.+?(?=,)/,
									replace:
										"$self.getScrollOffset(arguments[0],$1,this.props.padding,this.state.preRenderedChildren,$&)",
								},
								{
									match:
										/(scrollToChannel\(\i\){.{1,300})(this\.props\.privateChannelIds)/,
									replace: "$1[...$2,...$self.getAllUncollapsedChannels()]",
								},
							],
						},
						{
							find: '.FRIENDS},"friends"',
							replacement: {
								match:
									/(?<=\i=\i=>{).{1,100}premiumTabSelected.{1,800}showDMHeader:.+?,/,
								replace:
									"let forceUpdate = Vencord.Util.useForceUpdater();$&_forceUpdate:forceUpdate,",
							},
						},
						{
							find: ".APPLICATION_STORE&&",
							replacement: {
								match: /(?<=\i=__OVERLAY__\?\i:\[\.\.\.\i\(\),\.\.\.)\i/,
								replace:
									"$self.getAllUncollapsedChannels().concat($&.filter(c=>!$self.isPinned(c)))",
							},
						},
						{
							find: ".getFlattenedGuildIds()],",
							replacement: {
								match: /(?<=\i===\i\.ME\?)\i\.\i\.getPrivateChannelIds\(\)/,
								replace:
									"$self.getAllUncollapsedChannels().concat($&.filter(c=>!$self.isPinned(c)))",
							},
						},
					],
					sections: null,
					set _instance(e) {
						(this.instance = e), (sM = e);
					},
					startAt: "WebpackReady",
					start: yy,
					flux: { CONNECTION_OPEN: yy },
					isPinned: bl,
					categoryLen: QP,
					getSections: JP,
					getAllUncollapsedChannels: XP,
					requireSettingsMenu: xy,
					makeProps(e, { sections: t }) {
						return (
							(this._instance = e),
							(this.sections = t),
							this.sections.splice(1, 0, ...this.getSections()),
							this.instance?.props?.privateChannelIds?.length === 0 &&
								(this.sections[this.sections.length - 1] = 0),
							{ sections: this.sections, chunkSize: this.getChunkSize() }
						);
					},
					makeSpanProps() {
						return {
							onClick: () => this.collapseDMList(),
							role: "button",
							style: { cursor: "pointer" },
						};
					},
					getChunkSize() {
						let e = this.getSections();
						return (
							(e.length * 40 + e.reduce((o, r) => (o += r + 44), 0) + 256) * 1.5
						);
					},
					isCategoryIndex(e) {
						return this.sections && e > 0 && e < this.sections.length - 1;
					},
					isChannelIndex(e, t) {
						if (Yo.store.dmSectioncollapsed && e !== 0) return !0;
						let o = ye[e - 1];
						return (
							this.isCategoryIndex(e) &&
							(o?.channels?.length === 0 || o?.channels[t])
						);
					},
					isDMSectioncollapsed() {
						return Yo.store.dmSectioncollapsed;
					},
					collapseDMList() {
						(Yo.store.dmSectioncollapsed = !Yo.store.dmSectioncollapsed), so();
					},
					isChannelHidden(e, t) {
						if (e === 0) return !1;
						if (
							Yo.store.dmSectioncollapsed &&
							this.getSections().length + 1 === e
						)
							return !0;
						if (!this.instance || !this.isChannelIndex(e, t)) return !1;
						let o = ye[e - 1];
						return o
							? o.collapsed &&
									this.instance.props.selectedChannelId !==
										this.getCategoryChannels(o)[t]
							: !1;
					},
					getScrollOffset(e, t, o, r, i) {
						return bl(e)
							? t * (this.getAllUncollapsedChannels().indexOf(e) + r) + o
							: (t + o) * 2 + t * this.getAllUncollapsedChannels().length + i;
					},
					renderCategory: R.wrap(
						({ section: e }) => {
							let t = ye[e - 1];
							return t
								? n(
										"h2",
										{
											className: H(
												iM.privateChannelsHeaderContainer,
												"vc-pindms-section-container",
												t.collapsed ? "vc-pindms-collapsed" : ""
											),
											style: {
												color: `#${t.color.toString(16).padStart(6, "0")}`,
											},
											onClick: async () => {
												await ZP(t.id, !t.collapsed), so();
											},
											onContextMenu: (o) => {
												Qt.openContextMenu(o, () =>
													n(
														E.Menu,
														{
															navId: "vc-pindms-header-menu",
															onClose: () =>
																_.dispatch({ type: "CONTEXT_MENU_CLOSE" }),
															color: "danger",
															"aria-label": "Pin DMs Category Menu",
														},
														n(E.MenuItem, {
															id: "vc-pindms-edit-category",
															label: "Edit Category",
															action: () => Zd(t.id, null),
														}),
														eM(t.id) &&
															n(
																f,
																null,
																Sl(t.id, -1) &&
																	n(E.MenuItem, {
																		id: "vc-pindms-move-category-up",
																		label: "Move Up",
																		action: () => Sy(t.id, -1).then(() => so()),
																	}),
																Sl(t.id, 1) &&
																	n(E.MenuItem, {
																		id: "vc-pindms-move-category-down",
																		label: "Move Down",
																		action: () => Sy(t.id, 1).then(() => so()),
																	})
															),
														n(E.MenuSeparator, null),
														n(E.MenuItem, {
															id: "vc-pindms-delete-category",
															color: "danger",
															label: "Delete Category",
															action: () => YP(t.id).then(() => so()),
														})
													)
												);
											},
										},
										n("span", { className: iM.headerText }, t?.name ?? "uh oh"),
										n(
											"svg",
											{
												className: "vc-pindms-collapse-icon",
												"aria-hidden": "true",
												role: "img",
												xmlns: "http://www.w3.org/2000/svg",
												width: "24",
												height: "24",
												fill: "none",
												viewBox: "0 0 24 24",
											},
											n("path", {
												fill: "currentColor",
												d: "M9.3 5.3a1 1 0 0 0 0 1.4l5.29 5.3-5.3 5.3a1 1 0 1 0 1.42 1.4l6-6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-1.42 0Z",
											})
										)
									)
								: null;
						},
						{ noop: !0 }
					),
					renderChannel(e, t, o) {
						return R.wrap(
							() => {
								let { channel: r, category: i } = this.getChannel(
									e,
									t,
									this.instance.props.channels
								);
								return !r || !i || this.isChannelHidden(e, t)
									? null
									: n(
											o,
											{
												channel: r,
												selected:
													this.instance.props.selectedChannelId === r.id,
											},
											r.id
										);
							},
							{ noop: !0 }
						);
					},
					getChannel(e, t, o) {
						let r = ye[e - 1];
						if (!r) return { channel: null, category: null };
						let i = this.getCategoryChannels(r)[t];
						return { channel: o[i], category: r };
					},
					getCategoryChannels(e) {
						return e.channels.length === 0
							? []
							: Yo.store.pinOrder === 0
								? Ty.getPrivateChannelIds().filter((t) =>
										e.channels.includes(t)
									)
								: (e?.channels ?? []);
					},
				}));
		});
	var Xd,
		aM = g(() => {
			"use strict";
			a();
			P();
			T();
			Xd = h({
				name: "PlainFolderIcon",
				description: "Doesn't show the small guild icons in folders",
				authors: [d.botato],
				patches: [
					{
						find: ".expandedFolderIconWrapper",
						replacement: [
							{
								match: /\(\w\|\|\w\)&&(\(.{0,40}\(.{1,3}\.animated)/,
								replace: "$1",
							},
						],
					},
				],
			});
		});
	var lM = g(() => {});
	var Iy = {};
	et(Iy, {
		__getDecorators: () => ED,
		addDecorator: () => Py,
		decorators: () => Jd,
		removeDecorator: () => My,
	});
	function Py(e, t, o) {
		Jd.set(e, { decorator: t, onlyIn: o });
	}
	function My(e) {
		Jd.delete(e);
	}
	function ED(e) {
		let t = !!e.guildId;
		return Array.from(Jd.values(), (o) => {
			let { decorator: r, onlyIn: i } = o;
			return !i || (i === "guilds" && t) || (i === "dms" && !t) ? r(e) : null;
		});
	}
	var Jd,
		Cy = g(() => {
			"use strict";
			a();
			Jd = new Map();
		});
	var Ry = {};
	et(Ry, {
		__addDecorationsToMessage: () => OD,
		addDecoration: () => Ay,
		decorations: () => Vd,
		removeDecoration: () => Ny,
	});
	function Ay(e, t) {
		Vd.set(e, t);
	}
	function Ny(e) {
		Vd.delete(e);
	}
	function OD(e) {
		return [...Vd.values()].map((t) => t(e));
	}
	var Vd,
		ky = g(() => {
			"use strict";
			a();
			Vd = new Map();
		});
	function em(e, t) {
		return ({ color: o, tooltip: r, small: i }) =>
			n(te, { text: r }, (s) =>
				n(
					"svg",
					{
						...s,
						height: (t?.height ?? 20) - (i ? 3 : 0),
						width: (t?.width ?? 20) - (i ? 3 : 0),
						viewBox: t?.viewBox ?? "0 0 24 24",
						fill: o,
					},
					n("path", { d: e })
				)
			);
	}
	function mM(e) {
		if (e.id === D.getCurrentUser().id) {
			let t = FD.getSessions();
			if (typeof t != "object") return null;
			let o = Object.values(t).sort(({ status: s }, { status: l }) =>
					s === l
						? 0
						: s === "online"
							? 1
							: l === "online"
								? -1
								: s === "idle"
									? 1
									: l === "idle"
										? -1
										: 0
				),
				r = Object.values(o).reduce(
					(s, l) => (
						l.clientInfo.client !== "unknown" &&
							(s[l.clientInfo.client] = l.status),
						s
					),
					{}
				),
				{ clientStatuses: i } = kn.getState();
			i[D.getCurrentUser().id] = r;
		}
	}
	function BD({ userId: e }) {
		let t = D.getUser(e);
		if (!t || t.bot) return [];
		mM(t);
		let o = kn.getState()?.clientStatuses?.[t.id];
		return o
			? Object.entries(o).map(([r, i]) => ({
					component: () =>
						n(
							"span",
							{ className: "vc-platform-indicator" },
							n(dM, { key: r, platform: r, status: i, small: !1 })
						),
					key: `vc-platform-indicator-${r}`,
				}))
			: [];
	}
	var FD,
		cM,
		_D,
		dM,
		uM,
		pM,
		Dy,
		xl,
		tm,
		fM = g(() => {
			"use strict";
			a();
			lM();
			eu();
			Cy();
			ky();
			F();
			re();
			P();
			T();
			U();
			b();
			FD = K("SessionsStore");
			(cM = {
				desktop: em(
					"M4 2.5c-1.103 0-2 .897-2 2v11c0 1.104.897 2 2 2h7v2H7v2h10v-2h-4v-2h7c1.103 0 2-.896 2-2v-11c0-1.103-.897-2-2-2H4Zm16 2v9H4v-9h16Z"
				),
				web: em(
					"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z"
				),
				mobile: em(
					"M 187 0 L 813 0 C 916.277 0 1000 83.723 1000 187 L 1000 1313 C 1000 1416.277 916.277 1500 813 1500 L 187 1500 C 83.723 1500 0 1416.277 0 1313 L 0 187 C 0 83.723 83.723 0 187 0 Z M 125 1000 L 875 1000 L 875 250 L 125 250 Z M 500 1125 C 430.964 1125 375 1180.964 375 1250 C 375 1319.036 430.964 1375 500 1375 C 569.036 1375 625 1319.036 625 1250 C 625 1180.964 569.036 1125 500 1125 Z",
					{ viewBox: "0 0 1000 1500", height: 17, width: 17 }
				),
				embedded: em(
					"M14.8 2.7 9 3.1V47h3.3c1.7 0 6.2.3 10 .7l6.7.6V2l-4.2.2c-2.4.1-6.9.3-10 .5zm1.8 6.4c1 1.7-1.3 3.6-2.7 2.2C12.7 10.1 13.5 8 15 8c.5 0 1.2.5 1.6 1.1zM16 33c0 6-.4 10-1 10s-1-4-1-10 .4-10 1-10 1 4 1 10zm15-8v23.3l3.8-.7c2-.3 4.7-.6 6-.6H43V3h-2.2c-1.3 0-4-.3-6-.6L31 1.7V25z",
					{ viewBox: "0 0 50 50" }
				),
			}),
				(_D = C("useStatusFillColor", "StatusTypes")),
				(dM = ({ platform: e, status: t, small: o }) => {
					let r =
							e === "embedded" ? "Console" : e[0].toUpperCase() + e.slice(1),
						i = cM[e] ?? cM.desktop;
					return n(i, {
						color: _D.useStatusFillColor(t),
						tooltip: r,
						small: o,
					});
				});
			(uM = ({
				user: e,
				wantMargin: t = !0,
				wantTopMargin: o = !1,
				small: r = !1,
			}) => {
				if (!e || e.bot) return null;
				mM(e);
				let i = kn.getState()?.clientStatuses?.[e.id];
				if (!i) return null;
				let s = Object.entries(i).map(([l, c]) =>
					n(dM, { key: l, platform: l, status: c, small: r })
				);
				return s.length
					? n(
							"span",
							{
								className: "vc-platform-indicator",
								style: { marginLeft: t ? 4 : 0, top: o ? 2 : 0, gap: 2 },
							},
							s
						)
					: null;
			}),
				(pM = { getBadges: BD, position: 0 }),
				(Dy = {
					list: {
						description: "In the member list",
						onEnable: () =>
							Py("platform-indicator", (e) =>
								n(R, { noop: !0 }, n(uM, { user: e.user, small: !0 }))
							),
						onDisable: () => My("platform-indicator"),
					},
					badges: {
						description: "In user profiles, as badges",
						onEnable: () => Ly(pM),
						onDisable: () => Ey(pM),
					},
					messages: {
						description: "Inside messages",
						onEnable: () =>
							Ay("platform-indicator", (e) =>
								n(
									R,
									{ noop: !0 },
									n(uM, { user: e.message?.author, wantTopMargin: !0 })
								)
							),
						onDisable: () => Ny("platform-indicator"),
					},
				}),
				(xl = x({
					...Object.fromEntries(
						Object.entries(Dy).map(([e, t]) => [
							e,
							{
								type: 3,
								description: `Show indicators ${t.description.toLowerCase()}`,
								restartNeeded: !0,
								default: !0,
							},
						])
					),
					colorMobileIndicator: {
						type: 3,
						description:
							"Whether to make the mobile indicator match the color of the user status.",
						default: !0,
						restartNeeded: !0,
					},
				})),
				(tm = h({
					name: "PlatformIndicators",
					description:
						"Adds platform indicators (Desktop, Mobile, Web...) to users",
					authors: [d.kemo, d.TheSun, d.Nuckyz, d.Ven],
					dependencies: ["MessageDecorationsAPI", "MemberListDecoratorsAPI"],
					settings: xl,
					start() {
						Object.entries(Dy).forEach(([e, t]) => {
							xl.store[e] && t.onEnable();
						});
					},
					stop() {
						Object.entries(Dy).forEach(([e, t]) => {
							t.onDisable();
						});
					},
					patches: [
						{
							find: ".Masks.STATUS_ONLINE_MOBILE",
							predicate: () => xl.store.colorMobileIndicator,
							replacement: [
								{
									match:
										/\.STATUS_TYPING;switch(?=.+?(if\(\i\)return \i\.\i\.Masks\.STATUS_ONLINE_MOBILE))/,
									replace: ".STATUS_TYPING;$1;switch",
								},
								{
									match:
										/switch\(\i\)\{case \i\.\i\.ONLINE:(if\(\i\)return\{[^}]+\})/,
									replace: "$1;$&",
								},
							],
						},
						{
							find: ".AVATAR_STATUS_MOBILE_16;",
							predicate: () => xl.store.colorMobileIndicator,
							replacement: [
								{
									match:
										/\i===\i\.\i\.ONLINE&&(?=.{0,70}\.AVATAR_STATUS_MOBILE_16;)/,
									replace: "",
								},
								{
									match: /(?<=\(\i\.status,)(\i)(?=,(\i),\i\))/,
									replace: (e, t, o) => `${o}?"online":${t}`,
								},
								{ match: /(?<=\i&&!\i)&&\i===\i\.\i\.ONLINE/, replace: "" },
							],
						},
						{
							find: "}isMobileOnline(",
							predicate: () => xl.store.colorMobileIndicator,
							replacement: {
								match: /(?<=\i\[\i\.\i\.MOBILE\])===\i\.\i\.ONLINE/,
								replace: "!= null",
							},
						},
					],
				}));
		});
	var gM = g(() => {});
	var Fy = {};
	et(Fy, {
		ChatBarButton: () => ln,
		_injectButtons: () => $D,
		addChatBarButton: () => sn,
		removeChatBarButton: () => an,
	});
	function $D(e, t) {
		if (!t.disabled)
			for (let [o, r] of Oy)
				e.push(
					n(
						R,
						{
							noop: !0,
							key: o,
							onError: (i) => UD.error(`Failed to render ${o}`, i.error),
						},
						n(r, { ...t, isMainChat: t.type.analyticsName === "normal" })
					)
				);
	}
	var hM,
		Oy,
		UD,
		sn,
		an,
		ln,
		_r = g(() => {
			"use strict";
			a();
			gM();
			re();
			De();
			U();
			b();
			(hM = C("buttonContainer", "channelTextArea")),
				(Oy = new Map()),
				(UD = new V("ChatButtons"));
			(sn = (e, t) => Oy.set(e, t)),
				(an = (e) => Oy.delete(e)),
				(ln = R.wrap(
					(e) =>
						n(te, { text: e.tooltip }, ({ onMouseEnter: t, onMouseLeave: o }) =>
							n(
								"div",
								{
									className: `expression-picker-chat-input-button ${hM?.buttonContainer ?? ""} vc-chatbar-button`,
								},
								n(
									M,
									{
										"aria-label": e.tooltip,
										size: "",
										look: rc.BLANK,
										onMouseEnter: t,
										onMouseLeave: o,
										innerClassName: `${tc.button} ${hM?.button}`,
										onClick: e.onClick,
										onContextMenu: e.onContextMenu,
										...e.buttonProps,
									},
									n("div", { className: tc.buttonWrapper }, e.children)
								)
							)
						),
					{ noop: !0 }
				));
		});
	var vM,
		yM,
		GD,
		HD,
		zD,
		om,
		SM = g(() => {
			"use strict";
			a();
			_r();
			jo();
			P();
			T();
			U();
			b();
			(vM = K("UploadAttachmentStore")),
				(yM = (e) => cc.getDraft(e, Wt.ChannelMessage)),
				(GD = (e) =>
					new Promise((t) => {
						let o = new Image();
						(o.onload = () => t({ width: o.width, height: o.height })),
							(o.onerror = () => t(null)),
							(o.src = e);
					})),
				(HD = async (e) =>
					await Promise.all(
						vM.getUploads(e, Wt.ChannelMessage).map(async (t) => {
							let {
									isImage: o,
									filename: r,
									spoiler: i,
									item: { file: s },
								} = t,
								l = URL.createObjectURL(s),
								c = {
									id: Ua(),
									filename: i ? "SPOILER_" + r : r,
									content_type: void 0,
									size: await t.getSize(),
									spoiler: i,
									url: l + "#",
									proxy_url: l + "#",
								};
							if (o) {
								let u = await GD(l);
								if (!u) return c;
								(c.width = u.width), (c.height = u.height);
							}
							return c;
						})
					)),
				(zD = ({ isMainChat: e, isEmpty: t, type: { attachments: o } }) => {
					let r = xe.getChannelId(),
						i = Oe([cc], () => yM(r));
					if (!e) return null;
					let s = o && vM.getUploads(r, Wt.ChannelMessage).length > 0;
					return !(!t && i?.length > 0) && !s
						? null
						: n(
								ln,
								{
									tooltip: "Preview Message",
									onClick: async () =>
										Je(r, {
											content: yM(r),
											author: D.getCurrentUser(),
											attachments: s ? await HD(r) : void 0,
										}),
									buttonProps: { style: { translate: "0 2px" } },
								},
								n(
									"svg",
									{
										fill: "currentColor",
										fillRule: "evenodd",
										width: "24",
										height: "24",
										viewBox: "0 0 24 24",
										style: { scale: "1.096", translate: "0 -1px" },
									},
									n("path", {
										d: "M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08ZM15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z",
									})
								)
							);
				}),
				(om = h({
					name: "PreviewMessage",
					description: "Lets you preview your message before sending it.",
					authors: [d.Aria],
					dependencies: ["ChatInputButtonAPI"],
					startAt: "Init",
					start: () => sn("previewMessage", zD),
					stop: () => an("previewMessage"),
				}));
		});
	var bM = g(() => {});
	function _y() {
		return n(
			q.Fragment,
			null,
			n(S.FormTitle, { tag: "h3" }, "More Information"),
			n(
				S.FormText,
				null,
				"To add your own pronouns, visit",
				" ",
				n(He, { href: "https://pronoundb.org" }, "pronoundb.org")
			),
			n(S.FormDivider, null),
			n(
				S.FormText,
				null,
				"The two pronoun formats are lowercase and capitalized. Example:",
				n(
					"ul",
					null,
					n("li", null, "Lowercase: they/them"),
					n("li", null, "Capitalized: They/Them")
				),
				'Text like "Ask me my pronouns" or "Any pronouns" will always be capitalized. ',
				n("br", null),
				n("br", null),
				"You can also configure whether or not to display pronouns for the current user (since you probably already know them)"
			)
		);
	}
	var TM = g(() => {
		"use strict";
		a();
		no();
		b();
	});
	var wn,
		nm = g(() => {
			"use strict";
			a();
			F();
			T();
			rm();
			wn = x({
				pronounsFormat: {
					type: 4,
					description: "The format for pronouns to appear in chat",
					options: [
						{ label: "Lowercase", value: "LOWERCASE", default: !0 },
						{ label: "Capitalized", value: "CAPITALIZED" },
					],
				},
				pronounSource: {
					type: 4,
					description: "Where to source pronouns from",
					options: [
						{
							label: "Prefer PronounDB, fall back to Discord",
							value: 0,
							default: !0,
						},
						{
							label:
								"Prefer Discord, fall back to PronounDB (might lead to inconsistency between pronouns in chat and profile)",
							value: 1,
						},
					],
				},
				showSelf: {
					type: 3,
					description:
						"Enable or disable showing pronouns for the current user",
					default: !0,
				},
				showInMessages: {
					type: 3,
					description: "Show in messages",
					default: !0,
				},
				showInProfile: { type: 3, description: "Show in profile", default: !0 },
			});
		});
	var Ns,
		xM = g(() => {
			"use strict";
			a();
			Ns = {
				he: "He/Him",
				it: "It/Its",
				she: "She/Her",
				they: "They/Them",
				any: "Any pronouns",
				other: "Other pronouns",
				ask: "Ask me my pronouns",
				avoid: "Avoid pronouns, use my name",
				unspecified: "No pronouns specified.",
			};
		});
	function qD(e, t = !1) {
		let o = eo.getUserProfile(e)?.pronouns;
		return t ? o : eo.getGuildMemberProfile(e, fn()?.guild_id)?.pronouns || o;
	}
	function sm(e, t = !1) {
		let o = qD(e, t)?.trim().replace(KD, " "),
			[r] = pt(() => YD(e), {
				fallbackValue: MM(e),
				onError: (s) => console.error("Fetching pronouns failed: ", s),
			}),
			i = WD.getPendingPronouns() != null;
		return wn.store.pronounSource === 1 && o
			? [o, "Discord", i]
			: r && r !== Ns.unspecified
				? [r, "PronounDB", i]
				: [o, "Discord", i];
	}
	function PM(e, t = !1) {
		let o = sm(e, t);
		return !wn.store.showInProfile ||
			(!wn.store.showSelf && e === D.getCurrentUser().id)
			? wM
			: o;
	}
	function MM(e) {
		let t = im[e] ? IM(im[e].sets) : void 0;
		return t && t !== Ns.unspecified ? t : t || null;
	}
	function YD(e) {
		return new Promise((t) => {
			let o = MM(e);
			if (o) return t(o);
			if (e in Rs) return Rs[e].push(t);
			(Rs[e] = [t]), jD();
		});
	}
	async function ZD(e) {
		let t = new URLSearchParams();
		t.append("platform", "discord"), t.append("ids", e.join(","));
		try {
			return await (
				await fetch("https://pronoundb.org/api/v2/lookup?" + t.toString(), {
					method: "GET",
					headers: { Accept: "application/json", "X-PronounDB-Source": SS },
				})
			)
				.json()
				.then((r) => (Object.assign(im, r), r));
		} catch (o) {
			console.error("PronounDB fetching failed: ", o);
			let r = Object.fromEntries(e.map((i) => [i, { sets: {} }]));
			return Object.assign(im, r), r;
		}
	}
	function IM(e) {
		if (!e || !e.en) return Ns.unspecified;
		let t = e.en,
			{ pronounsFormat: o } = wn.store;
		if (t.length === 1)
			return o === "CAPITALIZED" ||
				["any", "ask", "avoid", "other", "unspecified"].includes(t[0])
				? Ns[t[0]]
				: Ns[t[0]].toLowerCase();
		let r = t.map((i) => i[0].toUpperCase() + i.slice(1)).join("/");
		return o === "CAPITALIZED" ? r : r.toLowerCase();
	}
	var WD,
		wM,
		im,
		Rs,
		jD,
		KD,
		rm = g(() => {
			"use strict";
			a();
			fr();
			Uc();
			it();
			ct();
			U();
			b();
			nm();
			xM();
			(WD = K("UserSettingsAccountStore")),
				(wM = [null, "", !1]),
				(im = {}),
				(Rs = {}),
				(jD = $t(async () => {
					let e = Object.keys(Rs),
						t = await ZD(e);
					for (let o of e)
						Rs[o]?.forEach((r) => r(t[o] ? IM(t[o].sets) : "")), delete Rs[o];
				}));
			KD = /\n+/g;
		});
	function CM(e) {
		return !(
			!wn.store.showInMessages ||
			e.author.bot ||
			e.author.system ||
			e.type === QD ||
			(!wn.store.showSelf && e.author.id === D.getCurrentUser().id)
		);
	}
	function XD({ message: e }) {
		let [t] = sm(e.author.id);
		return t
			? n(
					"span",
					{ className: H(am.timestampInline, am.timestamp) },
					"\u2022 ",
					t
				)
			: null;
	}
	var am,
		QD,
		AM,
		NM,
		JD,
		RM = g(() => {
			"use strict";
			a();
			re();
			me();
			U();
			b();
			rm();
			nm();
			(am = C("timestampInline")), (QD = 24);
			(AM = R.wrap(({ message: e }) => (CM(e) ? n(XD, { message: e }) : null), {
				noop: !0,
			})),
				(NM = R.wrap(
					({ message: e }) => (CM(e) ? n(JD, { message: e }) : null),
					{ noop: !0 }
				));
			JD = R.wrap(
				({ message: e }) => {
					let [t] = sm(e.author.id);
					return t
						? n(
								"span",
								{
									className: H(
										am.timestampInline,
										am.timestamp,
										"vc-pronoundb-compact"
									),
								},
								"\u2022 ",
								t
							)
						: null;
				},
				{ noop: !0 }
			);
		});
	var lm,
		kM = g(() => {
			"use strict";
			a();
			bM();
			P();
			T();
			TM();
			RM();
			rm();
			nm();
			lm = h({
				name: "PronounDB",
				authors: [d.Tyman, d.TheKodeToad, d.Ven, d.Elvyra],
				description: "Adds pronouns to user messages using pronoundb",
				patches: [
					{
						find: "showCommunicationDisabledStyles",
						replacement: [
							{
								match: /("span",{id:\i,className:\i,children:\i}\))/,
								replace:
									"$1, $self.CompactPronounsChatComponentWrapper(arguments[0])",
							},
							{
								match:
									/(?<=return\s*\(0,\i\.jsxs?\)\(.+!\i&&)(\(0,\i.jsxs?\)\(.+?\{.+?\}\))/,
								replace:
									"[$1, $self.PronounsChatComponentWrapper(arguments[0])]",
							},
						],
					},
					{
						find: ".Messages.USER_PROFILE_PRONOUNS",
						group: !0,
						replacement: [
							{
								match: /\.PANEL},/,
								replace:
									"$&[vcPronoun,vcPronounSource,vcHasPendingPronouns]=$self.useProfilePronouns(arguments[0].user?.id),",
							},
							{
								match: /text:\i\.\i.Messages.USER_PROFILE_PRONOUNS/,
								replace: '$&+vcHasPendingPronouns?"":` (${vcPronounSource})`',
							},
							{
								match: /(\.pronounsText.+?children:)(\i)/,
								replace: "$1vcHasPendingPronouns?$2:vcPronoun",
							},
						],
					},
				],
				settings: wn,
				settingsAboutComponent: _y,
				PronounsChatComponentWrapper: AM,
				CompactPronounsChatComponentWrapper: NM,
				useProfilePronouns: PM,
			});
		});
	var cm,
		DM = g(() => {
			"use strict";
			a();
			bs();
			P();
			it();
			T();
			b();
			cm = h({
				name: "QuickMention",
				authors: [d.kemo],
				description: "Adds a quick mention button to the message actions bar",
				dependencies: ["MessagePopoverAPI"],
				start() {
					Qn("QuickMention", (e) => {
						let t = oe.getChannel(e.channel_id);
						return t.guild_id && !qe.can(we.SEND_MESSAGES, t)
							? null
							: {
									label: "Quick Mention",
									icon: this.Icon,
									message: e,
									channel: t,
									onClick: () => ci(`<@${e.author.id}> `),
								};
					});
				},
				stop() {
					Xn("QuickMention");
				},
				Icon: () =>
					n(
						"svg",
						{
							className: "icon",
							height: "24",
							width: "24",
							viewBox: "0 0 24 24",
							fill: "currentColor",
						},
						n("path", {
							d: "M12 2C6.486 2 2 6.486 2 12C2 17.515 6.486 22 12 22C14.039 22 15.993 21.398 17.652 20.259L16.521 18.611C15.195 19.519 13.633 20 12 20C7.589 20 4 16.411 4 12C4 7.589 7.589 4 12 4C16.411 4 20 7.589 20 12V12.782C20 14.17 19.402 15 18.4 15L18.398 15.018C18.338 15.005 18.273 15 18.209 15H18C17.437 15 16.6 14.182 16.6 13.631V12C16.6 9.464 14.537 7.4 12 7.4C9.463 7.4 7.4 9.463 7.4 12C7.4 14.537 9.463 16.6 12 16.6C13.234 16.6 14.35 16.106 15.177 15.313C15.826 16.269 16.93 17 18 17L18.002 16.981C18.064 16.994 18.129 17 18.195 17H18.4C20.552 17 22 15.306 22 12.782V12C22 6.486 17.514 2 12 2ZM12 14.599C10.566 14.599 9.4 13.433 9.4 11.999C9.4 10.565 10.566 9.399 12 9.399C13.434 9.399 14.6 10.565 14.6 11.999C14.6 13.433 13.434 14.599 12 14.599Z",
						})
					),
			});
		});
	function $M(e, t) {
		let o = e.findIndex((r) => r.id === t);
		return o === -1 ? o : e.length - o - 1;
	}
	function OM({ channelId: e, messageId: t, _isQuickEdit: o }) {
		if (o) return;
		let r = D.getCurrentUser().id,
			i = jt.getMessages(e)._array.filter((s) => s.author.id === r);
		pm = $M(i, t);
	}
	function FM({ message: e, _isQuickReply: t }) {
		t || (um = $M(jt.getMessages(e.channel_id)._array, e.id));
	}
	function _M(e) {
		let t = e.key === "ArrowUp";
		(!t && e.key !== "ArrowDown") ||
			!eL(e) ||
			tL(e) ||
			(e.shiftKey ? rL(t) : nL(t));
	}
	function GM(e, t) {
		let o = document.getElementById("message-content-" + t);
		if (!o) return;
		let r = Math.max(document.documentElement.clientHeight, window.innerHeight),
			i = o.getBoundingClientRect();
		(i.bottom < 200 || i.top - r >= -200) &&
			VD.jumpToMessage({
				channelId: e,
				messageId: t,
				flash: !1,
				jumpType: "INSTANT",
			});
	}
	function HM(e, t) {
		let o = jt.getMessages(xe.getChannelId())._array;
		if (!t) {
			let l = D.getCurrentUser().id;
			o = o.filter((c) => c.author.id === l);
		}
		Vencord.Plugins.isPluginEnabled("NoBlockedMessages") &&
			(o = o.filter((l) => !Ie.isBlocked(l.author.id)));
		let r = (l) => (e ? Math.min(o.length - 1, l + 1) : Math.max(-1, l - 1)),
			i = (l) => {
				do l = r(l);
				while (l !== -1 && o[o.length - l - 1]?.deleted === !0);
				return l;
			},
			s;
		return (
			t ? (um = s = i(um)) : (pm = s = i(pm)),
			s === -1 ? void 0 : o[o.length - s - 1]
		);
	}
	function oL(e) {
		let {
				enabled: t,
				userList: o,
				shouldPingListed: r,
			} = he.plugins.NoReplyMention,
			i = !t || r === o.includes(e.author.id);
		switch (UM.store.shouldMention) {
			case 2:
				return i;
			case 0:
				return !1;
			default:
				return !0;
		}
	}
	function nL(e) {
		let t = oe.getChannel(xe.getChannelId());
		if (t.guild_id && !qe.can(we.SEND_MESSAGES, t)) return;
		let o = HM(e, !0);
		if (!o)
			return void _.dispatch({
				type: "DELETE_PENDING_REPLY",
				channelId: xe.getChannelId(),
			});
		let r = oe.getChannel(o.channel_id),
			i = D.getCurrentUser().id;
		_.dispatch({
			type: "CREATE_PENDING_REPLY",
			channel: r,
			message: o,
			shouldMention: oL(o),
			showMentionToggle: r.guild_id !== null && o.author.id !== i,
			_isQuickReply: !0,
		}),
			GM(r.id, o.id);
	}
	function rL(e) {
		let t = oe.getChannel(xe.getChannelId());
		if (t.guild_id && !qe.can(we.SEND_MESSAGES, t)) return;
		let o = HM(e, !1);
		if (!o)
			return _.dispatch({
				type: "MESSAGE_END_EDIT",
				channelId: xe.getChannelId(),
			});
		_.dispatch({
			type: "MESSAGE_START_EDIT",
			channelId: o.channel_id,
			messageId: o.id,
			content: o.content,
			_isQuickEdit: !0,
		}),
			GM(o.channel_id, o.id);
	}
	var VD,
		BM,
		um,
		pm,
		UM,
		dm,
		LM,
		EM,
		eL,
		tL,
		zM = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			U();
			b();
			(VD = C("jumpToMessage")),
				(BM = navigator.platform.includes("Mac")),
				(um = -1),
				(pm = -1),
				(UM = x({
					shouldMention: {
						type: 4,
						description: "Ping reply by default",
						options: [
							{ label: "Follow NoReplyMention", value: 2, default: !0 },
							{ label: "Enabled", value: 1 },
							{ label: "Disabled", value: 0 },
						],
					},
				})),
				(dm = h({
					name: "QuickReply",
					authors: [d.fawn, d.Ven, d.pylix],
					description:
						"Reply to (ctrl + up/down) and edit (ctrl + shift + up/down) messages via keybinds",
					settings: UM,
					start() {
						_.subscribe("DELETE_PENDING_REPLY", LM),
							_.subscribe("MESSAGE_END_EDIT", EM),
							_.subscribe("MESSAGE_START_EDIT", OM),
							_.subscribe("CREATE_PENDING_REPLY", FM),
							document.addEventListener("keydown", _M);
					},
					stop() {
						_.unsubscribe("DELETE_PENDING_REPLY", LM),
							_.unsubscribe("MESSAGE_END_EDIT", EM),
							_.unsubscribe("MESSAGE_START_EDIT", OM),
							_.unsubscribe("CREATE_PENDING_REPLY", FM),
							document.removeEventListener("keydown", _M);
					},
				})),
				(LM = () => (um = -1)),
				(EM = () => (pm = -1));
			(eL = (e) => (BM ? e.metaKey : e.ctrlKey)),
				(tL = (e) => e.altKey || (!BM && e.metaKey));
		});
	var By,
		mm,
		WM = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			mm = h({
				name: "ReactErrorDecoder",
				description: 'Replaces "Minifed React Error" with the actual error.',
				authors: [d.Cyn, d.maisymoe],
				patches: [
					{
						find: '"https://reactjs.org/docs/error-decoder.html?invariant="',
						replacement: {
							match:
								/(function .\(.\)){(for\(var .="https:\/\/reactjs\.org\/docs\/error-decoder\.html\?invariant="\+.,.=1;.<arguments\.length;.\+\+\).\+="&args\[\]="\+encodeURIComponent\(arguments\[.\]\);return"Minified React error #"\+.\+"; visit "\+.\+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings.")}/,
							replace: (e, t, o) =>
								`${t}{var decoded=$self.decodeError.apply(null, arguments);if(decoded)return decoded;${o}}`,
						},
					},
				],
				async start() {
					let e = `https://raw.githubusercontent.com/facebook/react/v${q.version}/scripts/error-codes/codes.json`;
					By = await fetch(e)
						.then((t) => t.json())
						.catch((t) =>
							console.error(
								`[ReactErrorDecoder] Failed to fetch React error codes
`,
								t
							)
						);
				},
				stop() {
					By = void 0;
				},
				decodeError(e, ...t) {
					let o = 0;
					return By?.[e]?.replace(/%s/g, () => {
						let r = t[o];
						return o++, r;
					});
				},
			});
		});
	var jM = g(() => {});
	var $y = {};
	et($y, {
		ServerListRenderPosition: () => fm,
		addServerListElement: () => wl,
		removeServerListElement: () => Pl,
		renderAll: () => lL,
	});
	function Uy(e) {
		return e === 0 ? sL : aL;
	}
	function wl(e, t) {
		Uy(e).add(t);
	}
	function Pl(e, t) {
		Uy(e).delete(t);
	}
	var iL,
		fm,
		sL,
		aL,
		lL,
		gm = g(() => {
			"use strict";
			a();
			De();
			(iL = new V("ServerListAPI")),
				(fm = ((o) => (
					(o[(o.Above = 0)] = "Above"), (o[(o.In = 1)] = "In"), o
				))(fm || {})),
				(sL = new Set()),
				(aL = new Set());
			lL = (e) => {
				let t = [];
				for (let o of Uy(e))
					try {
						t.unshift(o());
					} catch (r) {
						iL.error("Failed to render server list element:", r);
					}
				return t;
			};
		});
	function uL() {
		let e = [];
		Object.values(le.getGuilds()).forEach((t) => {
			yr.getChannels(t.id)
				.SELECTABLE.concat(yr.getChannels(t.id).VOCAL)
				.concat(
					Object.values(cL.getActiveJoinedThreadsForGuild(t.id)).flatMap((o) =>
						Object.values(o)
					)
				)
				.forEach((o) => {
					!ji.hasUnread(o.channel.id) ||
						e.push({
							channelId: o.channel.id,
							messageId: ji.lastMessageId(o.channel.id),
							readStateType: 0,
						});
				});
		}),
			_.dispatch({ type: "BULK_ACK", context: "APP", channels: e });
	}
	var cL,
		pL,
		hm,
		qM = g(() => {
			"use strict";
			a();
			jM();
			gm();
			re();
			P();
			T();
			U();
			b();
			cL = K("ActiveJoinedThreadsStore");
			(pL = () =>
				n(
					M,
					{
						onClick: uL,
						size: M.Sizes.MIN,
						color: M.Colors.CUSTOM,
						className: "vc-ranb-button",
					},
					"Read All"
				)),
				(hm = h({
					name: "ReadAllNotificationsButton",
					description:
						"Read all server notifications with a single button click!",
					authors: [d.kemo],
					dependencies: ["ServerListAPI"],
					renderReadAllButton: R.wrap(pL, { noop: !0 }),
					start() {
						wl(0, this.renderReadAllButton);
					},
					stop() {
						Pl(0, this.renderReadAllButton);
					},
				}));
		});
	var No,
		ym = g(() => {
			"use strict";
			a();
			F();
			T();
			No = x({
				notices: {
					type: 3,
					description:
						"Also show a notice at the top of your screen when removed (use this if you don't want to miss any notifications).",
					default: !1,
				},
				offlineRemovals: {
					type: 3,
					description:
						"Notify you when starting discord if you were removed while offline.",
					default: !0,
				},
				friends: {
					type: 3,
					description: "Notify when a friend removes you",
					default: !0,
				},
				friendRequestCancels: {
					type: 3,
					description: "Notify when a friend request is cancelled",
					default: !0,
				},
				servers: {
					type: 3,
					description: "Notify when removed from a server",
					default: !0,
				},
				groups: {
					type: 3,
					description: "Notify when removed from a group chat",
					default: !0,
				},
			});
		});
	var Gy = g(() => {
		"use strict";
		a();
	});
	async function fL() {
		gt.delMany([
			"relationship-notifier-guilds",
			"relationship-notifier-groups",
			"relationship-notifier-friends",
		]);
	}
	async function zy() {
		await fL();
		let [e, t, o] = await gt.getMany([KM(), YM(), ZM()]);
		if ((await Promise.all([vm(), Sm(), Ml()]), No.store.offlineRemovals)) {
			if (No.store.groups && t?.size)
				for (let [r, i] of t)
					Ds.has(r) ||
						or(`You are no longer in the group ${i.name}.`, i.iconURL);
			if (No.store.servers && e?.size)
				for (let [r, i] of e)
					!ks.has(r) &&
						!Hy.isUnavailable(r) &&
						or(`You are no longer in the server ${i.name}.`, i.iconURL);
			if (No.store.friends && o?.friends.length)
				for (let r of o.friends) {
					if (Ni.friends.includes(r)) continue;
					let i = await oo.getUser(r).catch(() => {});
					i &&
						or(
							`You are no longer friends with ${Ln(i)}.`,
							i.getAvatarURL(void 0, void 0, !1),
							() => Eo(i.id)
						);
				}
			if (No.store.friendRequestCancels && o?.requests?.length)
				for (let r of o.requests) {
					if (
						Ni.requests.includes(r) ||
						[1, 2, 4].includes(Ie.getRelationshipType(r))
					)
						continue;
					let i = await oo.getUser(r).catch(() => {});
					i &&
						or(
							`Friend request from ${Ln(i)} has been revoked.`,
							i.getAvatarURL(void 0, void 0, !1),
							() => Eo(i.id)
						);
				}
		}
	}
	function or(e, t, o) {
		No.store.notices && Kn.showNotice(e, "OK", () => Kn.popNotice()),
			ze({ title: "Relationship Notifier", body: e, icon: t, onClick: o });
	}
	function QM(e) {
		return ks.get(e);
	}
	function Wy(e) {
		ks.delete(e), vm();
	}
	async function vm() {
		ks.clear();
		let e = D.getCurrentUser().id;
		for (let [t, { name: o, icon: r }] of Object.entries(le.getGuilds()))
			Le.isMember(t, e) &&
				ks.set(t, {
					id: t,
					name: o,
					iconURL: r && `https://cdn.discordapp.com/icons/${t}/${r}.png`,
				});
		await gt.set(KM(), ks);
	}
	function XM(e) {
		return Ds.get(e);
	}
	function jy(e) {
		Ds.delete(e), Sm();
	}
	async function Sm() {
		Ds.clear();
		for (let {
			type: e,
			id: t,
			name: o,
			rawRecipients: r,
			icon: i,
		} of oe.getSortedPrivateChannels())
			e === 3 &&
				Ds.set(t, {
					id: t,
					name: o || r.map((s) => s.username).join(", "),
					iconURL:
						i && `https://cdn.discordapp.com/channel-icons/${t}/${i}.png`,
				});
		await gt.set(YM(), Ds);
	}
	async function Ml() {
		(Ni.friends = []), (Ni.requests = []);
		let e = Ie.getRelationships();
		for (let t in e)
			switch (e[t]) {
				case 1:
					Ni.friends.push(t);
					break;
				case 3:
					Ni.requests.push(t);
					break;
			}
		await gt.set(ZM(), Ni);
	}
	var Hy,
		ks,
		Ds,
		Ni,
		KM,
		YM,
		ZM,
		qy = g(() => {
			"use strict";
			a();
			qn();
			Bn();
			it();
			U();
			b();
			ym();
			Gy();
			(Hy = K("GuildAvailabilityStore")),
				(ks = new Map()),
				(Ds = new Map()),
				(Ni = { friends: [], requests: [] }),
				(KM = () => `relationship-notifier-guilds-${D.getCurrentUser().id}`),
				(YM = () => `relationship-notifier-groups-${D.getCurrentUser().id}`),
				(ZM = () => `relationship-notifier-friends-${D.getCurrentUser().id}`);
		});
	async function tI({ relationship: { type: e, id: t } }) {
		if (Ky === t) {
			Ky = void 0;
			return;
		}
		let o = await oo.getUser(t).catch(() => null);
		if (!!o)
			switch (e) {
				case 1:
					No.store.friends &&
						or(
							`${Ln(o)} removed you as a friend.`,
							o.getAvatarURL(void 0, void 0, !1),
							() => Eo(o.id)
						);
					break;
				case 3:
					No.store.friendRequestCancels &&
						or(
							`A friend request from ${Ln(o)} has been removed.`,
							o.getAvatarURL(void 0, void 0, !1),
							() => Eo(o.id)
						);
					break;
			}
	}
	function oI({ guild: { id: e, unavailable: t } }) {
		if (!No.store.servers || t || Hy.isUnavailable(e)) return;
		if (Yy === e) {
			Wy(e), (Yy = void 0);
			return;
		}
		let o = QM(e);
		o && (Wy(e), or(`You were removed from the server ${o.name}.`, o.iconURL));
	}
	function nI({ channel: { id: e, type: t } }) {
		if (!No.store.groups || t !== 3) return;
		if (Zy === e) {
			jy(e), (Zy = void 0);
			return;
		}
		let o = XM(e);
		o && (jy(e), or(`You were removed from the group ${o.name}.`, o.iconURL));
	}
	var Ky,
		Yy,
		Zy,
		JM,
		VM,
		eI,
		rI = g(() => {
			"use strict";
			a();
			it();
			b();
			ym();
			Gy();
			qy();
			(JM = (e) => (Ky = e)), (VM = (e) => (Yy = e)), (eI = (e) => (Zy = e));
		});
	var bm,
		iI = g(() => {
			"use strict";
			a();
			P();
			T();
			rI();
			ym();
			qy();
			bm = h({
				name: "RelationshipNotifier",
				description:
					"Notifies you when a friend, group chat, or server removes you.",
				authors: [d.nick],
				settings: No,
				patches: [
					{
						find: "removeRelationship:(",
						replacement: {
							match: /(removeRelationship:\((\i),\i,\i\)=>)/,
							replace: "$1($self.removeFriend($2),0)||",
						},
					},
					{
						find: "async leaveGuild(",
						replacement: {
							match: /(leaveGuild\((\i)\){)/,
							replace: "$1$self.removeGuild($2);",
						},
					},
					{
						find: "},closePrivateChannel(",
						replacement: {
							match: /(closePrivateChannel\((\i)\){)/,
							replace: "$1$self.removeGroup($2);",
						},
					},
				],
				flux: {
					GUILD_CREATE: vm,
					GUILD_DELETE: oI,
					CHANNEL_CREATE: Sm,
					CHANNEL_DELETE: nI,
					RELATIONSHIP_ADD: Ml,
					RELATIONSHIP_UPDATE: Ml,
					RELATIONSHIP_REMOVE(e) {
						tI(e), Ml();
					},
					CONNECTION_OPEN: zy,
				},
				async start() {
					setTimeout(() => {
						zy();
					}, 5e3);
				},
				removeFriend: JM,
				removeGroup: eI,
				removeGuild: VM,
			});
		});
	function hL(e, t) {
		open(t + encodeURIComponent(e.trim()), "_blank");
	}
	function yL(e) {
		let t = {};
		return (
			Il.store.customEngineName &&
				Il.store.customEngineURL &&
				(t[Il.store.customEngineName] = Il.store.customEngineURL),
			(t = { ...t, ...gL }),
			n(
				E.MenuItem,
				{ label: "Search Text", key: "search-text", id: "vc-search-text" },
				Object.keys(t).map((o) => {
					let r = "vc-search-content-" + o;
					return n(E.MenuItem, {
						key: r,
						id: r,
						label: n(
							Wi,
							{ style: { alignItems: "center", gap: "0.5em" } },
							n("img", {
								style: { borderRadius: "50%" },
								"aria-hidden": "true",
								height: 16,
								width: 16,
								src: `https://www.google.com/s2/favicons?domain=${t[o]}&sz=64`,
							}),
							o
						),
						action: () => hL(e, t[o]),
					});
				})
			)
		);
	}
	var gL,
		Il,
		vL,
		Tm,
		sI = g(() => {
			"use strict";
			a();
			ho();
			F();
			P();
			T();
			b();
			(gL = {
				Google: "https://www.google.com/search?q=",
				DuckDuckGo: "https://duckduckgo.com/",
				Brave: "https://search.brave.com/search?q=",
				Bing: "https://www.bing.com/search?q=",
				Yahoo: "https://search.yahoo.com/search?p=",
				Yandex: "https://yandex.com/search/?text=",
				GitHub: "https://github.com/search?q=",
				Reddit: "https://www.reddit.com/search?q=",
				Wikipedia: "https://wikipedia.org/w/index.php?search=",
			}),
				(Il = x({
					customEngineName: {
						description: "Name of the custom search engine",
						type: 0,
						placeholder: "Google",
					},
					customEngineURL: {
						description: "The URL of your Engine",
						type: 0,
						placeholder: "https://google.com/search?q=",
					},
				}));
			(vL = (e, t) => {
				let o = document.getSelection()?.toString();
				if (!o) return;
				let r = Ve("search-google", e);
				if (r) {
					let i = r.findIndex((s) => s?.props?.id === "search-google");
					i !== -1 && (r[i] = yL(o));
				}
			}),
				(Tm = h({
					name: "ReplaceGoogleSearch",
					description: "Replaces the Google search with different Engines",
					authors: [d.Moxxie, d.Ethan],
					settings: Il,
					contextMenus: { message: vL },
				}));
		});
	var aI = g(() => {});
	function cI(e) {
		return n("i", { className: TL.separator, "aria-hidden": !0, ...e });
	}
	function xL({ referencedMessage: e, baseMessage: t }) {
		if (e.state !== 0) return null;
		let o = e.message.timestamp,
			r = t.timestamp;
		return n(
			Zt,
			{
				className: "vc-reply-timestamp",
				compact: lI(o, r),
				timestamp: o,
				isInline: !1,
			},
			n(cI, null, "["),
			lI(o, r) ? bL(o, "LT") : SL(o),
			n(cI, null, "]")
		);
	}
	var SL,
		bL,
		lI,
		TL,
		xm,
		uI = g(() => {
			"use strict";
			a();
			aI();
			re();
			P();
			T();
			U();
			b();
			({
				calendarFormat: SL,
				dateFormat: bL,
				isSameDay: lI,
			} = zt("millisecondsInUnit:", {
				calendarFormat: ne.byCode("sameElse"),
				dateFormat: ne.byCode(':").concat'),
				isSameDay: ne.byCode("Math.abs(+"),
			})),
				(TL = C("separator", "latin24CompactTimeStamp"));
			xm = h({
				name: "ReplyTimestamp",
				description: "Shows a timestamp on replied-message previews",
				authors: [d.Kyuuhachi],
				patches: [
					{
						find: ".REPLY_QUOTE_MESSAGE_BLOCKED",
						replacement: {
							match: /(?<="aria-label":\i,children:\[)(?=\i,\i,\i\])/,
							replace: "$self.ReplyTimestamp(arguments[0]),",
						},
					},
				],
				ReplyTimestamp: R.wrap(xL, { noop: !0 }),
			});
		});
	var wL,
		PL,
		wm,
		pI = g(() => {
			"use strict";
			a();
			P();
			T();
			U();
			(wL = C("spoilerContent")),
				(PL = C("messagesWrapper")),
				(wm = h({
					name: "RevealAllSpoilers",
					description:
						"Reveal all spoilers in a message by Ctrl-clicking a spoiler, or in the chat with Ctrl+Shift-click",
					authors: [d.whqwert],
					patches: [
						{
							find: ".removeObscurity,",
							replacement: {
								match: /(?<="removeObscurity",(\i)=>{)/,
								replace: (e, t) => `$self.reveal(${t});`,
							},
						},
					],
					reveal(e) {
						let { ctrlKey: t, shiftKey: o, target: r } = e;
						if (!t) return;
						let { spoilerContent: i, hidden: s } = wL,
							{ messagesWrapper: l } = PL,
							c = o ? document.querySelector(`div.${l}`) : r.parentElement;
						for (let u of c.querySelectorAll(`span.${i}.${s}`)) u.click();
					},
				}));
		});
	function dI(e, t) {
		open(t + encodeURIComponent(e), "_blank");
	}
	function mI(e) {
		return n(
			E.MenuItem,
			{ label: "Search Image", key: "search-image", id: "search-image" },
			Object.keys(Pm).map((t, o) => {
				let r = "search-image-" + t;
				return n(E.MenuItem, {
					key: r,
					id: r,
					label: n(
						pe,
						{ style: { alignItems: "center", gap: "0.5em" } },
						n("img", {
							style: { borderRadius: o >= 3 ? "50%" : void 0 },
							"aria-hidden": "true",
							height: 16,
							width: 16,
							src: new URL("/favicon.ico", Pm[t])
								.toString()
								.replace("lens.", ""),
						}),
						t
					),
					action: () => dI(e, Pm[t]),
				});
			}),
			n(E.MenuItem, {
				key: "search-image-all",
				id: "search-image-all",
				label: n(
					pe,
					{ style: { alignItems: "center", gap: "0.5em" } },
					n(Fn, { height: 16, width: 16 }),
					"All"
				),
				action: () => Object.values(Pm).forEach((t) => dI(e, t)),
			})
		);
	}
	var Pm,
		ML,
		IL,
		Mm,
		fI = g(() => {
			"use strict";
			a();
			ho();
			kt();
			yt();
			P();
			T();
			b();
			Pm = {
				Google: "https://lens.google.com/uploadbyurl?url=",
				Yandex: "https://yandex.com/images/search?rpt=imageview&url=",
				SauceNAO: "https://saucenao.com/search.php?url=",
				IQDB: "https://iqdb.org/?url=",
				TinEye: "https://www.tineye.com/search?url=",
				ImgOps: "https://imgops.com/start?url=",
			};
			(ML = (e, t) => {
				if (t?.reverseImageSearchType !== "img") return;
				let o = t.itemHref ?? t.itemSrc;
				Ve("copy-link", e)?.push(mI(o));
			}),
				(IL = (e, t) => {
					if (!t?.src) return;
					(Ve("copy-native-link", e) ?? e).push(mI(t.src));
				}),
				(Mm = h({
					name: "ReverseImageSearch",
					description: "Adds ImageSearch to image context menus",
					authors: [d.Ven, d.Nuckyz],
					tags: ["ImageUtilities"],
					patches: [
						{
							find: ".Messages.MESSAGE_ACTIONS_MENU_LABEL,shouldHideMediaOptions",
							replacement: {
								match:
									/favoriteableType:\i,(?<=(\i)\.getAttribute\("data-type"\).+?)/,
								replace: (e, t) =>
									`${e}reverseImageSearchType:${t}.getAttribute("data-role"),`,
							},
						},
					],
					contextMenus: { message: ML, "image-context": IL },
				}));
		});
	var gI = g(() => {});
	async function Qy() {
		xt = (await yI()) ?? {};
	}
	async function yI() {
		return (await gt.get(hI))?.[D.getCurrentUser()?.id];
	}
	async function nr() {
		return (await yI())?.token;
	}
	async function Cl(e) {
		return gt.update(
			hI,
			(t) => (
				(t ??= {}),
				(xt = t[D.getCurrentUser().id] ??= {}),
				e.token && (xt.token = e.token),
				e.user && (xt.user = e.user),
				t
			)
		);
	}
	function Ls(e) {
		ge((t) =>
			n(ei, {
				...t,
				scopes: ["identify"],
				responseType: "code",
				redirectUri: "https://manti.vendicated.dev/api/reviewdb/auth",
				permissions: 0n,
				clientId: "915703782174752809",
				cancelCompletesFlow: !1,
				callback: async (o) => {
					try {
						let r = new URL(o.location);
						r.searchParams.append("clientMod", "vencord");
						let i = await fetch(r, { headers: { Accept: "application/json" } });
						if (!i.ok) {
							let { message: l } = await i.json();
							ft(l || "An error occured while authorizing", X.Type.FAILURE);
							return;
						}
						let { token: s } = await i.json();
						Cl({ token: s }),
							ft("Successfully logged in!", X.Type.SUCCESS),
							e?.();
					} catch (r) {
						new V("ReviewDB").error("Failed to authorize", r);
					}
				},
			})
		);
	}
	var hI,
		xt,
		rr = g(() => {
			"use strict";
			a();
			qn();
			De();
			Ke();
			b();
			(hI = "rdb-auth"), (xt = {});
		});
	var Al = g(() => {
		"use strict";
		a();
	});
	function vI(e, t) {
		let o = D.getCurrentUser().id;
		return o === e || t.sender.discordID === o || xt.user?.type === 1;
	}
	function SI(e, t) {
		let o = D.getCurrentUser().id;
		return e === o && t.sender.discordID !== o;
	}
	function bI(e) {
		return e.sender.discordID !== D.getCurrentUser().id;
	}
	function ao(e, t = X.Type.MESSAGE) {
		X.show({
			id: X.genId(),
			message: e,
			type: t,
			options: { position: X.Position.BOTTOM },
		});
	}
	var Ct,
		ir = g(() => {
			"use strict";
			a();
			tt();
			b();
			rr();
			Al();
			Ct = be("vc-rdb-");
		});
	function CL(e) {
		return n(te, { text: "Unblock user" }, (t) =>
			n(
				"div",
				{
					...t,
					role: "button",
					onClick: e.onClick,
					className: Ct("block-modal-unblock"),
				},
				n(
					"svg",
					{
						height: "20",
						viewBox: "0 -960 960 960",
						width: "20",
						fill: "var(--status-danger)",
					},
					n("path", {
						d: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z",
					})
				)
			)
		);
	}
	function AL({ user: e, isBusy: t, setIsBusy: o }) {
		let [r, i] = z(!1);
		return r
			? null
			: n(
					"div",
					{ className: Ct("block-modal-row") },
					n("img", { src: e.profilePhoto, alt: "" }),
					n(S.FormText, { className: Ct("block-modal-username") }, e.username),
					n(CL, {
						onClick: t
							? void 0
							: async () => {
									o(!0);
									try {
										await Cm(e.discordID), i(!0);
									} finally {
										o(!1);
									}
								},
					})
				);
	}
	function NL() {
		let [e, t] = z(!1),
			[o, r, i] = pt(TI, {
				onError: (s) => new V("ReviewDB").error("Failed to fetch blocks", s),
				fallbackValue: [],
			});
		return i
			? null
			: r
				? n(S.FormText, null, "Failed to fetch blocks: $", String(r))
				: o.length
					? n(
							f,
							null,
							o.map((s) =>
								n(AL, { key: s.discordID, user: s, isBusy: e, setIsBusy: t })
							)
						)
					: n(S.FormText, null, "No blocked users.");
	}
	function Im() {
		ge((e) =>
			n(
				Te,
				{ ...e },
				n(
					Ee,
					{ className: Ct("block-modal-header") },
					n(S.FormTitle, { style: { margin: 0 } }, "Blocked Users"),
					n(rt, { onClick: e.onClose })
				),
				n(
					Ae,
					{ className: Ct("block-modal") },
					xt.token
						? n(NL, null)
						: n(S.FormText, null, "You are not logged into ReviewDB!")
				)
			)
		);
	}
	var Xy = g(() => {
		"use strict";
		a();
		De();
		Ke();
		ct();
		b();
		rr();
		Es();
		ir();
	});
	var sr,
		Nl = g(() => {
			"use strict";
			a();
			F();
			T();
			b();
			rr();
			Xy();
			ir();
			sr = x({
				authorize: {
					type: 6,
					description: "Authorize with ReviewDB",
					component: () =>
						n(M, { onClick: () => Ls() }, "Authorize with ReviewDB"),
				},
				notifyReviews: {
					type: 3,
					description: "Notify about new reviews on startup",
					default: !0,
				},
				showWarning: {
					type: 3,
					description:
						"Display warning to be respectful at the top of the reviews list",
					default: !0,
				},
				hideTimestamps: {
					type: 3,
					description: "Hide timestamps on reviews",
					default: !1,
				},
				hideBlockedUsers: {
					type: 3,
					description: "Hide reviews from blocked users",
					default: !0,
				},
				buttons: {
					type: 6,
					description: "ReviewDB buttons",
					component: () =>
						n(
							"div",
							{ className: Ct("button-grid") },
							n(M, { onClick: Im }, "Manage Blocked Users"),
							n(
								M,
								{
									color: M.Colors.GREEN,
									onClick: () => {
										VencordNative.native.openExternal(
											"https://github.com/sponsors/mantikafasi"
										);
									},
								},
								"Support ReviewDB development"
							),
							n(
								M,
								{
									onClick: async () => {
										let e = "https://reviewdb.mantikafasi.dev",
											t = await nr();
										t && (e += "/api/redirect?token=" + encodeURIComponent(t)),
											VencordNative.native.openExternal(e);
									},
								},
								"ReviewDB website"
							),
							n(
								M,
								{
									onClick: () => {
										VencordNative.native.openExternal(
											"https://discord.gg/eWPBSbvznt"
										);
									},
								},
								"ReviewDB Support Server"
							)
						),
				},
			}).withPrivateSettings();
		});
	async function Ri(e, t = {}) {
		return fetch(xI + e, {
			...t,
			headers: { ...t.headers, Authorization: (await nr()) || "" },
		});
	}
	async function wI(e, t = 0) {
		let o = 0;
		sr.store.showWarning || (o |= kL);
		let r = new URLSearchParams({ flags: String(o), offset: String(t) }),
			i = await fetch(`${xI}/users/${e}/reviews?${r}`),
			s = i.ok
				? await i.json()
				: {
						message:
							i.status === 429
								? "You are sending requests too fast. Wait a few seconds and try again."
								: "An Error occured while fetching reviews. Please try again later.",
						reviews: [],
						updated: !1,
						hasNextPage: !1,
						reviewCount: 0,
					};
		return i.ok
			? s
			: (ao(s.message, X.Type.FAILURE),
				{
					...s,
					reviews: [
						{
							id: 0,
							comment: s.message,
							star: 0,
							timestamp: 0,
							type: 3,
							sender: {
								id: 0,
								username: "ReviewDB",
								profilePhoto:
									"https://cdn.discordapp.com/avatars/1134864775000629298/3f87ad315b32ee464d84f1270c8d1b37.png?size=256&format=webp&quality=lossless",
								discordID: "1134864775000629298",
								badges: [],
							},
						},
					],
				});
	}
	async function PI(e) {
		return (await nr())
			? await Ri(`/users/${e.userid}/reviews`, {
					method: "PUT",
					body: JSON.stringify(e),
					headers: { "Content-Type": "application/json" },
				}).then(async (o) => {
					let r = await o.json();
					return ao(r.message), o.ok ? r : null;
				})
			: (ao("Please authorize to add a review."), Ls(), null);
	}
	async function MI(e) {
		return await Ri(`/users/${e}/reviews`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ reviewid: e }),
		}).then(async (t) => {
			let o = await t.json();
			return ao(o.message), t.ok ? o : null;
		});
	}
	async function II(e) {
		let t = await Ri("/reports", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ reviewid: e }),
		}).then((o) => o.json());
		ao(t.message);
	}
	async function CI(e, t) {
		if (
			!(
				await Ri("/blocks", {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify({ action: e, discordId: t }),
				})
			).ok
		)
			ao(`Failed to ${e} user`, X.Type.FAILURE);
		else if (
			(ao(`Successfully ${e}ed user`, X.Type.SUCCESS), xt?.user?.blockedUsers)
		) {
			let r =
				e === "block"
					? [...xt.user.blockedUsers, t]
					: xt.user.blockedUsers.filter((i) => i !== t);
			Cl({ user: { ...xt.user, blockedUsers: r } });
		}
	}
	async function TI() {
		let e = await Ri("/blocks", {
			method: "GET",
			headers: { Accept: "application/json" },
		});
		if (!e.ok) throw new Error(`${e.status}: ${e.statusText}`);
		return e.json();
	}
	function NI(e) {
		return Ri("/users", { method: "POST" }).then((t) => t.json());
	}
	async function RI(e) {
		return Ri(`/notifications?id=${e}`, { method: "PATCH" });
	}
	var xI,
		Am,
		kL,
		AI,
		Cm,
		Es = g(() => {
			"use strict";
			a();
			b();
			rr();
			Al();
			Nl();
			ir();
			(xI = "https://manti.vendicated.dev/api/reviewdb"), (Am = 50), (kL = 2);
			(AI = (e) => CI("block", e)), (Cm = (e) => CI("unblock", e));
		});
	function kI({ onClick: e }) {
		return n(te, { text: "Delete Review" }, (t) =>
			n(
				"div",
				{
					...t,
					className: H(Nm.button, Nm.dangerous),
					onClick: e,
					role: "button",
				},
				n(_n, { width: "20", height: "20" })
			)
		);
	}
	function DI({ onClick: e }) {
		return n(te, { text: "Report Review" }, (t) =>
			n(
				"div",
				{ ...t, className: Nm.button, onClick: e, role: "button" },
				n(
					"svg",
					{ width: "20", height: "20", viewBox: "0 0 24 24" },
					n("path", {
						fill: "currentColor",
						d: "M20,6.002H14V3.002C14,2.45 13.553,2.002 13,2.002H4C3.447,2.002 3,2.45 3,3.002V22.002H5V14.002H10.586L8.293,16.295C8.007,16.581 7.922,17.011 8.076,17.385C8.23,17.759 8.596,18.002 9,18.002H20C20.553,18.002 21,17.554 21,17.002V7.002C21,6.45 20.553,6.002 20,6.002Z",
					})
				)
			)
		);
	}
	function LI({ onClick: e, isBlocked: t }) {
		return n(te, { text: `${t ? "Unblock" : "Block"} user` }, (o) =>
			n(
				"div",
				{ ...o, className: Nm.button, onClick: e, role: "button" },
				n(
					"svg",
					{
						height: "20",
						viewBox: "0 -960 960 960",
						width: "20",
						fill: "currentColor",
					},
					t
						? n("path", {
								d: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
							})
						: n("path", {
								d: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z",
							})
				)
			)
		);
	}
	var Nm,
		EI = g(() => {
			"use strict";
			a();
			yt();
			me();
			U();
			b();
			Nm = C("button", "wrapper", "disabled", "separator");
		});
	function Rm(e) {
		let t = e.redirectURL
			? Vr
			: (o) => n("span", { ...o, role: "button" }, o.children);
		return n(te, { text: e.name }, ({ onMouseEnter: o, onMouseLeave: r }) =>
			n(
				t,
				{
					className: Ct("blocked-badge"),
					href: e.redirectURL,
					onClick: e.onClick,
				},
				n("img", {
					className: Ct("badge"),
					width: "22px",
					height: "22px",
					onMouseEnter: o,
					onMouseLeave: r,
					src: e.icon,
					alt: e.description,
				})
			)
		);
	}
	var OI = g(() => {
		"use strict";
		a();
		b();
		ir();
	});
	function Dl({ review: e, refetch: t, profileId: o }) {
		let [r, i] = z(!1);
		function s() {
			Eo(e.sender.discordID);
		}
		function l() {
			Tt.show({
				title: "Are you sure?",
				body: "Do you really want to delete this review?",
				confirmText: "Delete",
				cancelText: "Nevermind",
				onConfirm: async () => {
					if (await nr())
						MI(e.id).then((m) => {
							m && t();
						});
					else return ao("You must be logged in to delete reviews.");
				},
			});
		}
		function c() {
			Tt.show({
				title: "Are you sure?",
				body: "Do you really you want to report this review?",
				confirmText: "Report",
				cancelText: "Nevermind",
				onConfirm: async () => {
					if (await nr()) II(e.id);
					else return ao("You must be logged in to report reviews.");
				},
			});
		}
		let u = xt?.user?.blockedUsers?.includes(e.sender.discordID) ?? !1;
		function p() {
			if (u) return Cm(e.sender.discordID);
			Tt.show({
				title: "Are you sure?",
				body: "Do you really you want to block this user? They will be unable to leave further reviews on your profile. You can unblock users in the plugin settings.",
				confirmText: "Block",
				cancelText: "Nevermind",
				onConfirm: async () => {
					if (await nr()) AI(e.sender.discordID);
					else return ao("You must be logged in to block users.");
				},
			});
		}
		return n(
			"div",
			{
				className: H(
					Ct("review"),
					Rl.cozyMessage,
					Os.wrapper,
					Rl.message,
					Rl.groupStart,
					Os.cozy
				),
				style: { marginLeft: "0px", paddingLeft: "52px" },
			},
			n("img", {
				className: H(Os.avatar, Os.clickable),
				onClick: s,
				src:
					e.sender.profilePhoto ||
					"/assets/1f0bfc0865d324c2587920a7d80c609b.png?size=128",
				style: { left: "0px", zIndex: 0 },
			}),
			n(
				"div",
				{
					style: {
						display: "inline-flex",
						justifyContent: "center",
						alignItems: "center",
					},
				},
				n(
					"span",
					{
						className: H(Os.clickable, Os.username),
						style: { color: "var(--channels-default)", fontSize: "14px" },
						onClick: () => s(),
					},
					e.sender.username
				),
				e.type === 3 &&
					n(
						"span",
						{
							className: H(kl.botTagVerified, kl.botTagRegular, kl.px, kl.rem),
							style: { marginLeft: "4px" },
						},
						n("span", { className: kl.botText }, "System")
					)
			),
			u &&
				n(Rm, {
					name: "You have blocked this user",
					description: "You have blocked this user",
					icon: "/assets/aaee57e0090991557b66.svg",
					type: 0,
					onClick: () => Im(),
				}),
			e.sender.badges.map((m) => n(Rm, { ...m })),
			!sr.store.hideTimestamps &&
				e.type !== 3 &&
				n(
					Zt,
					{ timestamp: new Date(e.timestamp * 1e3) },
					LL.format(e.timestamp * 1e3)
				),
			n(
				"div",
				{ className: Ct("review-comment") },
				e.comment.length > 200 && !r
					? [
							Ce.parseGuildEventDescription(e.comment.substring(0, 200)),
							"...",
							n("br", null),
							n("a", { onClick: () => i(!0) }, "Read more"),
						]
					: Ce.parseGuildEventDescription(e.comment)
			),
			e.id !== 0 &&
				n(
					"div",
					{
						className: H(FI.container, FI.isHeader, Rl.buttons),
						style: { padding: "0px" },
					},
					n(
						"div",
						{ className: H(DL.wrapper, Rl.buttonsInner) },
						bI(e) && n(DI, { onClick: c }),
						SI(o, e) && n(LI, { isBlocked: u, onClick: p }),
						vI(o, e) && n(kI, { onClick: l })
					)
				)
		);
	}
	var Rl,
		FI,
		Os,
		DL,
		kl,
		LL,
		Jy = g(() => {
			"use strict";
			a();
			it();
			me();
			U();
			b();
			rr();
			Al();
			Es();
			Nl();
			ir();
			Xy();
			EI();
			OI();
			(Rl = C("cozyMessage")),
				(FI = C("container", "isHeader")),
				(Os = C("avatar", "zalgo")),
				(DL = C("button", "wrapper", "selected")),
				(kl = C("botTagRegular")),
				(LL = new Intl.DateTimeFormat());
		});
	function Vy({
		discordId: e,
		name: t,
		onFetchReviews: o,
		refetchSignal: r,
		scrollToTop: i,
		page: s = 1,
		showInput: l = !1,
		hideOwnReview: c = !1,
	}) {
		let [u, p] = Wo(!0),
			[m] = pt(() => wI(e, (s - 1) * Am), {
				fallbackValue: null,
				deps: [r, u, s],
				onSuccess: (y) => {
					sr.store.hideBlockedUsers &&
						(y.reviews = y.reviews?.filter(
							(v) => !Ie.isBlocked(v.sender.discordID)
						)),
						i?.(),
						o(y);
				},
			});
		return m
			? n(
					f,
					null,
					n(BL, {
						refetch: p,
						reviews: m.reviews,
						hideOwnReview: c,
						profileId: e,
					}),
					l &&
						n(e0, {
							name: t,
							discordId: e,
							refetch: p,
							isAuthor: m.reviews?.some(
								(y) => y.sender.discordID === D.getCurrentUser().id
							),
						})
				)
			: null;
	}
	function BL({ refetch: e, reviews: t, hideOwnReview: o, profileId: r }) {
		let i = D.getCurrentUser().id;
		return n(
			"div",
			{ className: Ct("view") },
			t?.map(
				(s) =>
					(s.sender.discordID !== i || !o) &&
					n(Dl, { key: s.id, review: s, refetch: e, profileId: r })
			),
			t?.length === 0 &&
				n(
					S.FormText,
					{ className: Ct("placeholder") },
					"Looks like nobody reviewed this user yet. You could be the first!"
				)
		);
	}
	function e0({ discordId: e, isAuthor: t, refetch: o, name: r, modalKey: i }) {
		let { token: s } = xt,
			l = St(null),
			c = OL.FORM;
		c.disableAutoFocus = !0;
		let u = _L({ id: "0", type: 1 });
		return n(
			f,
			null,
			n(
				"div",
				{
					onClick: () => {
						s || (ao("Opening authorization window..."), Ls());
					},
				},
				n(FL, {
					className: Ct("input"),
					channel: u,
					placeholder: s
						? t
							? `Update review for @${r}`
							: `Review @${r}`
						: "You need to authorize to review users!",
					type: c,
					disableThemedBackground: !0,
					setEditorRef: (p) => (l.current = p),
					parentModalKey: i,
					textValue: "",
					onSubmit: async (p) => {
						if (await PI({ userid: e, comment: p.value })) {
							o();
							let y = l.current.ref.current.getSlateEditor();
							EL.delete(y, {
								at: { anchor: _I.start(y, []), focus: _I.end(y, []) },
							});
						}
						return { shouldClear: !1, shouldRefocus: !0 };
					},
				})
			)
		);
	}
	var EL,
		_I,
		OL,
		FL,
		_L,
		BI = g(() => {
			"use strict";
			a();
			ct();
			U();
			b();
			rr();
			Es();
			Nl();
			ir();
			Jy();
			(EL = C("insertNodes", "textToText")),
				(_I = C("start", "end", "toSlateRange")),
				(OL = C("FORM")),
				(FL = ae("disableThemedBackground", "CHANNEL_TEXT_AREA")),
				(_L = fe(".GUILD_TEXT])", "fromServer)"));
		});
	function UL({ modalProps: e, modalKey: t, discordId: o, name: r }) {
		let [i, s] = z(),
			[l, c] = Wo(!0),
			[u, p] = z(1),
			m = St(null),
			y = i?.reviewCount,
			v = i?.reviews.find((N) => N.sender.discordID === xt.user?.discordID);
		return n(
			R,
			null,
			n(
				Te,
				{ ...e, size: "medium" },
				n(
					Ee,
					null,
					n(
						Z,
						{ variant: "heading-lg/semibold", className: Ct("modal-header") },
						r,
						"'s Reviews",
						!!y && n("span", null, " (", y, " Reviews)")
					),
					n(rt, { onClick: e.onClose })
				),
				n(
					Ae,
					{ scrollerRef: m },
					n(
						"div",
						{ className: Ct("modal-reviews") },
						n(Vy, {
							discordId: o,
							name: r,
							page: u,
							refetchSignal: l,
							onFetchReviews: s,
							scrollToTop: () =>
								m.current?.scrollTo({ top: 0, behavior: "smooth" }),
							hideOwnReview: !0,
						})
					)
				),
				n(
					ht,
					{ className: Ct("modal-footer") },
					n(
						"div",
						null,
						v && n(Dl, { refetch: c, review: v, profileId: o }),
						n(e0, {
							isAuthor: v != null,
							discordId: o,
							name: r,
							refetch: c,
							modalKey: t,
						}),
						!!y &&
							n(sc, {
								currentPage: u,
								maxVisiblePages: 5,
								pageSize: Am,
								totalCount: y,
								onPageChange: p,
							})
					)
				)
			)
		);
	}
	function km(e, t) {
		let o = "vc-rdb-modal-" + Date.now();
		ge((r) => n(UL, { modalKey: o, modalProps: r, discordId: e, name: t }), {
			modalKey: o,
		});
	}
	var UI = g(() => {
		"use strict";
		a();
		re();
		Ke();
		ct();
		b();
		rr();
		Es();
		ir();
		Jy();
		BI();
	});
	var ki,
		$I,
		t0,
		Dm,
		GI = g(() => {
			"use strict";
			a();
			gI();
			re();
			yt();
			P();
			me();
			T();
			U();
			b();
			rr();
			UI();
			Al();
			Es();
			Nl();
			ir();
			(ki = C("button", "buttonInner", "icon", "banner")),
				($I = (e, { guild: t }) => {
					!t ||
						e.push(
							n(E.MenuItem, {
								label: "View Reviews",
								id: "vc-rdb-server-reviews",
								icon: Fn,
								action: () => km(t.id, t.name),
							})
						);
				}),
				(t0 = (e, { user: t }) => {
					!t ||
						e.push(
							n(E.MenuItem, {
								label: "View Reviews",
								id: "vc-rdb-user-reviews",
								icon: Fn,
								action: () => km(t.id, t.username),
							})
						);
				}),
				(Dm = h({
					name: "ReviewDB",
					description: "Review other users (Adds a new settings to profiles)",
					authors: [d.mantikafasi, d.Ven],
					settings: sr,
					contextMenus: {
						"guild-header-popout": $I,
						"guild-context": $I,
						"user-context": t0,
						"user-profile-actions": t0,
						"user-profile-overflow-menu": t0,
					},
					patches: [
						{
							find: ".BITE_SIZE,user:",
							replacement: {
								match: /{profileType:\i\.\i\.BITE_SIZE,children:\[/,
								replace:
									"$&$self.BiteSizeReviewsButton({user:arguments[0].user}),",
							},
						},
						{
							find: ".FULL_SIZE,user:",
							replacement: {
								match: /{profileType:\i\.\i\.FULL_SIZE,children:\[/,
								replace:
									"$&$self.BiteSizeReviewsButton({user:arguments[0].user}),",
							},
						},
						{
							find: ".PANEL,isInteractionSource:",
							replacement: {
								match: /{profileType:\i\.\i\.PANEL,children:\[/,
								replace:
									"$&$self.BiteSizeReviewsButton({user:arguments[0].user}),",
							},
						},
					],
					flux: { CONNECTION_OPEN: Qy },
					async start() {
						let e = sr.store,
							{ lastReviewId: t, notifyReviews: o } = e;
						await Qy(),
							setTimeout(async () => {
								if (!xt.token) return;
								let r = await NI(xt.token);
								if (
									(Cl({ user: r }),
									o &&
										t &&
										t < r.lastReviewID &&
										((e.lastReviewId = r.lastReviewID),
										r.lastReviewID !== 0 &&
											ao("You have new reviews on your profile!")),
									r.notification)
								) {
									let i =
										r.notification.type === 1
											? {
													cancelText: "Appeal",
													confirmText: "Ok",
													onCancel: async () =>
														VencordNative.native.openExternal(
															"https://reviewdb.mantikafasi.dev/api/redirect?" +
																new URLSearchParams({
																	token: xt.token,
																	page: "dashboard/appeal",
																})
														),
												}
											: {};
									Tt.show({
										title: r.notification.title,
										body: Ce.parse(r.notification.content, !1),
										...i,
									}),
										RI(r.notification.id);
								}
							}, 4e3);
					},
					BiteSizeReviewsButton: R.wrap(
						({ user: e }) =>
							n(
								hr,
								{ text: "View Reviews" },
								n(
									M,
									{
										onClick: () => km(e.id, e.username),
										look: M.Looks.FILLED,
										size: M.Sizes.NONE,
										color: ki.bannerColor,
										className: H(ki.button, ki.icon, ki.banner),
										innerClassName: H(ki.buttonInner, ki.icon, ki.banner),
									},
									n(kg, { height: 16, width: 16 })
								)
							),
						{ noop: !0 }
					),
				}));
		});
	var Di,
		Lm,
		HI = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			T();
			b();
			(Di = x({
				chatMentions: {
					type: 3,
					default: !0,
					description:
						"Show role colors in chat mentions (including in the message box)",
					restartNeeded: !0,
				},
				memberList: {
					type: 3,
					default: !0,
					description: "Show role colors in member list role headers",
					restartNeeded: !0,
				},
				voiceUsers: {
					type: 3,
					default: !0,
					description: "Show role colors in the voice chat user list",
					restartNeeded: !0,
				},
				reactorsList: {
					type: 3,
					default: !0,
					description: "Show role colors in the reactors list",
					restartNeeded: !0,
				},
			})),
				(Lm = h({
					name: "RoleColorEverywhere",
					authors: [d.KingFish, d.lewisakura, d.AutumnVN],
					description: "Adds the top role color anywhere possible",
					patches: [
						{
							find: 'location:"UserMention',
							replacement: [
								{
									match:
										/onContextMenu:\i,color:\i,\.\.\.\i(?=,children:)(?<=user:(\i),channel:(\i).{0,500}?)/,
									replace:
										"$&,color:$self.getUserColor($1?.id,{channelId:$2?.id})",
								},
							],
							predicate: () => Di.store.chatMentions,
						},
						{
							find: ".userTooltip,children",
							replacement: [
								{
									match:
										/let\{id:(\i),guildId:(\i)[^}]*\}.*?\.\i,{(?=children)/,
									replace: "$&color:$self.getUserColor($1,{guildId:$2}),",
								},
							],
							predicate: () => Di.store.chatMentions,
						},
						{
							find: 'tutorialId:"whos-online',
							replacement: [
								{
									match: /null,\i," — ",\i\]/,
									replace: "null,$self.roleGroupColor(arguments[0])]",
								},
							],
							predicate: () => Di.store.memberList,
						},
						{
							find: ".Messages.THREAD_BROWSER_PRIVATE",
							replacement: [
								{
									match: /children:\[\i," — ",\i\]/,
									replace: "children:[$self.roleGroupColor(arguments[0])]",
								},
							],
							predicate: () => Di.store.memberList,
						},
						{
							find: "renderPrioritySpeaker",
							replacement: [
								{
									match: /renderName\(\){.+?usernameSpeaking\]:.+?(?=children)/,
									replace: "$&...$self.getVoiceProps(this.props),",
								},
							],
							predicate: () => Di.store.voiceUsers,
						},
						{
							find: ".reactorDefault",
							replacement: {
								match:
									/,onContextMenu:e=>.{0,15}\((\i),(\i),(\i)\).{0,250}tag:"strong"/,
								replace: "$&,style:{color:$self.getColor($2?.id,$1)}",
							},
							predicate: () => Di.store.reactorsList,
						},
					],
					settings: Di,
					getColor(e, { channelId: t, guildId: o }) {
						return (o ??= oe.getChannel(t)?.guild_id)
							? (Le.getMember(o, e)?.colorString ?? null)
							: null;
					},
					getUserColor(e, t) {
						let o = this.getColor(e, t);
						return o && parseInt(o.slice(1), 16);
					},
					roleGroupColor: R.wrap(
						({ id: e, count: t, title: o, guildId: r, label: i }) => {
							let s = le.getRole(r, e);
							return n(
								"span",
								{
									style: {
										color: s?.colorString,
										fontWeight: "unset",
										letterSpacing: ".05em",
									},
								},
								o ?? i,
								" \u2014 ",
								t
							);
						},
						{ noop: !0 }
					),
					getVoiceProps({ user: { id: e }, guildId: t }) {
						return { style: { color: this.getColor(e, { guildId: t }) } };
					},
				}));
		});
	var zI,
		$L,
		Em,
		WI = g(() => {
			"use strict";
			a();
			ho();
			yt();
			P();
			T();
			U();
			b();
			(zI = fe(".TEXTAREA_FOCUS)", "showMentionToggle:")),
				($L = (e, { message: t }) => {
					if (xe.getChannelId() !== t.channel_id) return;
					let o = oe.getChannel(t?.channel_id);
					if (!o || (o.guild_id && !qe.can(we.SEND_MESSAGES, o))) return;
					let r = Ve("pin", e);
					if (r && !r.some((s) => s?.props?.id === "reply")) {
						let s = r.findIndex((l) => l?.props.id === "pin");
						r.splice(
							s + 1,
							0,
							n(E.MenuItem, {
								id: "reply",
								label: Se.Messages.MESSAGE_ACTION_REPLY,
								icon: Pc,
								action: (l) => zI(o, t, l),
							})
						);
						return;
					}
					let i = Ve("mark-unread", e);
					if (i && !i.some((s) => s?.props?.id === "reply")) {
						i.unshift(
							n(E.MenuItem, {
								id: "reply",
								label: Se.Messages.MESSAGE_ACTION_REPLY,
								icon: Pc,
								action: (s) => zI(o, t, s),
							})
						);
						return;
					}
				}),
				(Em = h({
					name: "SearchReply",
					description: "Adds a reply button to search results",
					authors: [d.Aria],
					contextMenus: { message: $L },
				}));
		});
	var Om,
		jI = g(() => {
			"use strict";
			a();
			P();
			T();
			Om = h({
				name: "SecretRingToneEnabler",
				description:
					"Always play the secret version of the discord ringtone (except during special ringtone events)",
				authors: [d.AndrewDLO, d.FieryFlames],
				patches: [
					{
						find: '"call_ringing_beat"',
						replacement: {
							match: /500!==\i\(\)\.random\(1,1e3\)/,
							replace: "false",
						},
					},
				],
			});
		});
	var GL,
		HL,
		qI,
		Fm,
		KI = g(() => {
			"use strict";
			a();
			qn();
			F();
			P();
			T();
			U();
			b();
			(GL = K("SummaryStore")),
				(HL = fe(".people)),startId:", ".type}")),
				(qI = x({
					summaryExpiryThresholdDays: {
						type: 5,
						description:
							"The time in days before a summary is removed. Note that only up to 50 summaries are kept per channel",
						markers: [1, 3, 5, 7, 10, 15, 20, 25, 30],
						stickToMarkers: !1,
						default: 3,
					},
				})),
				(Fm = h({
					name: "Summaries",
					description:
						"Enables Discord's experimental Summaries feature on every server, displaying AI generated summaries of conversations",
					authors: [d.mantikafasi],
					settings: qI,
					patches: [
						{
							find: "SUMMARIZEABLE.has",
							replacement: {
								match: /\i\.hasFeature\(\i\.\i\.SUMMARIES_ENABLED\w+?\)/g,
								replace: "true",
							},
						},
						{
							find: "RECEIVE_CHANNEL_SUMMARY(",
							replacement: {
								match: /shouldFetch\((\i),\i\){/,
								replace: "$& if(!$self.shouldFetch($1)) return false;",
							},
						},
					],
					flux: {
						CONVERSATION_SUMMARY_UPDATE(e) {
							let t = e.summaries.map((o) => ({ ...HL(o), time: Date.now() }));
							gt.update(
								"summaries-data",
								(o) => (
									(o ??= {}),
									o[e.channel_id]
										? o[e.channel_id].unshift(...t)
										: (o[e.channel_id] = t),
									o[e.channel_id].length > 50 &&
										(o[e.channel_id] = o[e.channel_id].slice(0, 50)),
									o
								)
							);
						},
					},
					async start() {
						await gt.update("summaries-data", (e) => {
							e ??= {};
							for (let t of Object.keys(e)) {
								for (let o = e[t].length - 1; o >= 0; o--)
									e[t][o].time <
										Date.now() -
											1e3 *
												60 *
												60 *
												24 *
												qI.store.summaryExpiryThresholdDays &&
										e[t].splice(o, 1);
								e[t].length === 0 && delete e[t];
							}
							return Object.assign(GL.allSummaries(), e), e;
						});
					},
					shouldFetch(e) {
						let t = oe.getChannel(e);
						return le.getGuild(t.guild_id).hasFeature("SUMMARIES_ENABLED_GA");
					},
				}));
		});
	var YI = g(() => {});
	function QI(e) {
		let t = e.slice(1, -1).replace(/(\d)(AM|PM)$/i, "$1 $2"),
			o = new Date(`${new Date().toDateString()} ${t}`).getTime() / 1e3;
		return isNaN(o)
			? e
			: (Date.now() / 1e3 > o && (o += 86400), `<t:${Math.round(o)}:t>`);
	}
	function WL({ rootProps: e, close: t }) {
		let [o, r] = z(),
			[i, s] = z(""),
			l = Math.round((new Date(o).getTime() || Date.now()) / 1e3),
			c = (m, y) => `<t:${m}${y && `:${y}`}>`,
			[u, p] = dt(() => {
				let m = c(l, i);
				return [m, Ce.parse(m)];
			}, [l, i]);
		return n(
			Te,
			{ ...e },
			n(
				Ee,
				{ className: _m("modal-header") },
				n(S.FormTitle, { tag: "h2" }, "Timestamp Picker"),
				n(rt, { onClick: t })
			),
			n(
				Ae,
				{ className: _m("modal-content") },
				n("input", {
					type: "datetime-local",
					value: o,
					onChange: (m) => r(m.currentTarget.value),
					style: { colorScheme: Sr() === 2 ? "light" : "dark" },
				}),
				n(S.FormTitle, null, "Timestamp Format"),
				n(Do, {
					options: zL.map((m) => ({ label: m, value: m })),
					isSelected: (m) => m === i,
					select: (m) => s(m),
					serialize: (m) => m,
					renderOptionLabel: (m) =>
						n(
							"div",
							{ className: _m("format-label") },
							Ce.parse(c(l, m.value))
						),
					renderOptionValue: () => p,
				}),
				n(S.FormTitle, { className: G.bottom8 }, "Preview"),
				n(S.FormText, { className: _m("preview-text") }, p, " (", u, ")")
			),
			n(
				ht,
				null,
				n(
					M,
					{
						onClick: () => {
							ci(u + " "), t();
						},
					},
					"Insert"
				)
			)
		);
	}
	var ZI,
		zL,
		_m,
		jL,
		Bm,
		XI = g(() => {
			"use strict";
			a();
			YI();
			_r();
			Sn();
			F();
			tt();
			P();
			it();
			Ye();
			Ke();
			T();
			b();
			ZI = x({
				replaceMessageContents: {
					description: "Replace timestamps in message contents",
					type: 3,
					default: !0,
				},
			});
			(zL = ["", "t", "T", "d", "D", "f", "F", "R"]), (_m = be("vc-st-"));
			(jL = ({ isMainChat: e }) =>
				e
					? n(
							ln,
							{
								tooltip: "Insert Timestamp",
								onClick: () => {
									let t = ge((o) =>
										n(WL, { rootProps: o, close: () => Dn(t) })
									);
								},
								buttonProps: { "aria-haspopup": "dialog" },
							},
							n(
								"svg",
								{
									"aria-hidden": "true",
									role: "img",
									width: "24",
									height: "24",
									viewBox: "0 0 24 24",
									style: { scale: "1.2" },
								},
								n(
									"g",
									{ fill: "none", "fill-rule": "evenodd" },
									n("path", {
										fill: "currentColor",
										d: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z",
									}),
									n("rect", { width: "24", height: "24" })
								)
							)
						)
					: null),
				(Bm = h({
					name: "SendTimestamps",
					description:
						"Send timestamps easily via chat box button & text shortcuts. Read the extended description!",
					authors: [d.Ven, d.Tyler, d.Grzesiek11],
					dependencies: ["MessageEventsAPI", "ChatInputButtonAPI"],
					settings: ZI,
					start() {
						sn("SendTimestamps", jL),
							(this.listener = yo((e, t) => {
								ZI.store.replaceMessageContents &&
									(t.content = t.content.replace(
										/`\d{1,2}:\d{2} ?(?:AM|PM)?`/gi,
										QI
									));
							}));
					},
					stop() {
						an("SendTimestamps"), vo(this.listener);
					},
					settingsAboutComponent() {
						let e = [
							"12:00",
							"3:51",
							"17:59",
							"24:00",
							"12:00 AM",
							"0:13PM",
						].map((t) => `\`${t}\``);
						return n(
							f,
							null,
							n(
								S.FormText,
								null,
								"To quickly send send time only timestamps, include timestamps formatted as `HH:MM` (including the backticks!) in your message"
							),
							n(
								S.FormText,
								null,
								"See below for examples. If you need anything more specific, use the Date button in the chat bar!"
							),
							n(
								S.FormText,
								null,
								"Examples:",
								n(
									"ul",
									null,
									e.map((t) =>
										n(
											"li",
											{ key: t },
											n("code", null, t),
											" ",
											"->",
											" ",
											Ce.parse(QI(t))
										)
									)
								)
							)
						);
					},
				}));
		});
	var JI = g(() => {});
	function tC(e) {
		ge((t) => n(Te, { ...t, size: "medium" }, n(KL, { guild: e })));
	}
	function eC(e) {
		return n(Zt, { timestamp: new Date(e) });
	}
	function KL({ guild: e }) {
		let [t, o] = z(),
			[r, i] = z();
		ue(() => {
			(Um.friends = !1), (Um.blocked = !1);
		}, []);
		let [s, l] = z(0),
			c =
				e.banner &&
				Rt.getGuildBannerURL(e, !0).replace(/\?size=\d+$/, "?size=1024"),
			u =
				e.icon &&
				Rt.getGuildIconURL({
					id: e.id,
					icon: e.icon,
					canAnimate: !0,
					size: 512,
				});
		return n(
			"div",
			{ className: Ro("root") },
			c &&
				s === 0 &&
				n("img", {
					className: Ro("banner"),
					src: c,
					alt: "",
					onClick: () => Lo(c),
				}),
			n(
				"div",
				{ className: Ro("header") },
				u
					? n("img", { src: u, alt: "", onClick: () => Lo(u) })
					: n(
							"div",
							{ "aria-hidden": !0, className: H(VI.childWrapper, VI.acronym) },
							e.acronym
						),
				n(
					"div",
					{ className: Ro("name-and-description") },
					n(S.FormTitle, { tag: "h5", className: Ro("name") }, e.name),
					e.description && n(S.FormText, null, e.description)
				)
			),
			n(
				mo,
				{
					type: "top",
					look: "brand",
					className: Ro("tab-bar"),
					selectedItem: s,
					onItemSelect: l,
				},
				n(
					mo.Item,
					{ className: Ro("tab", { selected: s === 0 }), id: 0 },
					"Server Info"
				),
				n(
					mo.Item,
					{ className: Ro("tab", { selected: s === 1 }), id: 1 },
					"Friends",
					t !== void 0 ? ` (${t})` : ""
				),
				n(
					mo.Item,
					{ className: Ro("tab", { selected: s === 2 }), id: 2 },
					"Blocked Users",
					r !== void 0 ? ` (${r})` : ""
				)
			),
			n(
				"div",
				{ className: Ro("tab-content") },
				s === 0 && n(ZL, { guild: e }),
				s === 1 && n(QL, { guild: e, setCount: o }),
				s === 2 && n(XL, { guild: e, setCount: i })
			)
		);
	}
	function YL(e, t) {
		let o = Le.getMember(e, t.id)?.avatar,
			r = o
				? Rt.getGuildMemberAvatarURLSimple({
						userId: t.id,
						avatar: o,
						guildId: e,
						canAnimate: !0,
					})
				: Rt.getUserAvatarURL(t, !0);
		return n(
			"div",
			{ className: Ro("owner") },
			n("img", { src: r, alt: "", onClick: () => Lo(r) }),
			Ce.parse(`<@${t.id}>`)
		);
	}
	function ZL({ guild: e }) {
		let [t] = pt(() => oo.getUser(e.ownerId), {
				deps: [e.ownerId],
				fallbackValue: null,
			}),
			o = {
				"Server Owner": t ? YL(e.id, t) : "Loading...",
				"Created At": eC(Po.extractTimestamp(e.id)),
				"Joined At": e.joinedAt ? eC(e.joinedAt.getTime()) : "-",
				"Vanity Link": e.vanityURLCode
					? n("a", null, `discord.gg/${e.vanityURLCode}`)
					: "-",
				"Preferred Locale": e.preferredLocale || "-",
				"Verification Level":
					["None", "Low", "Medium", "High", "Highest"][e.verificationLevel] ||
					"?",
				"Nitro Boosts": `${e.premiumSubscriberCount ?? 0} (Level ${e.premiumTier ?? 0})`,
				Channels: yr.getChannels(e.id)?.count - 1 || "?",
				Roles: Object.keys(le.getRoles(e.id)).length - 1,
			};
		return n(
			"div",
			{ className: Ro("info") },
			Object.entries(o).map(([r, i]) =>
				n(
					"div",
					{ className: Ro("server-info-pair"), key: r },
					n(S.FormTitle, { tag: "h5" }, r),
					typeof i == "string" ? n("span", null, i) : i
				)
			)
		);
	}
	function QL({ guild: e, setCount: t }) {
		return oC("friends", e, Ie.getFriendIDs(), t);
	}
	function XL({ guild: e, setCount: t }) {
		let o = Object.keys(Ie.getRelationships()).filter((r) => Ie.isBlocked(r));
		return oC("blocked", e, o, t);
	}
	function oC(e, t, o, r) {
		let i = [],
			s = [];
		for (let l of o) Le.isMember(t.id, l) ? s.push(l) : i.push(l);
		return (
			Oe(
				[Le],
				() => Le.getMemberIds(t.id),
				null,
				(l, c) => l.length === c.length
			),
			ue(() => {
				!Um[e] &&
					i.length &&
					((Um[e] = !0),
					_.dispatch({
						type: "GUILD_MEMBERS_REQUEST",
						guildIds: [t.id],
						userIds: i,
					}));
			}, []),
			ue(() => r(s.length), [s.length]),
			n(
				Gi,
				{ fade: !0, className: Ro("scroller") },
				s.map((l) =>
					n(qL, {
						user: D.getUser(l),
						status: kn.getStatus(l) || "offline",
						onSelect: () => Eo(l),
						onContextMenu: () => {},
					})
				)
			)
		);
	}
	var VI,
		qL,
		Ro,
		Um,
		nC = g(() => {
			"use strict";
			a();
			JI();
			tt();
			it();
			me();
			Ke();
			ct();
			U();
			b();
			(VI = C("icon", "acronym", "childWrapper")),
				(qL = ae(".listName,discriminatorClass")),
				(Ro = be("vc-gp-"));
			Um = { friends: !1, blocked: !1 };
		});
	var rC,
		$m,
		iC = g(() => {
			"use strict";
			a();
			ho();
			F();
			P();
			T();
			b();
			nC();
			rC = (e, { guild: t }) => {
				Ve("privacy", e)?.push(
					n(E.MenuItem, {
						id: "vc-server-info",
						label: "Server Info",
						action: () => tC(t),
					})
				);
			};
			rn("ServerInfo", "ServerProfile");
			$m = h({
				name: "ServerInfo",
				description: "Allows you to view info about a server",
				authors: [d.Ven, d.Nuckyz],
				tags: ["guild", "info", "ServerProfile"],
				contextMenus: { "guild-context": rC, "guild-header-popout": rC },
			});
		});
	function JL() {
		return (
			(cC = Wo()),
			n(
				"span",
				{
					id: "vc-friendcount",
					style: {
						display: "inline-block",
						width: "100%",
						fontSize: "12px",
						fontWeight: "600",
						color: "var(--header-secondary)",
						textTransform: "uppercase",
						textAlign: "center",
					},
				},
				n0,
				" online"
			)
		);
	}
	function VL() {
		return (
			(uC = Wo()),
			n(
				"span",
				{
					id: "vc-guildcount",
					style: {
						display: "inline-block",
						width: "100%",
						fontSize: "12px",
						fontWeight: "600",
						color: "var(--header-secondary)",
						textTransform: "uppercase",
						textAlign: "center",
					},
				},
				lC,
				" servers"
			)
		);
	}
	function sC() {
		n0 = 0;
		let e = Ie.getRelationships();
		for (let t of Object.keys(e))
			e[t] === 1 && kn.getStatus(t) !== "offline" && (n0 += 1);
		cC?.();
	}
	function o0() {
		(lC = le.getGuildCount()), uC?.();
	}
	var n0,
		lC,
		cC,
		uC,
		aC,
		Gm,
		pC = g(() => {
			"use strict";
			a();
			gm();
			F();
			re();
			P();
			ct();
			T();
			b();
			(n0 = 0), (lC = 0);
			(aC = x({
				mode: {
					description: "mode",
					type: 4,
					options: [
						{ label: "Only online friend count", value: 2, default: !0 },
						{ label: "Only server count", value: 1 },
						{ label: "Both server and online friend counts", value: 3 },
					],
				},
			})),
				(Gm = h({
					name: "ServerListIndicators",
					description:
						"Add online friend count or server count in the server list",
					authors: [d.dzshn],
					dependencies: ["ServerListAPI"],
					settings: aC,
					renderIndicator: () => {
						let { mode: e } = aC.store;
						return n(
							R,
							{ noop: !0 },
							n(
								"div",
								{ style: { marginBottom: "4px" } },
								!!(e & 2) && n(JL, null),
								!!(e & 1) && n(VL, null)
							)
						);
					},
					flux: { PRESENCE_UPDATES: sC, GUILD_CREATE: o0, GUILD_DELETE: o0 },
					start() {
						wl(0, this.renderIndicator), sC(), o0();
					},
					stop() {
						Pl(0, this.renderIndicator);
					},
				}));
		});
	var Hm,
		dC = g(() => {
			"use strict";
			a();
			P();
			T();
			Hm = h({
				name: "ShowAllMessageButtons",
				description:
					"Always show all message buttons no matter if you are holding the shift key or not.",
				authors: [d.Nuckyz],
				patches: [
					{
						find: ".Messages.MESSAGE_UTILITIES_A11Y_LABEL",
						replacement: {
							match: /isExpanded:\i&&(.+?),/,
							replace: "isExpanded:$1,",
						},
					},
				],
			});
		});
	var mC = g(() => {});
	function gC() {
		let e = ia(fC.colors.INTERACTIVE_MUTED).hex(),
			t = ia(fC.colors.INTERACTIVE_ACTIVE).hex();
		return n(e6, {
			color: e,
			forcedIconColor: t,
			size: 16,
			tooltipText: Se.Messages.CONNECTION_VERIFIED,
		});
	}
	var fC,
		e6,
		hC = g(() => {
			"use strict";
			a();
			U();
			b();
			(fC = _e((e) => e.colors?.INTERACTIVE_MUTED?.css)),
				(e6 = ae(".CONNECTIONS_ROLE_OFFICIAL_ICON_TOOLTIP"));
		});
	function s6({ id: e, theme: t }) {
		let o = eo.getUserProfile(e);
		if (!o) return null;
		let r = o.connectedAccounts;
		return r?.length
			? n(
					pe,
					{ style: { gap: r6(zm.store.iconSpacing), flexWrap: "wrap" } },
					r.map((i) => n(a6, { connection: i, theme: t }))
				)
			: null;
	}
	function a6({ connection: e, theme: t }) {
		let o = o6.get(t6(e.type)),
			r = o.getPlatformUserUrl?.(e),
			i = n("img", {
				"aria-label": e.name,
				src: t === "light" ? o.icon.lightSVG : o.icon.darkSVG,
				style: { width: zm.store.iconSize, height: zm.store.iconSize },
			}),
			s = r ? hi : Ta;
		return n(
			te,
			{
				text: n(
					"span",
					{ className: "vc-sc-tooltip" },
					n("span", { className: "vc-sc-connection-name" }, e.name),
					e.verified && n(gC, null),
					n(s, { height: 16, width: 16 })
				),
				key: e.id,
			},
			(l) =>
				r
					? n(
							"a",
							{
								...l,
								className: "vc-user-connection",
								href: r,
								target: "_blank",
								onClick: (c) => {
									Vencord.Plugins.isPluginEnabled("OpenInApp") &&
										Vencord.Plugins.plugins.OpenInApp.handleLink(
											c.currentTarget,
											c
										);
								},
							},
							i
						)
					: n(
							"button",
							{
								...l,
								className: "vc-user-connection",
								onClick: () => Kt(e.name),
							},
							i
						)
		);
	}
	var t6,
		o6,
		n6,
		r6,
		zm,
		i6,
		Wm,
		yC = g(() => {
			"use strict";
			a();
			mC();
			F();
			re();
			kt();
			yt();
			P();
			me();
			T();
			U();
			b();
			hC();
			(t6 = fe(".TWITTER_LEGACY:")),
				(o6 = C("isSupported", "getByUrl")),
				(n6 = fe(".getPreviewThemeColors", "primaryColor:")),
				(r6 = (e) => (e ?? 0) * 2 + 4),
				(zm = x({
					iconSize: { type: 1, description: "Icon size (px)", default: 32 },
					iconSpacing: {
						type: 4,
						description: "Icon margin",
						default: 1,
						options: [
							{ label: "Compact", value: 0 },
							{ label: "Cozy", value: 1 },
							{ label: "Roomy", value: 2 },
						],
					},
				})),
				(i6 = R.wrap(
					(e) => n(s6, { ...e, id: e.user.id, theme: n6(e).theme }),
					{ noop: !0 }
				));
			Wm = h({
				name: "ShowConnections",
				description: "Show connected accounts in user popouts",
				authors: [d.TheKodeToad],
				settings: zm,
				patches: [
					{
						find: ".hasAvatarForGuild(null==",
						replacement: {
							match:
								/currentUser:\i,guild:\i}\)(?<=user:(\i),bio:null==(\i)\?.+?)/,
							replace:
								"$&,$self.profilePopoutComponent({ user: $1, displayProfile: $2 })",
						},
					},
				],
				profilePopoutComponent: i6,
			});
		});
	var vC = g(() => {});
	function v6({ channel: e }) {
		let { defaultAllowedUsersAndRolesDropdownState: t } = ar.use([
				"defaultAllowedUsersAndRolesDropdownState",
			]),
			[o, r] = z([]),
			{
				type: i,
				topic: s,
				lastMessageId: l,
				defaultForumLayout: c,
				lastPinTimestamp: u,
				defaultAutoArchiveDuration: p,
				availableTags: m,
				id: y,
				rateLimitPerUser: v,
				defaultThreadRateLimitPerUser: N,
				defaultSortOrder: w,
				defaultReactionEmoji: I,
				bitrate: A,
				rtcRegion: L,
				videoQualityMode: k,
				permissionOverwrites: $,
				guild_id: j,
			} = e;
		return (
			ue(() => {
				let Q = [],
					ee = le.getGuild(j).ownerId;
				Le.getMember(j, ee) || Q.push(ee),
					Object.values($).forEach(({ type: J, id: B }) => {
						J === 1 && !Le.getMember(j, B) && Q.push(B);
					}),
					Q.length > 0 &&
						_.dispatch({
							type: "GUILD_MEMBERS_REQUEST",
							guildIds: [j],
							userIds: Q,
						}),
					Vencord.Plugins.isPluginEnabled("PermissionsViewer") &&
						r(
							Ud(
								Object.values($).map((J) => ({
									type: J.type,
									id: J.id,
									overwriteAllow: J.allow,
									overwriteDeny: J.deny,
								})),
								j
							)
						);
			}, [y]),
			n(
				"div",
				{
					className:
						SC.auto +
						" " +
						SC.customTheme +
						" " +
						l6.chatContent +
						" shc-lock-screen-outer-container",
				},
				n(
					"div",
					{ className: "shc-lock-screen-container" },
					n("img", { className: "shc-lock-screen-logo", src: y6 }),
					n(
						"div",
						{ className: "shc-lock-screen-heading-container" },
						n(
							Z,
							{ variant: "heading-xxl/bold" },
							"This is a ",
							qe.can(we.VIEW_CHANNEL, e) ? "locked" : "hidden",
							" ",
							m6[i],
							" channel."
						),
						e.isNSFW() &&
							n(te, { text: "NSFW" }, ({ onMouseLeave: Q, onMouseEnter: ee }) =>
								n(
									"svg",
									{
										onMouseLeave: Q,
										onMouseEnter: ee,
										className: "shc-lock-screen-heading-nsfw-icon",
										width: "32",
										height: "32",
										viewBox: "0 0 48 48",
										"aria-hidden": !0,
										role: "img",
									},
									n("path", {
										fill: "currentColor",
										d: "M.7 43.05 24 2.85l23.3 40.2Zm23.55-6.25q.75 0 1.275-.525.525-.525.525-1.275 0-.75-.525-1.3t-1.275-.55q-.8 0-1.325.55-.525.55-.525 1.3t.55 1.275q.55.525 1.3.525Zm-1.85-6.1h3.65V19.4H22.4Z",
									})
								)
							)
					),
					!e.isGuildVoice() &&
						!e.isGuildStageVoice() &&
						n(
							Z,
							{ variant: "text-lg/normal" },
							"You can not see the ",
							e.isForumChannel() ? "posts" : "messages",
							" of this channel.",
							e.isForumChannel() &&
								s &&
								s.length > 0 &&
								" However you may see its guidelines:"
						),
					e.isForumChannel() &&
						s &&
						s.length > 0 &&
						n(
							"div",
							{ className: "shc-lock-screen-topic-container" },
							Ce.parseTopic(s, !1, { channelId: y })
						),
					l &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Last ",
							e.isForumChannel() ? "post" : "message",
							" created:",
							n(Zt, { timestamp: new Date(Po.extractTimestamp(l)) })
						),
					u &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Last message pin: ",
							n(Zt, { timestamp: new Date(u) })
						),
					(v ?? 0) > 0 &&
						n(Z, { variant: "text-md/normal" }, "Slowmode: ", ga(v, "seconds")),
					(N ?? 0) > 0 &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Default thread slowmode: ",
							ga(N, "seconds")
						),
					(e.isGuildVoice() || e.isGuildStageVoice()) &&
						A != null &&
						n(Z, { variant: "text-md/normal" }, "Bitrate: ", A, " bits"),
					L !== void 0 &&
						n(Z, { variant: "text-md/normal" }, "Region: ", L ?? "Automatic"),
					(e.isGuildVoice() || e.isGuildStageVoice()) &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Video quality mode: ",
							h6[k ?? 1]
						),
					(p ?? 0) > 0 &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Default inactivity duration before archiving ",
							e.isForumChannel() ? "posts" : "threads",
							":",
							" " + ga(p, "minutes")
						),
					c != null &&
						n(Z, { variant: "text-md/normal" }, "Default layout: ", g6[c]),
					w != null &&
						n(Z, { variant: "text-md/normal" }, "Default sort order: ", f6[w]),
					I != null &&
						n(
							"div",
							{ className: "shc-lock-screen-default-emoji-container" },
							n(Z, { variant: "text-md/normal" }, "Default reaction emoji:"),
							Ce.defaultRules[I.emojiName ? "emoji" : "customEmoji"].react(
								{
									name: I.emojiName
										? p6.convertSurrogateToName(I.emojiName)
										: (dn.getCustomEmojiById(I.emojiId)?.name ?? ""),
									emojiId: I.emojiId ?? void 0,
									surrogate: I.emojiName ?? void 0,
									src: I.emojiName ? d6.getURL(I.emojiName) : void 0,
								},
								void 0,
								{ key: "0" }
							)
						),
					e.hasFlag(16) &&
						n(
							Z,
							{ variant: "text-md/normal" },
							"Posts on this forum require a tag to be set."
						),
					m &&
						m.length > 0 &&
						n(
							"div",
							{ className: "shc-lock-screen-tags-container" },
							n(Z, { variant: "text-lg/bold" }, "Available tags:"),
							n(
								"div",
								{ className: "shc-lock-screen-tags" },
								m.map((Q) => n(u6, { tag: Q }))
							)
						),
					n(
						"div",
						{ className: "shc-lock-screen-allowed-users-and-roles-container" },
						n(
							"div",
							{
								className:
									"shc-lock-screen-allowed-users-and-roles-container-title",
							},
							Vencord.Plugins.isPluginEnabled("PermissionsViewer") &&
								n(
									te,
									{ text: "Permission Details" },
									({ onMouseLeave: Q, onMouseEnter: ee }) =>
										n(
											"button",
											{
												onMouseLeave: Q,
												onMouseEnter: ee,
												className:
													"shc-lock-screen-allowed-users-and-roles-container-permdetails-btn",
												onClick: () => Cs(o, le.getGuild(e.guild_id), e.name),
											},
											n(
												"svg",
												{ width: "24", height: "24", viewBox: "0 0 24 24" },
												n("path", {
													fill: "currentColor",
													d: "M7 12.001C7 10.8964 6.10457 10.001 5 10.001C3.89543 10.001 3 10.8964 3 12.001C3 13.1055 3.89543 14.001 5 14.001C6.10457 14.001 7 13.1055 7 12.001ZM14 12.001C14 10.8964 13.1046 10.001 12 10.001C10.8954 10.001 10 10.8964 10 12.001C10 13.1055 10.8954 14.001 12 14.001C13.1046 14.001 14 13.1055 14 12.001ZM19 10.001C20.1046 10.001 21 10.8964 21 12.001C21 13.1055 20.1046 14.001 19 14.001C17.8954 14.001 17 13.1055 17 12.001C17 10.8964 17.8954 10.001 19 10.001Z",
												})
											)
										)
								),
							n(Z, { variant: "text-lg/bold" }, "Allowed users and roles:"),
							n(
								te,
								{
									text: t
										? "Hide Allowed Users and Roles"
										: "View Allowed Users and Roles",
								},
								({ onMouseLeave: Q, onMouseEnter: ee }) =>
									n(
										"button",
										{
											onMouseLeave: Q,
											onMouseEnter: ee,
											className:
												"shc-lock-screen-allowed-users-and-roles-container-toggle-btn",
											onClick: () =>
												(ar.store.defaultAllowedUsersAndRolesDropdownState =
													!t),
										},
										n(
											"svg",
											{
												width: "24",
												height: "24",
												viewBox: "0 0 24 24",
												transform: t ? "scale(1 -1)" : "scale(1 1)",
											},
											n("path", {
												fill: "currentColor",
												d: "M16.59 8.59003L12 13.17L7.41 8.59003L6 10L12 16L18 10L16.59 8.59003Z",
											})
										)
									)
							)
						),
						t && n(c6, { channel: e })
					)
				)
			)
		);
	}
	var SC,
		l6,
		c6,
		u6,
		p6,
		d6,
		m6,
		f6,
		g6,
		h6,
		y6,
		bC,
		TC = g(() => {
			"use strict";
			a();
			re();
			On();
			U();
			b();
			hl();
			gl();
			r0();
			(SC = C("auto", "managedReactiveScroller")),
				(l6 = C("chat", "content", "noChat", "chatContent")),
				(c6 = ae(".Messages.ROLE_REQUIRED_SINGLE_USER_MESSAGE")),
				(u6 = ae(".Messages.FORUM_TAG_A11Y_FILTER_BY_TAG")),
				(p6 = C("convertSurrogateToName")),
				(d6 = C("getURL", "getEmojiColors")),
				(m6 = {
					[0]: "text",
					[5]: "announcement",
					[15]: "forum",
					[2]: "voice",
					[13]: "stage",
				}),
				(f6 = { [0]: "Latest activity", [1]: "Creation date" }),
				(g6 = { [0]: "Not set", [1]: "List view", [2]: "Gallery view" }),
				(h6 = { [1]: "Automatic", [2]: "720p" }),
				(y6 = "/assets/433e3ec4319a9d11b0cbe39342614982.svg");
			bC = R.wrap(v6);
		});
	var xC,
		wC,
		ar,
		jm,
		r0 = g(() => {
			"use strict";
			a();
			vC();
			F();
			re();
			P();
			Jo();
			T();
			U();
			b();
			TC();
			(xC = C("modeMuted", "modeSelected", "unread", "icon")),
				(wC = 1n << 20n),
				(ar = x({
					hideUnreads: {
						description: "Hide Unreads",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
					showMode: {
						description: "The mode used to display hidden channels.",
						type: 4,
						options: [
							{
								label: "Plain style with Lock Icon instead",
								value: 0,
								default: !0,
							},
							{
								label: "Muted style with hidden eye icon on the right",
								value: 1,
							},
						],
						restartNeeded: !0,
					},
					defaultAllowedUsersAndRolesDropdownState: {
						description:
							"Whether the allowed users and roles dropdown on hidden channels should be open by default",
						type: 3,
						default: !0,
					},
				})),
				(jm = h({
					name: "ShowHiddenChannels",
					description: "Show channels that you do not have access to view.",
					authors: [
						d.BigDuck,
						d.AverageReactEnjoyer,
						d.D3SOX,
						d.Ven,
						d.Nuckyz,
						d.Nickyux,
						d.dzshn,
					],
					settings: ar,
					patches: [
						{
							find: '"placeholder-channel-id"',
							replacement: [
								{
									match:
										/if\(!\i\.\i\.can\(\i\.\i\.VIEW_CHANNEL.+?{if\(this\.id===\i\).+?threadIds:\[\]}}/,
									replace: "",
								},
								{
									match: /(?<=&&)(?=!\i\.\i\.hasUnread\(this\.record\.id\))/,
									replace: "$self.isHiddenChannel(this.record)||",
								},
								{
									match:
										/(activeJoinedRelevantThreads:.{0,50}VIEW_CHANNEL.+?renderLevel:(.+?),threadIds.+?renderLevel:).+?(?=,threadIds)/g,
									replace: (e, t, o) => `${t}${o}`,
								},
								{
									match:
										/(getRenderLevel\(\i\){.+?return)!\i\.\i\.can\(\i\.\i\.VIEW_CHANNEL,this\.record\)\|\|/,
									replace: (e, t) => `${t} `,
								},
							],
						},
						{
							find: "VoiceChannel, transitionTo: Channel does not have a guildId",
							replacement: [
								{
									match:
										/(?<=getCurrentClientVoiceChannelId\((\i)\.guild_id\);return)/,
									replace: (e, t) => `!$self.isHiddenChannel(${t})&&`,
								},
								{
									match: /(?=&&\i\.\i\.selectVoiceChannel\((\i)\.id\))/,
									replace: (e, t) => `&&!$self.isHiddenChannel(${t})`,
								},
								{
									match:
										/!__OVERLAY__&&\((?<=selectVoiceChannel\((\i)\.id\).+?)/,
									replace: (e, t) => `${e}$self.isHiddenChannel(${t},true)||`,
								},
							],
						},
						{
							find: ".AUDIENCE),{isSubscriptionGated",
							replacement: {
								match: /!(\i)\.isRoleSubscriptionTemplatePreviewChannel\(\)/,
								replace: (e, t) => `${e}&&!$self.isHiddenChannel(${t})`,
							},
						},
						{
							find: 'tutorialId:"instant-invite"',
							replacement: [
								...["renderEditButton", "renderInviteButton"].map((e) => ({
									match: new RegExp(`(?<=${e}\\(\\){)`, "g"),
									replace:
										"if($self.isHiddenChannel(this.props.channel))return null;",
								})),
							],
						},
						{
							find: "VoiceChannel.renderPopout: There must always be something to render",
							all: !0,
							replacement: {
								match: /(?<="renderOpenChatButton",\(\)=>{)/,
								replace:
									"if($self.isHiddenChannel(this.props.channel))return null;",
							},
						},
						{
							find: ".Messages.CHANNEL_TOOLTIP_DIRECTORY",
							predicate: () => ar.store.showMode === 0,
							replacement: {
								match:
									/(?=switch\((\i)\.type\).{0,30}\.GUILD_ANNOUNCEMENT.{0,70}\(0,\i\.\i\))/,
								replace: (e, t) =>
									`if($self.isHiddenChannel(${t}))return $self.LockIcon;`,
							},
						},
						{
							find: "UNREAD_IMPORTANT:",
							predicate: () => ar.store.showMode === 1,
							replacement: [
								{
									match: /{channel:(\i),name:\i,muted:(\i).+?;/,
									replace: (e, t, o) =>
										`${e}${o}=$self.isHiddenChannel(${t})?true:${o};`,
								},
								{
									match:
										/\.name\),.{0,120}\.children.+?:null(?<=,channel:(\i).+?)/,
									replace: (e, t) =>
										`${e},$self.isHiddenChannel(${t})?$self.HiddenChannelIcon():null`,
								},
								{
									match:
										/(?<=\.wrapper:\i\.notInteractive,)(.+?)if\((\i)\)return (\i\.MUTED);/,
									replace: (e, t, o, r) =>
										`${o}?${r}:"",${t}if(${o})return "";`,
								},
							],
						},
						{
							find: "UNREAD_IMPORTANT:",
							replacement: [
								{
									predicate: () =>
										ar.store.hideUnreads === !1 && ar.store.showMode === 1,
									match: /\.LOCKED;if\((?<={channel:(\i).+?)/,
									replace: (e, t) => `${e}!$self.isHiddenChannel(${t})&&`,
								},
								{
									predicate: () => ar.store.hideUnreads === !0,
									match: /{channel:(\i),name:\i,.+?unread:(\i).+?;/,
									replace: (e, t, o) =>
										`${e}${o}=$self.isHiddenChannel(${t})?false:${o};`,
								},
							],
						},
						{
							find: '="ChannelListUnreadsStore",',
							replacement: {
								match: /(?<=\.id\)\))(?=&&\(0,\i\.\i\)\((\i)\))/,
								replace: (e, t) => `&&!$self.isHiddenChannel(${t})`,
							},
						},
						{
							find: "renderBottomUnread(){",
							replacement: {
								match: /(?<=!0\))(?=&&\(0,\i\.\i\)\((\i\.record)\))/,
								replace: "&&!$self.isHiddenChannel($1)",
							},
						},
						{
							find: "ignoreRecents:!0",
							replacement: {
								match: /(?<=\.id\)\))(?=&&\(0,\i\.\i\)\((\i)\))/,
								replace: "&&!$self.isHiddenChannel($1)",
							},
						},
						{
							find: "Missing channel in Channel.renderHeaderToolbar",
							replacement: [
								{
									match:
										/(?<="renderHeaderToolbar",\(\)=>{.+?case \i\.\i\.GUILD_TEXT:)(?=.+?(\i\.push.{0,50}channel:(\i)},"notifications"\)\)))(?<=isLurking:(\i).+?)/,
									replace: (e, t, o, r) =>
										`if(!${r}&&$self.isHiddenChannel(${o})){${t};break;}`,
								},
								{
									match:
										/(?<="renderHeaderToolbar",\(\)=>{.+?case \i\.\i\.GUILD_MEDIA:)(?=.+?(\i\.push.{0,40}channel:(\i)},"notifications"\)\)))(?<=isLurking:(\i).+?)/,
									replace: (e, t, o, r) =>
										`if(!${r}&&$self.isHiddenChannel(${o})){${t};break;}`,
								},
								{
									match:
										/"renderMobileToolbar",\(\)=>{.+?case \i\.\i\.GUILD_DIRECTORY:(?<=let{channel:(\i).+?)/,
									replace: (e, t) =>
										`${e}if($self.isHiddenChannel(${t}))break;`,
								},
								{
									match:
										/(?<="renderHeaderBar",\(\)=>{.+?hideSearch:(\i)\.isDirectory\(\))/,
									replace: (e, t) => `||$self.isHiddenChannel(${t})`,
								},
								{
									match: /(?<=renderSidebar\(\){)/,
									replace:
										"if($self.isHiddenChannel(this.props.channel))return null;",
								},
								{
									match: /(?<=renderChat\(\){)/,
									replace:
										"if($self.isHiddenChannel(this.props.channel))return $self.HiddenChannelLockScreen(this.props.channel);",
								},
							],
						},
						{
							find: '"MessageManager"',
							replacement: {
								match:
									/"Skipping fetch because channelId is a static route"\);return}(?=.+?getChannel\((\i)\))/,
								replace: (e, t) =>
									`${e}if($self.isHiddenChannel({channelId:${t}}))return;`,
							},
						},
						{
							find: '"alt+shift+down"',
							replacement: {
								match:
									/(?<=getChannel\(\i\);return null!=(\i))(?=.{0,200}?>0\)&&\(0,\i\.\i\)\(\i\))/,
								replace: (e, t) => `&&!$self.isHiddenChannel(${t})`,
							},
						},
						{
							find: ".APPLICATION_STORE&&null!=",
							replacement: {
								match: /getState\(\)\.channelId.+?(?=\.map\(\i=>\i\.id)/,
								replace: "$&.filter(e=>!$self.isHiddenChannel(e))",
							},
						},
						{
							find: ".Messages.ROLE_REQUIRED_SINGLE_USER_MESSAGE",
							replacement: [
								{
									match:
										/ADMINISTRATOR\)\|\|(?<=context:(\i)}.+?)(?=(.+?)VIEW_CHANNEL)/,
									replace: (e, t, o) =>
										`${e}!Vencord.Webpack.Common.PermissionStore.can(${wC}n,${t})?${o}CONNECT):`,
								},
								{
									match:
										/permissionOverwrites\[.+?\i=(?<=context:(\i)}.+?)(?=(.+?)VIEW_CHANNEL)/,
									replace: (e, t, o) =>
										`${e}!Vencord.Webpack.Common.PermissionStore.can(${wC}n,${t})?${o}CONNECT):`,
								},
								{
									match: /sortBy.{0,30}?\.filter\(\i=>(?<=channel:(\i).+?)/,
									replace: (e, t) => `${e}$self.isHiddenChannel(${t})?true:`,
								},
								{
									match: /forceRoles:.+?.value\(\)(?<=channel:(\i).+?)/,
									replace: (e, t) =>
										`${e}.reduce(...$self.makeAllowedRolesReduce(${t}.guild_id))`,
								},
								{
									match:
										/MANAGE_ROLES.{0,90}?return(?=\(.+?(\(0,\i\.jsxs\)\("div",{className:\i\.members.+?guildId:(\i)\.guild_id.+?roleColor.+?\]}\)))/,
									replace: (e, t, o) => (
										(t = t.replace(Yt(/(?<=users:\i)/), `,shcChannel:${o}`)),
										(t = t.replace(Yt(/1!==\i\.length/), "true")),
										`${e} $self.isHiddenChannel(${o},true)?${t}:`
									),
								},
							],
						},
						{
							find: '})},"overflow"))',
							replacement: [
								{
									match: /users:\i,maxUsers:\i.+?}=(\i).*?;/,
									replace: (e, t) => `${e}let{shcChannel}=${t};`,
								},
								{
									match: /\i>0(?=&&.{0,60}renderPopout)/,
									replace: (e) =>
										`($self.isHiddenChannel(typeof shcChannel!=="undefined"?shcChannel:void 0,true)?true:${e})`,
								},
								{
									match:
										/(?<=\.value\(\),(\i)=.+?length-)1(?=\]=.{0,60}renderPopout)/,
									replace: (e, t) =>
										`($self.isHiddenChannel(typeof shcChannel!=="undefined"?shcChannel:void 0,true)&&${t}<=0?0:1)`,
								},
								{
									match: /(?<="\+",)(\i)\+1/,
									replace: (e, t) =>
										`$self.isHiddenChannel(typeof shcChannel!=="undefined"?shcChannel:void 0,true)&&${t}<=0?"":${e}`,
								},
							],
						},
						{
							find: ".Messages.CHANNEL_CALL_CURRENT_SPEAKER.format",
							replacement: [
								{
									match:
										/"more-options-popout"\)\),(?<=channel:(\i).+?inCall:(\i).+?)/,
									replace: (e, t, o) =>
										`${e}${o}||!$self.isHiddenChannel(${t},true)&&`,
								},
								{
									match:
										/"popup".{0,100}?if\((?<=channel:(\i).+?inCall:(\i).+?)/,
									replace: (e, t, o) =>
										`${e}(${o}||!$self.isHiddenChannel(${t},true))&&`,
								},
							],
						},
						{
							find: ".Messages.EMBEDDED_ACTIVITIES_DEVELOPER_ACTIVITY_SHELF_FETCH_ERROR",
							replacement: [
								{
									match:
										/renderContent\(\i\){.+?this\.renderVoiceChannelEffects.+?children:/,
									replace:
										"$&!this.props.inCall&&$self.isHiddenChannel(this.props.channel,true)?$self.HiddenChannelLockScreen(this.props.channel):",
								},
								{
									match: /renderContent\(\i\){.+?disableGradients:/,
									replace:
										"$&!this.props.inCall&&$self.isHiddenChannel(this.props.channel,true)||",
								},
								{
									match: /(?:{|,)render(?!Header|ExternalHeader).{0,30}?:/g,
									replace:
										"$&!this.props.inCall&&$self.isHiddenChannel(this.props.channel,true)?()=>null:",
								},
								{
									match: /callContainer,(?<=\i\.callContainer,)/,
									replace:
										'$&!this.props.inCall&&$self.isHiddenChannel(this.props.channel,true)?"":',
								},
							],
						},
						{
							find: '"HasBeenInStageChannel"',
							replacement: [
								{
									match:
										/"124px".+?children:(?<=let \i,{channel:(\i).+?)(?=.{0,20}?}\)}function)/,
									replace: (e, t) =>
										`${e}$self.isHiddenChannel(${t})?$self.HiddenChannelLockScreen(${t}):`,
								},
								{
									match:
										/render(?:BottomLeft|BottomCenter|BottomRight|ChatToasts):\(\)=>(?<=let \i,{channel:(\i).+?)/g,
									replace: (e, t) => `${e}$self.isHiddenChannel(${t})?null:`,
								},
								{
									match:
										/"124px".+?disableGradients:(?<=let \i,{channel:(\i).+?)/,
									replace: (e, t) => `${e}$self.isHiddenChannel(${t})||`,
								},
								{
									match: /"124px".+?style:(?<=let \i,{channel:(\i).+?)/,
									replace: (e, t) => `${e}$self.isHiddenChannel(${t})?void 0:`,
								},
							],
						},
						{
							find: ".Messages.STAGE_FULL_MODERATOR_TITLE",
							replacement: [
								{
									match:
										/\(0,\i\.jsx\)\(\i\.\i\.Divider.+?}\)]}\)(?=.+?:(\i)\.guild_id)/,
									replace: (e, t) => `$self.isHiddenChannel(${t})?null:(${e})`,
								},
								{
									match:
										/"recents".+?&&(?=\(.+?channelId:(\i)\.id,showRequestToSpeakSidebar)/,
									replace: (e, t) => `${e}!$self.isHiddenChannel(${t})&&`,
								},
							],
						},
						{
							find: ",queryStaticRouteChannels(",
							replacement: [
								{
									match: /(?<=queryChannels\(\i\){.+?getChannels\(\i)(?=\))/,
									replace: ",true",
								},
								{
									match:
										/(?<=queryChannels\(\i\){.+?\)\((\i)\.type\))(?=&&!\i\.\i\.can\()/,
									replace: "&&!$self.isHiddenChannel($1)",
								},
							],
						},
						{
							find: '"^/guild-stages/(\\\\d+)(?:/)?(\\\\d+)?"',
							replacement: {
								match: /\i\.\i\.can\(\i\.\i\.VIEW_CHANNEL,\i\)/,
								replace: "true",
							},
						},
						{
							find: 'className:"channelMention",children',
							replacement: {
								match:
									/(?<=getChannel\(\i\);if\(null!=(\i))(?=.{0,100}?selectVoiceChannel)/,
								replace: (e, t) => `&&!$self.isHiddenChannel(${t})`,
							},
						},
						{
							find: '="GuildChannelStore",',
							replacement: [
								{
									match: /isChannelGated\(.+?\)(?=&&)/,
									replace: (e) => `${e}&&false`,
								},
								{
									match: /(?<=getChannels\(\i)(\){.+?)return (.+?)}/,
									replace: (e, t, o) =>
										`,shouldIncludeHidden${t}return $self.resolveGuildChannels(${o},shouldIncludeHidden??arguments[0]==="@favorites");}`,
								},
							],
						},
						{
							find: ".Messages.FORM_LABEL_MUTED",
							replacement: {
								match: /(?<=getChannels\(\i)(?=\))/,
								replace: ",true",
							},
						},
						{
							find: '="NowPlayingViewStore",',
							replacement: {
								match:
									/(getVoiceStateForUser.{0,150}?)&&\i\.\i\.canWithPartialContext.{0,20}VIEW_CHANNEL.+?}\)(?=\?)/,
								replace: "$1",
							},
						},
					],
					isHiddenChannel(e, t = !1) {
						try {
							return !e ||
								(e.channelId && (e = oe.getChannel(e.channelId)),
								!e || e.isDM() || e.isGroupDM() || e.isMultiUserDM())
								? !1
								: !qe.can(we.VIEW_CHANNEL, e) || (t && !qe.can(we.CONNECT, e));
						} catch (o) {
							return (
								console.error("[ViewHiddenChannels#isHiddenChannel]: ", o), !1
							);
						}
					},
					resolveGuildChannels(e, t) {
						if (t) return e;
						let o = {};
						for (let [r, i] of Object.entries(e)) {
							if (!Array.isArray(i)) {
								o[r] = i;
								continue;
							}
							o[r] ??= [];
							for (let s of i)
								(s.channel.id === null || !this.isHiddenChannel(s.channel)) &&
									o[r].push(s);
						}
						return o;
					},
					makeAllowedRolesReduce(e) {
						return [
							(t, o, r, i) => {
								if (r !== 0) return t;
								let s = i.find((l) => l.id === e);
								return s ? [s] : i;
							},
							[],
						];
					},
					HiddenChannelLockScreen: (e) => n(bC, { channel: e }),
					LockIcon: R.wrap(
						() =>
							n(
								"svg",
								{
									className: xC.icon,
									height: "18",
									width: "20",
									viewBox: "0 0 24 24",
									"aria-hidden": !0,
									role: "img",
								},
								n("path", {
									className: "shc-evenodd-fill-current-color",
									d: "M17 11V7C17 4.243 14.756 2 12 2C9.242 2 7 4.243 7 7V11C5.897 11 5 11.896 5 13V20C5 21.103 5.897 22 7 22H17C18.103 22 19 21.103 19 20V13C19 11.896 18.103 11 17 11ZM12 18C11.172 18 10.5 17.328 10.5 16.5C10.5 15.672 11.172 15 12 15C12.828 15 13.5 15.672 13.5 16.5C13.5 17.328 12.828 18 12 18ZM15 11H9V7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V11Z",
								})
							),
						{ noop: !0 }
					),
					HiddenChannelIcon: R.wrap(
						() =>
							n(
								te,
								{ text: "Hidden Channel" },
								({ onMouseLeave: e, onMouseEnter: t }) =>
									n(
										"svg",
										{
											onMouseLeave: e,
											onMouseEnter: t,
											className: xC.icon + " shc-hidden-channel-icon",
											width: "24",
											height: "24",
											viewBox: "0 0 24 24",
											"aria-hidden": !0,
											role: "img",
										},
										n("path", {
											className: "shc-evenodd-fill-current-color",
											d: "m19.8 22.6-4.2-4.15q-.875.275-1.762.413Q12.95 19 12 19q-3.775 0-6.725-2.087Q2.325 14.825 1 11.5q.525-1.325 1.325-2.463Q3.125 7.9 4.15 7L1.4 4.2l1.4-1.4 18.4 18.4ZM12 16q.275 0 .512-.025.238-.025.513-.1l-5.4-5.4q-.075.275-.1.513-.025.237-.025.512 0 1.875 1.312 3.188Q10.125 16 12 16Zm7.3.45-3.175-3.15q.175-.425.275-.862.1-.438.1-.938 0-1.875-1.312-3.188Q13.875 7 12 7q-.5 0-.938.1-.437.1-.862.3L7.65 4.85q1.025-.425 2.1-.638Q10.825 4 12 4q3.775 0 6.725 2.087Q21.675 8.175 23 11.5q-.575 1.475-1.512 2.738Q20.55 15.5 19.3 16.45Zm-4.625-4.6-3-3q.7-.125 1.288.112.587.238 1.012.688.425.45.613 1.038.187.587.087 1.162Z",
										})
									)
							),
						{ noop: !0 }
					),
				}));
		});
	var Ll,
		Pn,
		qm,
		PC = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(Ll = (e) => ({
				type: 3,
				description: e,
				default: !0,
				restartNeeded: !0,
			})),
				(Pn = x({
					showTimeouts: Ll("Show member timeout icons in chat."),
					showInvitesPaused: Ll(
						"Show the invites paused tooltip in the server list."
					),
					showModView: Ll(
						"Show the member mod view context menu item in all servers."
					),
					disableDiscoveryFilters: Ll(
						"Disable filters in Server Discovery search that hide servers that don't meet discovery criteria."
					),
					disableDisallowedDiscoveryFilters: Ll(
						"Disable filters in Server Discovery search that hide NSFW & disallowed servers."
					),
				}));
			rn("ShowHiddenThings", "ShowTimeouts");
			qm = h({
				name: "ShowHiddenThings",
				tags: [
					"ShowTimeouts",
					"ShowInvitesPaused",
					"ShowModView",
					"DisableDiscoveryFilters",
				],
				description:
					"Displays various hidden & moderator-only things regardless of permissions.",
				authors: [d.Dolfies],
				patches: [
					{
						find: "showCommunicationDisabledStyles",
						predicate: () => Pn.store.showTimeouts,
						replacement: {
							match:
								/&&\i\.\i\.canManageUser\(\i\.\i\.MODERATE_MEMBERS,\i\.author,\i\)/,
							replace: "",
						},
					},
					{
						find: "INVITES_DISABLED))||",
						predicate: () => Pn.store.showInvitesPaused,
						replacement: {
							match: /\i\.\i\.can\(\i\.\i.MANAGE_GUILD,\i\)/,
							replace: "true",
						},
					},
					{
						find: /context:\i,checkElevated:!1\}\),\i\.\i.{0,200}autoTrackExposure/,
						predicate: () => Pn.store.showModView,
						replacement: {
							match:
								/return \i\.\i\(\i\.\i\(\{user:\i,context:\i,checkElevated:!1\}\),\i\.\i\)/,
							replace: "return true",
						},
					},
					{
						find: "Messages.GUILD_MEMBER_MOD_VIEW_PERMISSION_GRANTED_BY_ARIA_LABEL,allowOverflow",
						predicate: () => Pn.store.showModView,
						replacement: {
							match: /(role:)\i(?=,guildId.{0,100}role:(\i\[))/,
							replace: "$1$2arguments[0].member.highestRoleId]",
						},
					},
					{
						find: "prod_discoverable_guilds",
						predicate: () => Pn.store.disableDiscoveryFilters,
						replacement: { match: /\{"auto_removed:.*?\}/, replace: "{}" },
					},
					{
						find: '">200"',
						predicate: () => Pn.store.disableDiscoveryFilters,
						replacement: { match: '">200"', replace: '">0"' },
					},
					{
						find: '"horny","fart"',
						predicate: () => Pn.store.disableDisallowedDiscoveryFilters,
						replacement: { match: /=\["egirl",.+?\]/, replace: "=[]" },
					},
					{
						find: '"pepe","nude"',
						predicate: () => Pn.store.disableDisallowedDiscoveryFilters,
						replacement: { match: /(?<=[?=])\["pepe",.+?\]/, replace: "[]" },
					},
					{
						find: ".GUILD_DISCOVERY_VALID_TERM",
						predicate: () => Pn.store.disableDisallowedDiscoveryFilters,
						all: !0,
						replacement: {
							match:
								/\i\.\i\.get\(\{url:\i\.\i\.GUILD_DISCOVERY_VALID_TERM,query:\{term:\i\},oldFormErrors:!0\}\);/g,
							replace: "Promise.resolve({ body: { valid: true } });",
						},
					},
				],
				settings: Pn,
			});
		});
	var MC = g(() => {});
	var El,
		Km,
		IC = g(() => {
			"use strict";
			a();
			MC();
			F();
			re();
			P();
			T();
			(El = x({
				mode: {
					type: 4,
					description: "How to display usernames and nicks",
					options: [
						{
							label: "Username then nickname",
							value: "user-nick",
							default: !0,
						},
						{ label: "Nickname then username", value: "nick-user" },
						{ label: "Username only", value: "user" },
					],
				},
				displayNames: {
					type: 3,
					description: "Use display names in place of usernames",
					default: !1,
				},
				inReplies: {
					type: 3,
					default: !1,
					description: "Also apply functionality to reply previews",
				},
			})),
				(Km = h({
					name: "ShowMeYourName",
					description: "Display usernames next to nicks, or no nicks at all",
					authors: [d.Rini, d.TheKodeToad],
					patches: [
						{
							find: '?"@":"")',
							replacement: {
								match: /(?<=onContextMenu:\i,children:).*?\)}/,
								replace: "$self.renderUsername(arguments[0])}",
							},
						},
					],
					settings: El,
					renderUsername: R.wrap(
						({
							author: e,
							message: t,
							isRepliedMessage: o,
							withMentionPrefix: r,
							userOverride: i,
						}) => {
							try {
								let s = i ?? t.author,
									{ username: l } = s;
								El.store.displayNames && (l = s.globalName || l);
								let { nick: c } = e,
									u = r ? "@" : "";
								return (o && !El.store.inReplies) ||
									l.toLowerCase() === c.toLowerCase()
									? n(f, null, u, c)
									: El.store.mode === "user-nick"
										? n(
												f,
												null,
												u,
												l,
												" ",
												n("span", { className: "vc-smyn-suffix" }, c)
											)
										: El.store.mode === "nick-user"
											? n(
													f,
													null,
													u,
													c,
													" ",
													n("span", { className: "vc-smyn-suffix" }, l)
												)
											: n(f, null, u, l);
							} catch {
								return n(f, null, e?.nick);
							}
						},
						{ noop: !0 }
					),
				}));
		});
	var CC = g(() => {});
	function NC(e, t) {
		let o = oe.getChannel(e.channel_id)?.guild_id;
		if (!o) return null;
		let r = Le.getMember(o, e.author.id);
		if (!r?.communicationDisabledUntil) return null;
		let i = () =>
			n(S6, {
				deadline: new Date(r.communicationDisabledUntil),
				showUnits: !0,
				stopAtOneSec: !0,
			});
		return t
			? i()
			: Se.Messages.GUILD_ENABLE_COMMUNICATION_TIME_REMAINING.format({
					username: e.author.username,
					countdown: i,
				});
	}
	var S6,
		AC,
		Ym,
		RC = g(() => {
			"use strict";
			a();
			CC();
			F();
			re();
			P();
			T();
			U();
			b();
			(S6 = ae(".MAX_AGE_NEVER")),
				(AC = x({
					displayStyle: {
						description: "How to display the timeout duration",
						type: 4,
						options: [
							{ label: "In the Tooltip", value: "tooltip" },
							{
								label: "Next to the timeout icon",
								value: "ssalggnikool",
								default: !0,
							},
						],
					},
				}));
			Ym = h({
				name: "ShowTimeoutDuration",
				description:
					"Shows how much longer a user's timeout will last, either in the timeout icon tooltip or next to it",
				authors: [d.Ven, d.Sqaaakoi],
				settings: AC,
				patches: [
					{
						find: ".GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY",
						replacement: [
							{
								match:
									/(\i)\.Tooltip,{(text:.{0,30}\.Messages\.GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY)/,
								replace:
									"$self.TooltipWrapper,{message:arguments[0].message,$2",
							},
						],
					},
				],
				TooltipWrapper: R.wrap(
					({ message: e, children: t, text: o }) =>
						AC.store.displayStyle === "tooltip"
							? n(te, { children: t, text: NC(e, !1) })
							: n(
									"div",
									{ className: "vc-std-wrapper" },
									n(te, { text: o, children: t }),
									n(
										Z,
										{ variant: "text-md/normal", color: "status-danger" },
										NC(e, !0),
										" timeout remaining"
									)
								),
					{ noop: !0 }
				),
			});
		});
	var i0,
		s0,
		b6,
		Zm,
		kC = g(() => {
			"use strict";
			a();
			_r();
			Sn();
			F();
			P();
			T();
			b();
			(i0 = !1),
				(s0 = x({
					persistState: {
						type: 3,
						description:
							"Whether to persist the state of the silent message toggle when changing channels",
						default: !1,
						onChange(e) {
							e === !1 && (i0 = !1);
						},
					},
					autoDisable: {
						type: 3,
						description:
							"Automatically disable the silent message toggle again after sending one",
						default: !0,
					},
				})),
				(b6 = ({ isMainChat: e }) => {
					let [t, o] = z(i0);
					function r(i) {
						s0.store.persistState && (i0 = i), o(i);
					}
					return (
						ue(() => {
							let i = (s, l) => {
								t &&
									(s0.store.autoDisable && r(!1),
									l.content.startsWith("@silent ") ||
										(l.content = "@silent " + l.content));
							};
							return yo(i), () => void vo(i);
						}, [t]),
						e
							? n(
									ln,
									{
										tooltip: t
											? "Disable Silent Message"
											: "Enable Silent Message",
										onClick: () => r(!t),
									},
									n(
										"svg",
										{
											width: "24",
											height: "24",
											viewBox: "0 0 24 24",
											style: { scale: "1.2" },
										},
										n("path", {
											fill: "currentColor",
											mask: "url(#vc-silent-msg-mask)",
											d: "M18 10.7101C15.1085 9.84957 13 7.17102 13 4c0-.30736.0198-.6101.0582-.907C12.7147 3.03189 12.3611 3 12 3 8.686 3 6 5.686 6 9v5c0 1.657-1.344 3-3 3v1h18v-1c-1.656 0-3-1.343-3-3v-3.2899ZM8.55493 19c.693 1.19 1.96897 2 3.44497 2s2.752-.81 3.445-2H8.55493ZM18.2624 5.50209 21 2.5V1h-4.9651v1.49791h2.4411L16 5.61088V7h5V5.50209h-2.7376Z",
										}),
										!t &&
											n(
												f,
												null,
												n(
													"mask",
													{ id: "vc-silent-msg-mask" },
													n("path", { fill: "#fff", d: "M0 0h24v24H0Z" }),
													n("path", {
														stroke: "#000",
														"stroke-width": "5.99068",
														d: "M0 24 24 0",
													})
												),
												n("path", {
													fill: "var(--status-danger)",
													d: "m21.178 1.70703 1.414 1.414L4.12103 21.593l-1.414-1.415L21.178 1.70703Z",
												})
											)
									)
								)
							: null
					);
				}),
				(Zm = h({
					name: "SilentMessageToggle",
					authors: [d.Nuckyz, d.CatNoir],
					description:
						"Adds a button to the chat bar to toggle sending a silent message.",
					dependencies: ["MessageEventsAPI", "ChatInputButtonAPI"],
					settings: s0,
					start: () => sn("SilentMessageToggle", b6),
					stop: () => an("SilentMessageToggle"),
				}));
		});
	var cn,
		T6,
		x6,
		Qm,
		DC = g(() => {
			"use strict";
			a();
			_r();
			jo();
			ho();
			F();
			P();
			T();
			b();
			(cn = x({
				showIcon: {
					type: 3,
					default: !1,
					description: "Show an icon for toggling the plugin",
					restartNeeded: !0,
				},
				contextMenu: {
					type: 3,
					description:
						"Add option to toggle the functionality in the chat input context menu",
					default: !0,
				},
				isEnabled: {
					type: 3,
					description: "Toggle functionality",
					default: !0,
				},
			})),
				(T6 = ({ isMainChat: e }) => {
					let { isEnabled: t, showIcon: o } = cn.use(["isEnabled", "showIcon"]),
						r = () => (cn.store.isEnabled = !cn.store.isEnabled);
					return !e || !o
						? null
						: n(
								ln,
								{
									tooltip: t ? "Disable Silent Typing" : "Enable Silent Typing",
									onClick: r,
								},
								n(
									"svg",
									{
										width: "24",
										height: "24",
										xmlns: "http://www.w3.org/2000/svg",
										viewBox: "0 0 576 512",
									},
									n("path", {
										fill: "currentColor",
										d: "M528 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h480c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM128 180v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm288 0v-40c0-6.627-5.373-12-12-12H172c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h232c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12z",
									}),
									t &&
										n("path", {
											d: "M13 432L590 48",
											stroke: "var(--red-500)",
											"stroke-width": "72",
											"stroke-linecap": "round",
										})
								)
							);
				}),
				(x6 = (e) => {
					let { isEnabled: t, contextMenu: o } = cn.use([
						"isEnabled",
						"contextMenu",
					]);
					if (!o) return;
					let r = Ve("submit-button", e);
					if (!r) return;
					let i = r.findIndex((s) => s?.props?.id === "submit-button");
					r.splice(
						i + 1,
						0,
						n(E.MenuCheckboxItem, {
							id: "vc-silent-typing",
							label: "Enable Silent Typing",
							checked: t,
							action: () => (cn.store.isEnabled = !cn.store.isEnabled),
						})
					);
				}),
				(Qm = h({
					name: "SilentTyping",
					authors: [d.Ven, d.Rini, d.ImBanana],
					description: "Hide that you are typing",
					dependencies: ["CommandsAPI", "ChatInputButtonAPI"],
					settings: cn,
					contextMenus: { "textarea-context": x6 },
					patches: [
						{
							find: '.dispatch({type:"TYPING_START_LOCAL"',
							replacement: {
								match: /startTyping\(\i\){.+?},stop/,
								replace: "startTyping:$self.startTyping,stop",
							},
						},
					],
					commands: [
						{
							name: "silenttype",
							description:
								"Toggle whether you're hiding that you're typing or not.",
							inputType: 0,
							options: [
								{
									name: "value",
									description:
										"whether to hide or not that you're typing (default is toggle)",
									required: !1,
									type: 5,
								},
							],
							execute: async (e, t) => {
								(cn.store.isEnabled = !!qt(e, "value", !cn.store.isEnabled)),
									Je(t.channel.id, {
										content: cn.store.isEnabled
											? "Silent typing enabled!"
											: "Silent typing disabled!",
									});
							},
						},
					],
					async startTyping(e) {
						cn.store.isEnabled ||
							_.dispatch({ type: "TYPING_START_LOCAL", channelId: e });
					},
					start: () => sn("SilentTyping", T6),
					stop: () => an("SilentTyping"),
				}));
		});
	var LC,
		Xm,
		EC = g(() => {
			"use strict";
			a();
			F();
			kt();
			P();
			T();
			b();
			(LC = x({
				showDates: {
					type: 3,
					description: "Show dates on friend requests",
					default: !1,
					restartNeeded: !0,
				},
			})),
				(Xm = h({
					name: "SortFriendRequests",
					authors: [d.Megu],
					description: "Sorts friend requests by date of receipt",
					settings: LC,
					patches: [
						{
							find: "getRelationshipCounts(){",
							replacement: {
								match: /\}\)\.sortBy\((.+?)\)\.value\(\)/,
								replace: "}).sortBy(row => $self.wrapSort(($1), row)).value()",
							},
						},
						{
							find: ".Messages.FRIEND_REQUEST_CANCEL",
							replacement: {
								predicate: () => LC.store.showDates,
								match:
									/subText:(\i)(?=,className:\i\.userInfo}\))(?<=user:(\i).+?)/,
								replace: (e, t, o) => `subText:$self.makeSubtext(${t},${o})`,
							},
						},
					],
					wrapSort(e, t) {
						return t.type === 3 || t.type === 4 ? -this.getSince(t.user) : e(t);
					},
					getSince(e) {
						return new Date(Ie.getSince(e.id));
					},
					makeSubtext(e, t) {
						let o = this.getSince(t);
						return n(
							pe,
							{
								flexDirection: "row",
								style: { gap: 0, flexWrap: "wrap", lineHeight: "0.9rem" },
							},
							n("span", null, e),
							!isNaN(o.getTime()) &&
								n("span", null, "Received \u2014 ", o.toDateString())
						);
					},
				}));
		});
	var OC,
		FC = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set(
				"src/plugins/spotifyControls/hoverOnly.css",
				{
					name: "src/plugins/spotifyControls/hoverOnly.css",
					source: `.vc-spotify-button-row {
    height: 0;
    opacity: 0;
    pointer-events: none;
    transition: 0.2s;
    transition-property: height;
}

#vc-spotify-player:hover .vc-spotify-button-row {
    opacity: 1;
    height: 32px;
    pointer-events: auto;

    /* only transition opacity on show to prevent clipping */
    transition-property: height, opacity;
}
`,
					classNames: {},
					dom: null,
				}
			);
			OC = "src/plugins/spotifyControls/hoverOnly.css";
		});
	var _C = g(() => {});
	var w6,
		P6,
		nt,
		BC = g(() => {
			"use strict";
			a();
			U();
			b();
			a0();
			(w6 = C("getActiveSocketAndDevice")),
				(P6 = C("vcSpotifyMarker")),
				(nt = Nn(() => {
					let { Store: e } = oi,
						t = "https://api.spotify.com/v1/me/player";
					class o extends e {
						mPosition = 0;
						start = 0;
						track = null;
						device = null;
						isPlaying = !1;
						repeat = "off";
						shuffle = !1;
						volume = 0;
						isSettingPosition = !1;
						openExternal(s) {
							let l =
								Jm.store.useSpotifyUris ||
								Vencord.Plugins.isPluginEnabled("OpenInApp")
									? "spotify:" +
										s.replaceAll("/", (c, u) => (u === 0 ? "" : ":"))
									: "https://open.spotify.com" + s;
							VencordNative.native.openExternal(l);
						}
						get position() {
							let s = this.mPosition;
							return this.isPlaying && (s += Date.now() - this.start), s;
						}
						set position(s) {
							(this.mPosition = s), (this.start = Date.now());
						}
						prev() {
							this.req("post", "/previous");
						}
						next() {
							this.req("post", "/next");
						}
						setVolume(s) {
							this.req("put", "/volume", {
								query: { volume_percent: Math.round(s) },
							}).then(() => {
								(this.volume = s), this.emitChange();
							});
						}
						setPlaying(s) {
							this.req("put", s ? "/play" : "/pause");
						}
						setRepeat(s) {
							this.req("put", "/repeat", { query: { state: s } });
						}
						setShuffle(s) {
							this.req("put", "/shuffle", { query: { state: s } }).then(() => {
								(this.shuffle = s), this.emitChange();
							});
						}
						seek(s) {
							return this.isSettingPosition
								? Promise.resolve()
								: ((this.isSettingPosition = !0),
									this.req("put", "/seek", {
										query: { position_ms: Math.round(s) },
									}).catch((l) => {
										console.error("[VencordSpotifyControls] Failed to seek", l),
											(this.isSettingPosition = !1);
									}));
						}
						req(s, l, c = {}) {
							this.device?.is_active &&
								((c.query ??= {}).device_id = this.device.id);
							let { socket: u } = w6.getActiveSocketAndDevice();
							return P6[s](u.accountId, u.accessToken, { url: t + l, ...c });
						}
					}
					let r = new o(_, {
						SPOTIFY_PLAYER_STATE(i) {
							(r.track = i.track),
								(r.device = i.device ?? null),
								(r.isPlaying = i.isPlaying ?? !1),
								(r.volume = i.volumePercent ?? 0),
								(r.repeat = i.actual_repeat || "off"),
								(r.shuffle = i.shuffle ?? !1),
								(r.position = i.position ?? 0),
								(r.isSettingPosition = !1),
								r.emitChange();
						},
						SPOTIFY_SET_DEVICES({ devices: i }) {
							(r.device = i.find((s) => s.is_active) ?? i[0] ?? null),
								r.emitChange();
						},
					});
					return r;
				}));
		});
	function l0(e) {
		let t = e / 1e3 / 60,
			o = Math.floor(t),
			r = Math.floor((t - o) * 60);
		return `${o.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
	}
	function Fs(e, t) {
		return () =>
			n(
				"svg",
				{
					className: H(at("button-icon"), at(t)),
					height: "24",
					width: "24",
					viewBox: "0 0 24 24",
					fill: "currentColor",
					"aria-label": t,
					focusable: !1,
				},
				n("path", { d: e })
			);
	}
	function Ol(e) {
		return n("button", { className: at("button"), ...e }, e.children);
	}
	function k6({ name: e, path: t }) {
		let o = `spotify-copy-${e}`,
			r = `spotify-open-${e}`;
		return n(
			E.Menu,
			{
				navId: `spotify-${e}-menu`,
				onClose: () => _.dispatch({ type: "CONTEXT_MENU_CLOSE" }),
				"aria-label": `Spotify ${e} Menu`,
			},
			n(E.MenuItem, {
				key: o,
				id: o,
				label: `Copy ${e} Link`,
				action: () => Kt("https://open.spotify.com" + t),
				icon: hi,
			}),
			n(E.MenuItem, {
				key: r,
				id: r,
				label: `Open ${e} in Spotify`,
				action: () => nt.openExternal(t),
				icon: Fn,
			})
		);
	}
	function D6(e, t) {
		return (o) => Qt.openContextMenu(o, () => n(k6, { name: e, path: t }));
	}
	function L6() {
		let [e, t, o] = Oe([nt], () => [nt.isPlaying, nt.shuffle, nt.repeat]),
			[r, i] = (() => {
				switch (o) {
					case "off":
						return ["context", "repeat-off"];
					case "context":
						return ["track", "repeat-context"];
					case "track":
						return ["off", "repeat-track"];
					default:
						throw new Error(`Invalid repeat state ${o}`);
				}
			})();
		return n(
			pe,
			{ className: at("button-row"), style: { gap: 0 } },
			n(
				Ol,
				{
					className: H(at("button"), at(t ? "shuffle-on" : "shuffle-off")),
					onClick: () => nt.setShuffle(!t),
				},
				n(R6, null)
			),
			n(Ol, { onClick: () => nt.prev() }, n(C6, null)),
			n(
				Ol,
				{ onClick: () => nt.setPlaying(!e) },
				e ? n(I6, null) : n(M6, null)
			),
			n(Ol, { onClick: () => nt.next() }, n(A6, null)),
			n(
				Ol,
				{
					className: H(at("button"), at(i)),
					onClick: () => nt.setRepeat(r),
					style: { position: "relative" },
				},
				o === "track" && n("span", { className: at("repeat-1") }, "1"),
				n(N6, null)
			)
		);
	}
	function O6() {
		let { duration: e } = nt.track,
			[t, o, r] = Oe([nt], () => [
				nt.mPosition,
				nt.isSettingPosition,
				nt.isPlaying,
			]),
			[i, s] = z(t);
		return (
			ue(() => {
				if (r && !o) {
					s(nt.position);
					let l = setInterval(() => {
						s((c) => c + 1e3);
					}, 1e3);
					return () => clearInterval(l);
				}
			}, [t, o, r]),
			n(
				"div",
				{ id: at("progress-bar") },
				n(
					S.FormText,
					{
						variant: "text-xs/medium",
						className: at("progress-time") + " " + at("time-left"),
						"aria-label": "Progress",
					},
					l0(i)
				),
				n(E.MenuSliderControl, {
					minValue: 0,
					maxValue: e,
					value: i,
					onChange: (l) => {
						o || (s(l), E6(l));
					},
					renderValue: l0,
				}),
				n(
					S.FormText,
					{
						variant: "text-xs/medium",
						className: at("progress-time") + " " + at("time-right"),
						"aria-label": "Total Duration",
					},
					l0(e)
				)
			)
		);
	}
	function F6({ track: e }) {
		let t = Oe([nt], () => nt.volume);
		return n(
			E.Menu,
			{
				navId: "spotify-album-menu",
				onClose: () => _.dispatch({ type: "CONTEXT_MENU_CLOSE" }),
				"aria-label": "Spotify Album Menu",
			},
			n(E.MenuItem, {
				key: "open-album",
				id: "open-album",
				label: "Open Album",
				action: () => nt.openExternal(`/album/${e.album.id}`),
				icon: Fn,
			}),
			n(E.MenuItem, {
				key: "view-cover",
				id: "view-cover",
				label: "View Album Cover",
				action: () => Lo(e.album.image.url),
				icon: tn,
			}),
			n(E.MenuControlItem, {
				id: "spotify-volume",
				key: "spotify-volume",
				label: "Volume",
				control: (o, r) =>
					n(E.MenuSliderControl, {
						...o,
						ref: r,
						value: t,
						minValue: 0,
						maxValue: 100,
						onChange: $t((i) => nt.setVolume(i)),
					}),
			})
		);
	}
	function c0(e, t, o) {
		return t
			? {
					role: "link",
					onClick: () => nt.openExternal(o),
					onContextMenu: D6(e, o),
				}
			: {};
	}
	function _6({ track: e }) {
		let t = e?.album?.image,
			[o, r] = z(!1),
			i = n(
				f,
				null,
				t &&
					n("img", {
						id: at("album-image"),
						src: t.url,
						alt: "Album Image",
						onClick: () => r(!o),
						onContextMenu: (s) => {
							Qt.openContextMenu(s, () => n(F6, { track: e }));
						},
					})
			);
		return o && t
			? n("div", { id: at("album-expanded-wrapper") }, i)
			: n(
					"div",
					{ id: at("info-wrapper") },
					i,
					n(
						"div",
						{ id: at("titles") },
						n(
							S.FormText,
							{
								variant: "text-sm/semibold",
								id: at("song-title"),
								className: at("ellipoverflow"),
								title: e.name,
								...c0("Song", e.id, `/track/${e.id}`),
							},
							e.name
						),
						e.artists.some((s) => s.name) &&
							n(
								S.FormText,
								{ variant: "text-sm/normal", className: at("ellipoverflow") },
								"by\xA0",
								e.artists.map((s, l) =>
									n(
										q.Fragment,
										{ key: s.name },
										n(
											"span",
											{
												className: at("artist"),
												style: { fontSize: "inherit" },
												title: s.name,
												...c0("Artist", s.id, `/artist/${s.id}`),
											},
											s.name
										),
										l !== e.artists.length - 1 &&
											n("span", { className: at("comma") }, ", ")
									)
								)
							),
						e.album.name &&
							n(
								S.FormText,
								{ variant: "text-sm/normal", className: at("ellipoverflow") },
								"on\xA0",
								n(
									"span",
									{
										id: at("album-title"),
										className: at("album"),
										style: { fontSize: "inherit" },
										title: e.album.name,
										...c0("Album", e.album.id, `/album/${e.album.id}`),
									},
									e.album.name
								)
							)
					)
				);
	}
	function UC() {
		let e = Oe(
				[nt],
				() => nt.track,
				null,
				(l, c) => (l?.id ? l.id === c?.id : l?.name === c?.name)
			),
			t = Oe(
				[nt],
				() => nt.device,
				null,
				(l, c) => l?.id === c?.id
			),
			o = Oe([nt], () => nt.isPlaying),
			[r, i] = z(!1);
		if (
			(q.useEffect(() => {
				if ((i(!1), !o)) {
					let l = setTimeout(() => i(!0), 3e5);
					return () => clearTimeout(l);
				}
			}, [o]),
			!e || !t?.is_active || r)
		)
			return null;
		let s = {
			"--vc-spotify-track-image": `url(${e?.album?.image?.url || ""})`,
		};
		return n(
			"div",
			{ id: at("player"), style: s },
			n(_6, { track: e }),
			n(O6, null),
			n(L6, null)
		);
	}
	var at,
		M6,
		I6,
		C6,
		A6,
		N6,
		R6,
		E6,
		$C = g(() => {
			"use strict";
			a();
			_C();
			kt();
			yt();
			fr();
			it();
			me();
			b();
			BC();
			at = (e) => `vc-spotify-${e}`;
			(M6 = Fs(
				"M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z",
				"play"
			)),
				(I6 = Fs(
					"M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z",
					"pause"
				)),
				(C6 = Fs(
					"M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z",
					"previous"
				)),
				(A6 = Fs(
					"M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z",
					"next"
				)),
				(N6 = Fs(
					"M7 7h10v1.79c0 .45.54.67.85.35l2.79-2.79c.2-.2.2-.51 0-.71l-2.79-2.79c-.31-.31-.85-.09-.85.36V5H6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1V7zm10 10H7v-1.79c0-.45-.54-.67-.85-.35l-2.79 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.31.31.85.09.85-.36V19h11c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1s-1 .45-1 1v3z",
					"repeat"
				)),
				(R6 = Fs(
					"M10.59 9.17L6.12 4.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.46 4.46 1.42-1.4zm4.76-4.32l1.19 1.19L4.7 17.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L17.96 7.46l1.19 1.19c.31.31.85.09.85-.36V4.5c0-.28-.22-.5-.5-.5h-3.79c-.45 0-.67.54-.36.85zm-.52 8.56l-1.41 1.41 3.13 3.13-1.2 1.2c-.31.31-.09.85.36.85h3.79c.28 0 .5-.22.5-.5v-3.79c0-.45-.54-.67-.85-.35l-1.19 1.19-3.13-3.14z",
					"shuffle"
				));
			E6 = $t((e) => {
				nt.seek(e);
			});
		});
	function GC(e) {
		(e ? fo : _o)(OC);
	}
	var Jm,
		Vm,
		a0 = g(() => {
			"use strict";
			a();
			F();
			tt();
			re();
			P();
			T();
			FC();
			$C();
			(Jm = x({
				hoverControls: {
					description: "Show controls on hover",
					type: 3,
					default: !1,
					onChange: (e) => GC(e),
				},
				useSpotifyUris: {
					type: 3,
					description:
						"Open Spotify URIs instead of Spotify URLs. Will only work if you have Spotify installed and might not work on all platforms",
					default: !1,
				},
			})),
				(Vm = h({
					name: "SpotifyControls",
					description: "Adds a Spotify player above the account panel",
					authors: [d.Ven, d.afn, d.KraXen72, d.Av32000],
					settings: Jm,
					patches: [
						{
							find: "this.isCopiedStreakGodlike",
							replacement: {
								match:
									/(?<=\i\.jsxs?\)\()(\i),{(?=[^}]*?userTag:\i,hidePrivateData:)/,
								replace: "$self.PanelWrapper,{VencordOriginal:$1,",
							},
						},
						{
							find: ".PLAYER_DEVICES",
							replacement: [
								{
									match: /get:(\i)\.bind\(null,(\i\.\i)\.get\)/,
									replace: "post:$1.bind(null,$2.post),vcSpotifyMarker:1,$&",
								},
								{ match: /202===\i\.status/, replace: "false" },
							],
						},
						{
							find: 'repeat:"off"!==',
							replacement: [
								{
									match: /repeat:"off"!==(\i),/,
									replace:
										"shuffle:arguments[2]?.shuffle_state??false,actual_repeat:$1,$&",
								},
								{
									match: /(?<=artists.filter\(\i=>).{0,10}\i\.id\)&&/,
									replace: "",
								},
							],
						},
					],
					start: () => GC(Jm.store.hoverControls),
					PanelWrapper({ VencordOriginal: e, ...t }) {
						return n(
							f,
							null,
							n(
								R,
								{
									fallback: () =>
										n(
											"div",
											{ className: "vc-spotify-fallback" },
											n("p", null, "Failed to render Spotify Modal :("),
											n("p", null, "Check the console for errors")
										),
								},
								n(UC, null)
							),
							n(e, { ...t })
						);
					},
				}));
		});
	var u0,
		ef,
		HC = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			(u0 = x({
				noSpotifyAutoPause: {
					description: "Disable Spotify auto-pause",
					type: 3,
					default: !0,
					restartNeeded: !0,
				},
				keepSpotifyActivityOnIdle: {
					description: "Keep Spotify activity playing when idling",
					type: 3,
					default: !1,
					restartNeeded: !0,
				},
			})),
				(ef = h({
					name: "SpotifyCrack",
					description:
						"Free listen along, no auto-pausing in voice chat, and allows activity to continue playing when idling",
					authors: [d.Cyn, d.Nuckyz],
					settings: u0,
					patches: [
						{
							find: 'dispatch({type:"SPOTIFY_PROFILE_UPDATE"',
							replacement: {
								match:
									/SPOTIFY_PROFILE_UPDATE.+?isPremium:(?="premium"===(\i)\.body\.product)/,
								replace: (e, t) => `${e}(${t}.body.product="premium")&&`,
							},
						},
						{
							find: '"displayName","SpotifyStore")',
							replacement: [
								{
									predicate: () => u0.store.noSpotifyAutoPause,
									match:
										/(?<=function \i\(\){)(?=.{0,200}SPOTIFY_AUTO_PAUSED\))/,
									replace: "return;",
								},
								{
									predicate: () => u0.store.keepSpotifyActivityOnIdle,
									match:
										/(shouldShowActivity\(\){.{0,50})&&!\i\.\i\.isIdle\(\)/,
									replace: "$1",
								},
							],
						},
					],
				}));
		});
	function d0(e, t) {
		t = { invalidEmojis: [], tts: !1, validNonShortcutEmojis: [], ...t };
		let o = B6.getPendingReply(e);
		Mo.sendMessage(e, t, void 0, Mo.getSendMessageOptionsForReply(o)).then(
			() => {
				o && _.dispatch({ type: "DELETE_PENDING_REPLY", channelId: e });
			}
		);
	}
	var p0,
		B6,
		tf,
		zC = g(() => {
			"use strict";
			a();
			jo();
			P();
			T();
			U();
			b();
			(p0 = K("SpotifyStore")), (B6 = K("PendingReplyStore"));
			tf = h({
				name: "SpotifyShareCommands",
				description:
					"Share your current Spotify track, album or artist via slash command (/track, /album, /artist)",
				authors: [d.katlyn],
				dependencies: ["CommandsAPI"],
				commands: [
					{
						name: "track",
						description: "Send your current Spotify track to chat",
						inputType: 0,
						options: [],
						execute: (e, t) => {
							let o = p0.getTrack();
							if (o === null) {
								Je(t.channel.id, {
									content: "You're not listening to any music.",
								});
								return;
							}
							d0(t.channel.id, {
								content: `https://open.spotify.com/track/${o.id}`,
							});
						},
					},
					{
						name: "album",
						description: "Send your current Spotify album to chat",
						inputType: 0,
						options: [],
						execute: (e, t) => {
							let o = p0.getTrack();
							if (o === null) {
								Je(t.channel.id, {
									content: "You're not listening to any music.",
								});
								return;
							}
							d0(t.channel.id, {
								content: `https://open.spotify.com/album/${o.album.id}`,
							});
						},
					},
					{
						name: "artist",
						description: "Send your current Spotify artist to chat",
						inputType: 0,
						options: [],
						execute: (e, t) => {
							let o = p0.getTrack();
							if (o === null) {
								Je(t.channel.id, {
									content: "You're not listening to any music.",
								});
								return;
							}
							d0(t.channel.id, { content: o.artists[0].external_urls.spotify });
						},
					},
				],
			});
		});
	function U6({ emoji: e, prefix: t, log: o, delta: r, instance: i }) {
		return n(
			q.Fragment,
			null,
			n("span", null, i.sinceStart.toFixed(3), "s"),
			n("span", null, i.sinceLast.toFixed(3), "s"),
			n("span", null, r?.toFixed(0) ?? ""),
			n("span", null, n("pre", null, e, " ", t ?? " ", o))
		);
	}
	function $6({ title: e, logs: t, traceEnd: o }) {
		let r = t.find((l) => l.timestamp)?.timestamp ?? 0,
			i = r,
			s = t.map((l) => {
				let c = l.timestamp ?? i,
					u = (c - r) / 1e3,
					p = (c - i) / 1e3;
				return (i = c), { sinceStart: u, sinceLast: p };
			});
		return n(
			S.FormSection,
			{ title: e, tag: "h1" },
			n(
				"code",
				null,
				o &&
					n(
						"div",
						{
							style: {
								color: "var(--header-primary)",
								marginBottom: 5,
								userSelect: "text",
							},
						},
						"Trace ended at: ",
						new Date(o).toTimeString()
					),
				n(
					"div",
					{
						style: {
							color: "var(--header-primary)",
							display: "grid",
							gridTemplateColumns: "repeat(3, auto) 1fr",
							gap: "2px 10px",
							userSelect: "text",
						},
					},
					n("span", null, "Start"),
					n("span", null, "Interval"),
					n("span", null, "Delta"),
					n("span", { style: { marginBottom: 5 } }, "Event"),
					Fl.logs.map((l, c) => n(U6, { key: c, ...l, instance: s[c] }))
				)
			)
		);
	}
	function G6({ trace: e }) {
		let t = e.split(`
`);
		return n(
			S.FormSection,
			{ title: "Server Trace", tag: "h2" },
			n(
				"code",
				null,
				n(
					pe,
					{
						flexDirection: "column",
						style: {
							color: "var(--header-primary)",
							gap: 5,
							userSelect: "text",
						},
					},
					t.map((o) => n("span", null, o))
				)
			)
		);
	}
	function H6() {
		if (!Fl?.logs) return n("div", null, "Loading...");
		let e = Fl.logGroups.find((t) => t.serverTrace)?.serverTrace;
		return n(
			q.Fragment,
			null,
			n($6, { title: "Startup Timings", logs: Fl.logs, traceEnd: Fl.endTime_ }),
			n("div", { style: { marginTop: 5 } }, "\xA0"),
			e && n(G6, { trace: e })
		);
	}
	var Fl,
		WC,
		jC = g(() => {
			"use strict";
			a();
			re();
			kt();
			U();
			b();
			Fl = C("markWithDelta", "markAndLog", "markAt");
			WC = R.wrap(H6);
		});
	var of,
		qC = g(() => {
			"use strict";
			a();
			P();
			T();
			jC();
			of = h({
				name: "StartupTimings",
				description: "Adds Startup Timings to the Settings menu",
				authors: [d.Megu],
				patches: [
					{
						find: "Messages.ACTIVITY_SETTINGS",
						replacement: {
							match:
								/(?<=}\)([,;])(\i\.settings)\.forEach.+?(\i)\.push.+}\)}\))/,
							replace: (e, t, o, r) =>
								`${t}${o}?.[0]==="CHANGELOG"&&${r}.push({section:"StartupTimings",label:"Startup Timings",element:$self.StartupTimingPage})`,
						},
					},
				],
				StartupTimingPage: WC,
			});
		});
	function KC({ streamKey: e }, t) {
		!e.endsWith(D.getCurrentUser().id) ||
			_.dispatch({ type: "STREAMER_MODE_UPDATE", key: "enabled", value: t });
	}
	var nf,
		YC = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			nf = h({
				name: "StreamerModeOnStream",
				description:
					"Automatically enables streamer mode when you start streaming in Discord",
				authors: [d.Kodarru],
				flux: {
					STREAM_CREATE: (e) => KC(e, !0),
					STREAM_DELETE: (e) => KC(e, !1),
				},
			});
		});
	var rf,
		sf,
		ZC = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			b();
			(rf = x(
				{
					superReactByDefault: {
						type: 3,
						description: "Reaction picker will default to Super Reactions",
						default: !0,
					},
					unlimitedSuperReactionPlaying: {
						type: 3,
						description: "Remove the limit on Super Reactions playing at once",
						default: !1,
					},
					superReactionPlayingLimit: {
						description: "Max Super Reactions to play at once",
						type: 5,
						default: 20,
						markers: [5, 10, 20, 40, 60, 80, 100],
						stickToMarkers: !0,
					},
				},
				{
					superReactionPlayingLimit: {
						disabled() {
							return this.store.unlimitedSuperReactionPlaying;
						},
					},
				}
			)),
				(sf = h({
					name: "SuperReactionTweaks",
					description:
						"Customize the limit of Super Reactions playing at once, and super react by default",
					authors: [d.FieryFlames, d.ant0n],
					patches: [
						{
							find: ",BURST_REACTION_EFFECT_PLAY",
							replacement: {
								match:
									/(BURST_REACTION_EFFECT_PLAY:\i=>{.{50,100})(\i\(\i,\i\))>=\d+/,
								replace: "$1!$self.shouldPlayBurstReaction($2)",
							},
						},
						{
							find: ".EMOJI_PICKER_CONSTANTS_EMOJI_CONTAINER_PADDING_HORIZONTAL)",
							replacement: {
								match:
									/(openPopoutType:void 0(?=.+?isBurstReaction:(\i).+?(\i===\i\.\i.REACTION)).+?\[\2,\i\]=\i\.useState\().+?\)/,
								replace: (e, t, o, r) =>
									`${t}$self.shouldSuperReactByDefault&&${r})`,
							},
						},
					],
					settings: rf,
					shouldPlayBurstReaction(e) {
						return !!(
							rf.store.unlimitedSuperReactionPlaying ||
							e <= rf.store.superReactionPlayingLimit
						);
					},
					get shouldSuperReactByDefault() {
						return (
							rf.store.superReactByDefault &&
							D.getCurrentUser().premiumType != null
						);
					},
				}));
		});
	function eA(e) {
		let t = e.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/);
		return t
			? new RegExp(
					t[2],
					t[3]
						?.split("")
						.filter((o, r, i) => i.indexOf(o) === r)
						.join("") ?? "g"
				)
			: new RegExp(e);
	}
	function W6(e) {
		try {
			return eA(e), null;
		} catch (t) {
			return n("span", { style: { color: "var(--text-danger)" } }, String(t));
		}
	}
	function m0({ initialValue: e, onChange: t, placeholder: o }) {
		let [r, i] = z(e);
		return n(mt, {
			placeholder: o,
			value: r,
			onChange: i,
			spellCheck: !1,
			onBlur: () => r !== e && t(r),
		});
	}
	function QC({ title: e, rulesArray: t, rulesKey: o, update: r }) {
		let i = e === "Using Regex";
		async function s(c) {
			c !== t.length - 1 && (t.splice(c, 1), await gt.set(o, t), r());
		}
		async function l(c, u, p) {
			u === t.length - 1 && t.push(VC()),
				(t[u][p] = c),
				t[u].find === "" &&
					t[u].replace === "" &&
					t[u].onlyIfIncludes === "" &&
					u !== t.length - 1 &&
					t.splice(u, 1),
				await gt.set(o, t),
				r();
		}
		return n(
			f,
			null,
			n(S.FormTitle, { tag: "h4" }, e),
			n(
				pe,
				{ flexDirection: "column", style: { gap: "0.5em" } },
				t.map((c, u) =>
					n(
						q.Fragment,
						{ key: `${c.find}-${u}` },
						n(
							pe,
							{ flexDirection: "row", style: { gap: 0 } },
							n(
								pe,
								{ flexDirection: "row", style: { flexGrow: 1, gap: "0.5em" } },
								n(m0, {
									placeholder: "Find",
									initialValue: c.find,
									onChange: (p) => l(p, u, "find"),
								}),
								n(m0, {
									placeholder: "Replace",
									initialValue: c.replace,
									onChange: (p) => l(p, u, "replace"),
								}),
								n(m0, {
									placeholder: "Only if includes",
									initialValue: c.onlyIfIncludes,
									onChange: (p) => l(p, u, "onlyIfIncludes"),
								})
							),
							n(
								M,
								{
									size: M.Sizes.MIN,
									onClick: () => s(u),
									style: {
										background: "none",
										color: "var(--status-danger)",
										...(u === t.length - 1
											? { visibility: "hidden", pointerEvents: "none" }
											: {}),
									},
								},
								n(_n, null)
							)
						),
						i && W6(c.find)
					)
				)
			)
		);
	}
	function j6() {
		let [e, t] = z("");
		return n(
			f,
			null,
			n(S.FormTitle, { tag: "h4" }, "Test Rules"),
			n(mt, { placeholder: "Type a message", onChange: t }),
			n(mt, {
				placeholder: "Message with rules applied",
				editable: !1,
				value: tA(e),
			})
		);
	}
	function tA(e) {
		if (e.length === 0) return e;
		if (lf)
			for (let t of lf)
				!t.find ||
					(t.onlyIfIncludes && !e.includes(t.onlyIfIncludes)) ||
					(e = ` ${e} `
						.replaceAll(
							t.find,
							t.replace.replaceAll(
								"\\n",
								`
`
							)
						)
						.replace(/^\s|\s$/g, ""));
		if (cf) {
			for (let t of cf)
				if (!!t.find && !(t.onlyIfIncludes && !e.includes(t.onlyIfIncludes)))
					try {
						let o = eA(t.find);
						e = e.replace(
							o,
							t.replace.replaceAll(
								"\\n",
								`
`
							)
						);
					} catch {
						new V("TextReplace").error(`Invalid regex: ${t.find}`);
					}
		}
		return (e = e.trim()), e;
	}
	var XC,
		JC,
		VC,
		af,
		lf,
		cf,
		z6,
		q6,
		uf,
		oA = g(() => {
			"use strict";
			a();
			qn();
			Sn();
			F();
			kt();
			yt();
			P();
			De();
			ct();
			T();
			b();
			(XC = "TextReplace_rulesString"),
				(JC = "TextReplace_rulesRegex"),
				(VC = () => ({ find: "", replace: "", onlyIfIncludes: "" })),
				(af = () => [VC()]),
				(lf = af()),
				(cf = af()),
				(z6 = x({
					replace: {
						type: 6,
						description: "",
						component: () => {
							let e = Wo();
							return n(
								f,
								null,
								n(QC, {
									title: "Using String",
									rulesArray: lf,
									rulesKey: XC,
									update: e,
								}),
								n(QC, {
									title: "Using Regex",
									rulesArray: cf,
									rulesKey: JC,
									update: e,
								}),
								n(j6, null)
							);
						},
					},
				}));
			(q6 = "1102784112584040479"),
				(uf = h({
					name: "TextReplace",
					description:
						"Replace text in your messages. You can find pre-made rules in the #textreplace-rules channel in Vencord's Server",
					authors: [d.AutumnVN, d.TheKodeToad],
					dependencies: ["MessageEventsAPI"],
					settings: z6,
					async start() {
						(lf = (await gt.get(XC)) ?? af()),
							(cf = (await gt.get(JC)) ?? af()),
							(this.preSend = yo((e, t) => {
								e !== q6 && (t.content = tA(t.content));
							}));
					},
					stop() {
						vo(this.preSend);
					},
				}));
		});
	var pf,
		nA = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			pf = h({
				name: "ThemeAttributes",
				description:
					"Adds data attributes to various elements for theming purposes",
				authors: [d.Ven, d.Board],
				patches: [
					{
						find: ".tabBarRef",
						replacement: {
							match: /style:this\.getStyle\(\),role:"tab"/,
							replace: "$&,'data-tab-id':this.props.id",
						},
					},
					{
						find: ".messageListItem",
						replacement: {
							match: /\.messageListItem(?=,"aria)/,
							replace: "$&,...$self.getMessageProps(arguments[0])",
						},
					},
					{
						find: ".LABEL_WITH_ONLINE_STATUS",
						replacement: {
							match: /src:null!=\i\?(\i).{1,50}"aria-hidden":!0/,
							replace: "$&,style:$self.getAvatarStyles($1)",
						},
					},
					{
						find: "showCommunicationDisabledStyles",
						replacement: {
							match: /src:(\i),"aria-hidden":!0/,
							replace: "$&,style:$self.getAvatarStyles($1)",
						},
					},
				],
				getAvatarStyles(e) {
					return Object.fromEntries(
						[128, 256, 512, 1024, 2048, 4096].map((t) => [
							`--avatar-url-${t}`,
							`url(${e.replace(/\d+$/, String(t))})`,
						])
					);
				},
				getMessageProps(e) {
					let t = e.message?.author,
						o = t?.id;
					return {
						"data-author-id": o,
						"data-author-username": t?.username,
						"data-is-self": o && o === D.getCurrentUser()?.id,
					};
				},
			});
		});
	var df,
		rA = g(() => {
			"use strict";
			a();
			P();
			T();
			df = h({
				name: "TimeBarAllActivities",
				description:
					"Adds the Spotify time bar to all activities if they have start and end timestamps",
				authors: [d.fawn],
				patches: [
					{
						find: "}renderTimeBar(",
						replacement: {
							match: /renderTimeBar\((.{1,3})\){.{0,50}?let/,
							replace: "renderTimeBar($1){let",
						},
					},
				],
			});
		});
	var iA = g(() => {});
	function sA() {
		(vt.store.receivedInput = "auto"),
			(vt.store.receivedOutput = "en"),
			(vt.store.sentInput = "auto"),
			(vt.store.sentOutput = "en");
	}
	var vt,
		_l = g(() => {
			"use strict";
			a();
			F();
			T();
			vt = x({
				receivedInput: {
					type: 0,
					description:
						"Language that received messages should be translated from",
					default: "auto",
					hidden: !0,
				},
				receivedOutput: {
					type: 0,
					description:
						"Language that received messages should be translated to",
					default: "en",
					hidden: !0,
				},
				sentInput: {
					type: 0,
					description:
						"Language that your own messages should be translated from",
					default: "auto",
					hidden: !0,
				},
				sentOutput: {
					type: 0,
					description:
						"Language that your own messages should be translated to",
					default: "en",
					hidden: !0,
				},
				showChatBarButton: {
					type: 3,
					description: "Show translate button in chat bar",
					default: !0,
				},
				service: {
					type: 4,
					description: "Translation service (Not supported on Web!)",
					disabled: () => !0,
					options: [
						{ label: "Google Translate", value: "google", default: !0 },
						{ label: "DeepL Free", value: "deepl" },
						{ label: "DeepL Pro", value: "deepl-pro" },
					],
					onChange: sA,
				},
				deeplApiKey: {
					type: 0,
					description: "DeepL API key",
					default: "",
					placeholder: "Get your API key from https://deepl.com/your-account",
					disabled: () => !0,
				},
				autoTranslate: {
					type: 3,
					description:
						"Automatically translate your messages before sending. You can also shift/right click the translate button to toggle this",
					default: !1,
				},
				showAutoTranslateTooltip: {
					type: 3,
					description:
						"Show a tooltip on the ChatBar button whenever a message is automatically translated",
					default: !0,
				},
			}).withPrivateSettings();
		});
	var f0,
		aA = g(() => {
			"use strict";
			a();
			f0 = {
				auto: "Detect language",
				af: "Afrikaans",
				sq: "Albanian",
				am: "Amharic",
				ar: "Arabic",
				hy: "Armenian",
				as: "Assamese",
				ay: "Aymara",
				az: "Azerbaijani",
				bm: "Bambara",
				eu: "Basque",
				be: "Belarusian",
				bn: "Bengali",
				bho: "Bhojpuri",
				bs: "Bosnian",
				bg: "Bulgarian",
				ca: "Catalan",
				ceb: "Cebuano",
				ny: "Chichewa",
				"zh-CN": "Chinese (Simplified)",
				"zh-TW": "Chinese (Traditional)",
				co: "Corsican",
				hr: "Croatian",
				cs: "Czech",
				da: "Danish",
				dv: "Dhivehi",
				doi: "Dogri",
				nl: "Dutch",
				en: "English",
				eo: "Esperanto",
				et: "Estonian",
				ee: "Ewe",
				tl: "Filipino",
				fi: "Finnish",
				fr: "French",
				fy: "Frisian",
				gl: "Galician",
				ka: "Georgian",
				de: "German",
				el: "Greek",
				gn: "Guarani",
				gu: "Gujarati",
				ht: "Haitian Creole",
				ha: "Hausa",
				haw: "Hawaiian",
				iw: "Hebrew",
				hi: "Hindi",
				hmn: "Hmong",
				hu: "Hungarian",
				is: "Icelandic",
				ig: "Igbo",
				ilo: "Ilocano",
				id: "Indonesian",
				ga: "Irish",
				it: "Italian",
				ja: "Japanese",
				jw: "Javanese",
				kn: "Kannada",
				kk: "Kazakh",
				km: "Khmer",
				rw: "Kinyarwanda",
				gom: "Konkani",
				ko: "Korean",
				kri: "Krio",
				ku: "Kurdish (Kurmanji)",
				ckb: "Kurdish (Sorani)",
				ky: "Kyrgyz",
				lo: "Lao",
				la: "Latin",
				lv: "Latvian",
				ln: "Lingala",
				lt: "Lithuanian",
				lg: "Luganda",
				lb: "Luxembourgish",
				mk: "Macedonian",
				mai: "Maithili",
				mg: "Malagasy",
				ms: "Malay",
				ml: "Malayalam",
				mt: "Maltese",
				mi: "Maori",
				mr: "Marathi",
				"mni-Mtei": "Meiteilon (Manipuri)",
				lus: "Mizo",
				mn: "Mongolian",
				my: "Myanmar (Burmese)",
				ne: "Nepali",
				no: "Norwegian",
				or: "Odia (Oriya)",
				om: "Oromo",
				ps: "Pashto",
				fa: "Persian",
				pl: "Polish",
				pt: "Portuguese",
				pa: "Punjabi",
				qu: "Quechua",
				ro: "Romanian",
				ru: "Russian",
				sm: "Samoan",
				sa: "Sanskrit",
				gd: "Scots Gaelic",
				nso: "Sepedi",
				sr: "Serbian",
				st: "Sesotho",
				sn: "Shona",
				sd: "Sindhi",
				si: "Sinhala",
				sk: "Slovak",
				sl: "Slovenian",
				so: "Somali",
				es: "Spanish",
				su: "Sundanese",
				sw: "Swahili",
				sv: "Swedish",
				tg: "Tajik",
				ta: "Tamil",
				tt: "Tatar",
				te: "Telugu",
				th: "Thai",
				ti: "Tigrinya",
				ts: "Tsonga",
				tr: "Turkish",
				tk: "Turkmen",
				ak: "Twi",
				uk: "Ukrainian",
				ur: "Urdu",
				ug: "Uyghur",
				uz: "Uzbek",
				vi: "Vietnamese",
				cy: "Welsh",
				xh: "Xhosa",
				yi: "Yiddish",
				yo: "Yoruba",
				zu: "Zulu",
			};
		});
	async function Bl(e, t) {
		let o = K6;
		try {
			return await o(t, vt.store[`${e}Input`], vt.store[`${e}Output`]);
		} catch (r) {
			let i =
				typeof r == "string"
					? r
					: "Something went wrong. If this issue persists, please check the console or ask for help in the support server.";
			throw (ft(i, X.Type.FAILURE), r instanceof Error ? r : new Error(i));
		}
	}
	async function K6(e, t, o) {
		let r =
				"https://translate.googleapis.com/translate_a/single?" +
				new URLSearchParams({
					client: "gtx",
					sl: t,
					tl: o,
					dt: "t",
					dj: "1",
					source: "input",
					q: e,
				}),
			i = await fetch(r);
		if (!i.ok)
			throw new Error(`Failed to translate "${e}" (${t} -> ${o})
${i.status} ${i.statusText}`);
		let { src: s, sentences: l } = await i.json();
		return {
			sourceLanguage: f0[s] ?? s,
			text: l
				.map((c) => c?.trans)
				.filter(Boolean)
				.join(""),
		};
	}
	var lr,
		qve,
		lA,
		Kve,
		Ul = g(() => {
			"use strict";
			a();
			tt();
			ma();
			b();
			aA();
			_l();
			(lr = be("vc-trans-")),
				(qve = VencordNative.pluginHelpers.Translate),
				(lA = () => f0);
			Kve = pi(() =>
				ft(
					"Deepl API quota exceeded. Falling back to Google Translate",
					X.Type.FAILURE
				)
			);
		});
	function Z6({ settingsKey: e, includeAuto: t }) {
		let o = vt.use([e])[e],
			r = dt(() => {
				let i = Object.entries(lA()).map(([s, l]) => ({ value: s, label: l }));
				return t || i.shift(), i;
			}, []);
		return n(
			"section",
			{ className: G.bottom16 },
			n(S.FormTitle, { tag: "h3" }, vt.def[e].description),
			n(nc, {
				options: r,
				value: r.find((i) => i.value === o),
				placeholder: "Select a language",
				maxVisibleItems: 5,
				closeOnSelect: !0,
				onChange: (i) => (vt.store[e] = i),
			})
		);
	}
	function Q6() {
		let e = vt.use(["autoTranslate"]).autoTranslate;
		return n(
			Vt,
			{
				value: e,
				onChange: (t) => (vt.store.autoTranslate = t),
				note: vt.def.autoTranslate.description,
				hideBorder: !0,
			},
			"Auto Translate"
		);
	}
	function cA({ rootProps: e }) {
		return n(
			Te,
			{ ...e },
			n(
				Ee,
				{ className: lr("modal-header") },
				n(S.FormTitle, { tag: "h2" }, "Translate"),
				n(rt, { onClick: e.onClose })
			),
			n(
				Ae,
				{ className: lr("modal-content") },
				Y6.map((t) =>
					n(Z6, { key: t, settingsKey: t, includeAuto: t.endsWith("Input") })
				),
				n(S.FormDivider, { className: G.bottom16 }),
				n(Q6, null)
			)
		);
	}
	var Y6,
		uA = g(() => {
			"use strict";
			a();
			Ye();
			Ke();
			b();
			_l();
			Ul();
			Y6 = ["receivedInput", "receivedOutput", "sentInput", "sentOutput"];
		});
	function _s({ height: e = 24, width: t = 24, className: o }) {
		return n(
			"svg",
			{
				viewBox: "0 96 960 960",
				height: e,
				width: t,
				className: H(lr("icon"), o),
			},
			n("path", {
				fill: "currentColor",
				d: "m475 976 181-480h82l186 480h-87l-41-126H604l-47 126h-82Zm151-196h142l-70-194h-2l-70 194Zm-466 76-55-55 204-204q-38-44-67.5-88.5T190 416h87q17 33 37.5 62.5T361 539q45-47 75-97.5T487 336H40v-80h280v-80h80v80h280v80H567q-22 69-58.5 135.5T419 598l98 99-30 81-127-122-200 200Z",
			})
		);
	}
	var $l,
		pA,
		g0 = g(() => {
			"use strict";
			a();
			_r();
			me();
			Ke();
			b();
			_l();
			uA();
			Ul();
			pA = ({ isMainChat: e }) => {
				let { autoTranslate: t, showChatBarButton: o } = vt.use([
						"autoTranslate",
						"showChatBarButton",
					]),
					[r, i] = z(!1);
				if ((ue(() => (($l = i), () => ($l = void 0)), []), !e || !o))
					return null;
				let s = () => {
						let c = !t;
						(vt.store.autoTranslate = c),
							c &&
								vt.store.showAutoTranslateAlert !== !1 &&
								Tt.show({
									title: "Vencord Auto-Translate Enabled",
									body: n(
										f,
										null,
										n(
											S.FormText,
											null,
											"You just enabled Auto Translate! Any message ",
											n("b", null, "will automatically be translated"),
											" before being sent."
										)
									),
									confirmText: "Disable Auto-Translate",
									cancelText: "Got it",
									secondaryConfirmText: "Don't show again",
									onConfirmSecondary: () =>
										(vt.store.showAutoTranslateAlert = !1),
									onConfirm: () => (vt.store.autoTranslate = !1),
									confirmColor: "vc-notification-log-danger-btn",
								});
					},
					l = n(
						ln,
						{
							tooltip: "Open Translate Modal",
							onClick: (c) => {
								if (c.shiftKey) return s();
								ge((u) => n(cA, { rootProps: u }));
							},
							onContextMenu: s,
							buttonProps: { "aria-haspopup": "dialog" },
						},
						n(_s, { className: lr({ "auto-translate": t, "chat-button": !0 }) })
					);
				return r && vt.store.showAutoTranslateTooltip
					? n(te, { text: "Auto Translate Enabled", forceOpen: !0 }, () => l)
					: l;
			};
		});
	function y0(e, t) {
		h0.get(e)(t);
	}
	function X6({ onDismiss: e }) {
		return n("button", { onClick: e, className: lr("dismiss") }, "Dismiss");
	}
	function dA({ message: e }) {
		let [t, o] = z();
		return (
			ue(() => {
				if (!e.vencordEmbeddedBy)
					return h0.set(e.id, o), () => void h0.delete(e.id);
			}, []),
			t
				? n(
						"span",
						{ className: lr("accessory") },
						n(_s, { width: 16, height: 16 }),
						Ce.parse(t.text),
						" ",
						"(translated from ",
						t.sourceLanguage,
						" - ",
						n(X6, { onDismiss: () => o(void 0) }),
						")"
					)
				: null
		);
	}
	var h0,
		mA = g(() => {
			"use strict";
			a();
			b();
			g0();
			Ul();
			h0 = new Map();
		});
	var J6,
		mf,
		fA = g(() => {
			"use strict";
			a();
			iA();
			_r();
			ho();
			Xa();
			Sn();
			bs();
			P();
			T();
			b();
			_l();
			g0();
			mA();
			Ul();
			(J6 = (e, { message: t }) => {
				if (!t.content) return;
				let o = Ve("copy-text", e);
				!o ||
					o.splice(
						o.findIndex((r) => r?.props?.id === "copy-text") + 1,
						0,
						n(E.MenuItem, {
							id: "vc-trans",
							label: "Translate",
							icon: _s,
							action: async () => {
								let r = await Bl("received", t.content);
								y0(t.id, r);
							},
						})
					);
			}),
				(mf = h({
					name: "Translate",
					description: "Translate messages with Google Translate or DeepL",
					authors: [d.Ven, d.AshtonMemer],
					dependencies: [
						"MessageAccessoriesAPI",
						"MessagePopoverAPI",
						"MessageEventsAPI",
						"ChatInputButtonAPI",
					],
					settings: vt,
					contextMenus: { message: J6 },
					translate: Bl,
					start() {
						bi("vc-translation", (t) => n(dA, { message: t.message })),
							sn("vc-translate", pA),
							Qn("vc-translate", (t) =>
								t.content
									? {
											label: "Translate",
											icon: _s,
											message: t,
											channel: oe.getChannel(t.channel_id),
											onClick: async () => {
												let o = await Bl("received", t.content);
												y0(t.id, o);
											},
										}
									: null
							);
						let e;
						this.preSend = yo(async (t, o) => {
							if (!vt.store.autoTranslate || !o.content) return;
							$l?.(!0), clearTimeout(e), (e = setTimeout(() => $l?.(!1), 2e3));
							let r = await Bl("sent", o.content);
							o.content = r.text;
						});
					},
					stop() {
						vo(this.preSend),
							an("vc-translate"),
							Xn("vc-translate"),
							Qa("vc-translation");
					},
				}));
		});
	var gA = g(() => {});
	function v0({ a: e, b: t, count: o }) {
		return [
			n("strong", { key: "0" }, e),
			", ",
			n("strong", { key: "1" }, t),
			`, and ${o} others are typing...`,
		];
	}
	var ff,
		V6,
		gf,
		S0 = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			it();
			T();
			b();
			ff = x({
				showAvatars: {
					type: 3,
					default: !0,
					description: "Show avatars in the typing indicator",
				},
				showRoleColors: {
					type: 3,
					default: !0,
					description: "Show role colors in the typing indicator",
				},
				alternativeFormatting: {
					type: 3,
					default: !0,
					description:
						"Show a more useful message when several users are typing",
				},
			});
			(V6 = R.wrap(
				function ({ user: e, guildId: t }) {
					return n(
						"strong",
						{
							role: "button",
							onClick: () => {
								Eo(e.id);
							},
							style: {
								display: "grid",
								gridAutoFlow: "column",
								gap: "4px",
								color: ff.store.showRoleColors
									? Le.getMember(t, e.id)?.colorString
									: void 0,
								cursor: "pointer",
							},
						},
						ff.store.showAvatars &&
							n(
								"div",
								{ style: { marginTop: "4px" } },
								n(zi, { size: "SIZE_16", src: e.getAvatarURL(t, 128) })
							),
						Le.getNick(t, e.id) ||
							(!t && Ie.getNickname(e.id)) ||
							e.globalName ||
							e.username
					);
				},
				{ noop: !0 }
			)),
				(gf = h({
					name: "TypingTweaks",
					description: "Show avatars and role colours in the typing indicator",
					authors: [d.zt],
					patches: [
						{
							find: "getCooldownTextStyle",
							replacement: {
								match:
									/(?<=children:\[(\i)\.length>0.{0,200}?"aria-atomic":!0,children:)\i/,
								replace:
									"$self.mutateChildren(this.props, $1, $&), style: $self.TYPING_TEXT_STYLE",
							},
						},
						{
							find: "getCooldownTextStyle",
							replacement: {
								match:
									/(?<=map\(\i=>)\i\.\i\.getName\(\i,this\.props\.channel\.id,(\i)\)/,
								replace: "$1",
							},
						},
						{
							find: "getCooldownTextStyle",
							replacement: {
								match:
									/(?<=(\i)\.length\?\i.\i\.Messages.THREE_USERS_TYPING\.format\({\i:(\i),(?:\i:)?(\i),\i:\i}\):)\i\.\i\.Messages\.SEVERAL_USERS_TYPING/,
								replace: (e, t, o, r) =>
									`$self.buildSeveralUsers({ a: ${o}, b: ${r}, count: ${t}.length - 2 })`,
							},
							predicate: () => ff.store.alternativeFormatting,
						},
					],
					settings: ff,
					TYPING_TEXT_STYLE: {
						display: "grid",
						gridAutoFlow: "column",
						gridGap: "0.25em",
					},
					buildSeveralUsers: v0,
					mutateChildren(e, t, o) {
						if (!Array.isArray(o)) return o;
						let r = 0;
						return o.map((i) =>
							i.type === "strong" ? n(V6, { ...e, user: t[r++] }) : i
						);
					},
				}));
		});
	function Br(e, t) {
		let o = D.getUser(t);
		return Le.getNick(e, t) ?? o.globalName ?? o.username;
	}
	function n8({ channelId: e }) {
		let t = Oe(
				[hA],
				() => ({ ...hA.getTypingUsers(e) }),
				null,
				(c, u) => {
					let p = Object.keys(c),
						m = Object.keys(u);
					return p.length === m.length && m.every((y) => c[y] != null);
				}
			),
			o = Oe([xe], () => xe.getChannelId()),
			r = oe.getChannel(e).guild_id;
		if (
			(!Bs.store.includeMutedChannels && o8.isChannelMuted(r, e)) ||
			(!Bs.store.includeCurrentChannel && o === e)
		)
			return null;
		let i = D.getCurrentUser()?.id,
			s = Object.keys(t).filter(
				(c) => c !== i && !(Ie.isBlocked(c) && !Bs.store.includeBlockedUsers)
			),
			l;
		switch (s.length) {
			case 0:
				break;
			case 1: {
				l = Se.Messages.ONE_USER_TYPING.format({ a: Br(r, s[0]) });
				break;
			}
			case 2: {
				l = Se.Messages.TWO_USERS_TYPING.format({
					a: Br(r, s[0]),
					b: Br(r, s[1]),
				});
				break;
			}
			case 3: {
				l = Se.Messages.THREE_USERS_TYPING.format({
					a: Br(r, s[0]),
					b: Br(r, s[1]),
					c: Br(r, s[2]),
				});
				break;
			}
			default: {
				l = Vencord.Plugins.isPluginEnabled("TypingTweaks")
					? v0({ a: Br(r, s[0]), b: Br(r, s[1]), count: s.length - 2 })
					: Se.Messages.SEVERAL_USERS_TYPING;
				break;
			}
		}
		return s.length > 0
			? n(te, { text: l }, (c) =>
					n(
						"div",
						{ className: "vc-typing-indicator", ...c },
						(Bs.store.indicatorMode & 2) === 2 &&
							n(t8, {
								users: s.map((u) => D.getUser(u)),
								guildId: r,
								renderIcon: !1,
								max: 3,
								showDefaultAvatarsForNullUsers: !0,
								showUserPopout: !0,
								size: 16,
								className: "vc-typing-indicator-avatars",
							}),
						(Bs.store.indicatorMode & 1) === 1 &&
							n(
								"div",
								{ className: "vc-typing-indicator-dots" },
								n(e8, { dotRadius: 3, themed: !0 })
							)
					)
				)
			: null;
	}
	var e8,
		t8,
		hA,
		o8,
		Bs,
		hf,
		yA = g(() => {
			"use strict";
			a();
			gA();
			F();
			re();
			P();
			T();
			U();
			b();
			S0();
			(e8 = po("Dots", "AnimatedDots")),
				(t8 = ae("defaultRenderUser", "showDefaultAvatarsForNullUsers")),
				(hA = K("TypingStore")),
				(o8 = K("UserGuildSettingsStore"));
			(Bs = x({
				includeCurrentChannel: {
					type: 3,
					description:
						"Whether to show the typing indicator for the currently selected channel",
					default: !0,
				},
				includeMutedChannels: {
					type: 3,
					description:
						"Whether to show the typing indicator for muted channels.",
					default: !1,
				},
				includeBlockedUsers: {
					type: 3,
					description:
						"Whether to show the typing indicator for blocked users.",
					default: !1,
				},
				indicatorMode: {
					type: 4,
					description: "How should the indicator be displayed?",
					options: [
						{ label: "Avatars and animated dots", value: 3, default: !0 },
						{ label: "Animated dots", value: 1 },
						{ label: "Avatars", value: 2 },
					],
				},
			})),
				(hf = h({
					name: "TypingIndicator",
					description: "Adds an indicator if someone is typing on a channel.",
					authors: [d.Nuckyz, d.fawn, d.Sqaaakoi],
					settings: Bs,
					patches: [
						{
							find: "UNREAD_IMPORTANT:",
							replacement: {
								match:
									/\.name\),.{0,120}\.children.+?:null(?<=,channel:(\i).+?)/,
								replace: "$&,$self.TypingIndicator($1.id)",
							},
						},
						{
							find: "M11 9H4C2.89543 9 2 8.10457 2 7V1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1V7C0 9.20914 1.79086 11 4 11H11C11.5523 11 12 10.5523 12 10C12 9.44771 11.5523 9 11 9Z",
							replacement: {
								match: /mentionsCount:\i.+?null(?<=channel:(\i).+?)/,
								replace: "$&,$self.TypingIndicator($1.id)",
							},
						},
					],
					TypingIndicator: (e) => n(R, { noop: !0 }, n(n8, { channelId: e })),
				}));
		});
	var yf,
		vA = g(() => {
			"use strict";
			a();
			Sn();
			P();
			T();
			yf = h({
				name: "Unindent",
				description: "Trims leading indentation from codeblocks",
				authors: [d.Ven],
				dependencies: ["MessageEventsAPI"],
				patches: [
					{
						find: "inQuote:",
						replacement: {
							match: /,content:([^,]+),inQuote/,
							replace: (e, t) =>
								`,content:Vencord.Plugins.plugins.Unindent.unindent(${t}),inQuote`,
						},
					},
				],
				unindent(e) {
					e = e.replace(/\t/g, "    ");
					let t =
						e
							.match(/^ *(?=\S)/gm)
							?.reduce((o, r) => Math.min(o, r.length), 1 / 0) ?? 0;
					return t ? e.replace(new RegExp(`^ {${t}}`, "gm"), "") : e;
				},
				unindentMsg(e) {
					e.content = e.content.replace(/```(.|\n)*?```/g, (t) => {
						let o = t.split(`
`);
						if (o.length < 2) return t;
						let r = "";
						return (
							o[o.length - 1] === "```" && (r = o.pop()),
							`${o[0]}
${this.unindent(
	o.slice(1).join(`
`)
)}
${r}`
						);
					});
				},
				start() {
					(this.preSend = yo((e, t) => this.unindentMsg(t))),
						(this.preEdit = Ti((e, t, o) => this.unindentMsg(o)));
				},
				stop() {
					vo(this.preSend), xi(this.preEdit);
				},
			});
		});
	var r8,
		vf,
		SA = g(() => {
			"use strict";
			a();
			F();
			ns();
			P();
			T();
			(r8 = x({
				zoomMultiplier: {
					type: 5,
					description: "Zoom multiplier",
					markers: Bo(2, 16),
					default: 4,
				},
			})),
				(vf = h({
					name: "UnlockedAvatarZoom",
					description:
						"Allows you to zoom in further in the image crop tool when changing your avatar",
					authors: [d.nakoyasha],
					settings: r8,
					patches: [
						{
							find: ".Messages.AVATAR_UPLOAD_EDIT_MEDIA",
							replacement: {
								match: /maxValue:\d/,
								replace: "maxValue:$self.settings.store.zoomMultiplier",
							},
						},
					],
				}));
		});
	var b0,
		i8,
		Sf,
		bA = g(() => {
			"use strict";
			a();
			ho();
			yt();
			P();
			T();
			b();
			(b0 = 1 << 2),
				(i8 = (
					e,
					{ channel: t, message: { author: o, embeds: r, flags: i, id: s } }
				) => {
					let l = (i & b0) !== 0;
					if (!l && !r.length) return;
					let c =
						t.isPrivate() ||
						!!(qe.getChannelPermissions({ id: t.id }) & we.EMBED_LINKS);
					if (o.id === D.getCurrentUser().id && !c) return;
					let u = Ve("delete", e),
						p = u?.findIndex((m) => m?.props?.id === "delete");
					!p ||
						!u ||
						u.splice(
							p - 1,
							0,
							n(E.MenuItem, {
								id: "unsuppress-embeds",
								key: "unsuppress-embeds",
								label: l ? "Unsuppress Embeds" : "Suppress Embeds",
								color: l ? void 0 : "danger",
								icon: l ? wa : Pa,
								action: () =>
									Pt.patch({
										url: bt.Endpoints.MESSAGE(t.id, s),
										body: { flags: l ? i & ~b0 : i | b0 },
									}),
							})
						);
				}),
				(Sf = h({
					name: "UnsuppressEmbeds",
					authors: [d.rad, d.HypedDomi],
					description: "Allows you to unsuppress embeds in messages",
					contextMenus: { message: i8 },
				}));
		});
	var TA = g(() => {});
	var s8,
		a8,
		xA,
		wA = g(() => {
			"use strict";
			a();
			TA();
			U();
			b();
			(s8 = C("selectChannel", "selectVoiceChannel")),
				(a8 = 1n << 20n),
				(xA = ({ channel: e, label: t, showHeader: o }) =>
					n(
						"div",
						null,
						o &&
							n(
								S.FormTitle,
								{ className: "vc-uvs-header" },
								"In a voice channel"
							),
						n(
							M,
							{
								className: "vc-uvs-button",
								color: M.Colors.TRANSPARENT,
								size: M.Sizes.SMALL,
								onClick: () => {
									qe.can(a8, e)
										? s8.selectVoiceChannel(e.id)
										: X.show({
												message:
													"Insufficient permissions to enter the channel.",
												id: "user-voice-show-insufficient-permissions",
												type: X.Type.FAILURE,
												options: { position: X.Position.BOTTOM },
											});
								},
							},
							t
						)
					));
		});
	var l8,
		T0,
		PA,
		bf,
		MA = g(() => {
			"use strict";
			a();
			F();
			re();
			P();
			T();
			U();
			b();
			wA();
			(l8 = K("VoiceStateStore")),
				(T0 = x({
					showInUserProfileModal: {
						type: 3,
						description: "Show a user's voice channel in their profile modal",
						default: !0,
					},
					showVoiceChannelSectionHeader: {
						type: 3,
						description:
							'Whether to show "IN A VOICE CHANNEL" above the join button',
						default: !0,
					},
				})),
				(PA = R.wrap(({ user: e }) => {
					let { channelId: t } = l8.getVoiceStateForUser(e.id) ?? {};
					if (!t) return null;
					let o = oe.getChannel(t);
					if (!o) return null;
					let r = le.getGuild(o.guild_id);
					if (!r) return null;
					let i = `${r.name} | ${o.name}`;
					return n(xA, {
						channel: o,
						label: i,
						showHeader: T0.store.showVoiceChannelSectionHeader,
					});
				})),
				(bf = h({
					name: "UserVoiceShow",
					description:
						"Shows whether a User is currently in a voice channel somewhere in their profile",
					authors: [d.LordElias],
					settings: T0,
					patchModal({ user: e }) {
						return T0.store.showInUserProfileModal
							? n(
									"div",
									{ className: "vc-uvs-modal-margin" },
									n(PA, { user: e })
								)
							: null;
					},
					patchProfilePopout: ({ user: e }) => {
						let t = e.id === D.getCurrentUser().id;
						return n(
							"div",
							{ className: t ? "vc-uvs-popout-margin-self" : "" },
							n(PA, { user: e })
						);
					},
					patches: [],
				}));
		});
	var IA,
		CA = g(() => {
			a();
			(window.VencordStyles ??= new Map()).set("src/plugins/usrbg/index.css", {
				name: "src/plugins/usrbg/index.css",
				source: `:is([class*="userProfile"], [class*="userPopout"]) [class*="bannerPremium"] {
    background: center / cover no-repeat;
}

[class*="NonPremium"]:has([class*="bannerPremium"]) [class*="avatarPositionNormal"],
[class*="PremiumWithoutBanner"]:has([class*="bannerPremium"]) [class*="avatarPositionPremiumNoBanner"] {
    top: 76px;
}

[style*="background-image"] [class*="background_"] {
    background-color: transparent !important;
}
`,
				classNames: {},
				dom: null,
			});
			IA = "src/plugins/usrbg/index.css";
		});
	var c8,
		x0,
		Tf,
		AA = g(() => {
			"use strict";
			a();
			F();
			tt();
			no();
			P();
			T();
			CA();
			(c8 = "https://usrbg.is-hardly.online/users"),
				(x0 = x({
					nitroFirst: {
						description:
							"Banner to use if both Nitro and USRBG banners are present",
						type: 4,
						options: [
							{ label: "Nitro banner", value: !0, default: !0 },
							{ label: "USRBG banner", value: !1 },
						],
					},
					voiceBackground: {
						description: "Use USRBG banners as voice chat backgrounds",
						type: 3,
						default: !0,
						restartNeeded: !0,
					},
				})),
				(Tf = h({
					name: "USRBG",
					description:
						"Displays user banners from USRBG, allowing anyone to get a banner without Nitro",
					authors: [d.AutumnVN, d.katlyn, d.pylix, d.TheKodeToad],
					settings: x0,
					patches: [
						{
							find: '.banner)==null?"COMPLETE"',
							replacement: {
								match: /(?<=void 0:)\i.getPreviewBanner\(\i,\i,\i\)/,
								replace: "$self.patchBannerUrl(arguments[0])||$&",
							},
						},
						{
							find: '"data-selenium-video-tile":',
							predicate: () => x0.store.voiceBackground,
							replacement: [
								{
									match: /(?<=function\((\i),\i\)\{)(?=let.{20,40},style:)/,
									replace: "$1.style=$self.getVoiceBackgroundStyles($1);",
								},
							],
						},
					],
					data: null,
					settingsAboutComponent: () =>
						n(
							He,
							{
								href: "https://github.com/AutumnVN/usrbg#how-to-request-your-own-usrbg-banner",
							},
							"CLICK HERE TO GET YOUR OWN BANNER"
						),
					getVoiceBackgroundStyles({ className: e, participantUserId: t }) {
						if (e.includes("tile_") && this.userHasBackground(t))
							return {
								backgroundImage: `url(${this.getImageUrl(t)})`,
								backgroundSize: "cover",
								backgroundPosition: "center",
								backgroundRepeat: "no-repeat",
							};
					},
					patchBannerUrl({ displayProfile: e }) {
						if (
							!(e?.banner && x0.store.nitroFirst) &&
							this.userHasBackground(e?.userId)
						)
							return this.getImageUrl(e?.userId);
					},
					userHasBackground(e) {
						return !!this.data?.users[e];
					},
					getImageUrl(e) {
						if (!this.userHasBackground(e)) return null;
						let {
							endpoint: t,
							bucket: o,
							prefix: r,
							users: { [e]: i },
						} = this.data;
						return `${t}/${o}/${r}${e}?${i}`;
					},
					async start() {
						fo(IA);
						let e = await fetch(c8);
						e.ok && (this.data = await e.json());
					},
				}));
		});
	var w0,
		P0,
		u8,
		xf,
		NA = g(() => {
			"use strict";
			a();
			P();
			T();
			U();
			b();
			(w0 = new Map()),
				(u8 = fe(
					".createFromServer(",
					".isBlockedForMessage",
					"messageReference:"
				)),
				(xf = h({
					name: "ValidReply",
					description:
						'Fixes "Message could not be loaded" upon hovering over the reply',
					authors: [d.newwares],
					patches: [
						{
							find: "Messages.REPLY_QUOTE_MESSAGE_NOT_LOADED",
							replacement: {
								match: /Messages\.REPLY_QUOTE_MESSAGE_NOT_LOADED/,
								replace: "$&,onMouseEnter:()=>$self.fetchReply(arguments[0])",
							},
						},
						{
							find: "ReferencedMessageStore",
							replacement: {
								match: /constructor\(\)\{\i\(this,"_channelCaches",new Map\)/,
								replace: "$&;$self.setReplyStore(this);",
							},
						},
					],
					setReplyStore(e) {
						P0 = e;
					},
					async fetchReply(e) {
						let { channel_id: t, message_id: o } =
							e.baseMessage.messageReference;
						w0.has(o) ||
							(w0.set(o, t),
							Pt.get({
								url: `/channels/${t}/messages`,
								query: { limit: 1, around: o },
								retries: 2,
							})
								.then((r) => {
									let i = r?.body?.[0];
									!i ||
										(i.id !== o
											? (P0.set(t, o, { state: 2 }),
												_.dispatch({
													type: "MESSAGE_DELETE",
													channelId: t,
													message: o,
												}))
											: (P0.set(i.channel_id, i.id, {
													state: 0,
													message: u8(i),
												}),
												_.dispatch({ type: "MESSAGE_UPDATE", message: i })));
								})
								.catch(() => {})
								.finally(() => {
									w0.delete(o);
								}));
					},
				}));
		});
	async function d8(e) {
		let t = D.getUser(e);
		if (t) return t;
		let o = await Pt.get({ url: bt.Endpoints.USER(e) }).then(
			(s) => (_.dispatch({ type: "USER_UPDATE", user: s.body }), s.body)
		);
		await _.dispatch({ type: "USER_PROFILE_FETCH_FAILURE", userId: e }),
			(t = D.getUser(e));
		let r = Object.entries(p8)
			.filter(([s, l]) => !isNaN(l) && t.hasFlag(l))
			.map(([s]) => RA[s.toLowerCase()])
			.filter(En);
		(o.premium_type ||
			(!o.bot && (o.banner || o.avatar?.startsWith?.("a_")))) &&
			r.push(RA.premium);
		let i = eo.getUserProfile(e);
		return (
			(i.accentColor = o.accent_color),
			(i.badges = r),
			(i.banner = o.banner),
			(i.premiumType = o.premium_type),
			t
		);
	}
	function m8({ data: e, UserMention: t, RoleMention: o, parse: r, props: i }) {
		let [s, l] = z(e.userId);
		if (s)
			return n(t, {
				className: "mention",
				userId: s,
				channelId: e.channelId,
				inlinePreview: i.noStyleAndInteraction,
				key: i.key,
			});
		let c = r(e.content, i);
		return n(
			o,
			{ ...e, inlinePreview: i.formatInline },
			n(
				"span",
				{
					onMouseEnter: () => {
						let u = c?.[0]?.props?.children;
						if (typeof u != "string") return;
						let p = u.match(/<@!?(\d+)>/)?.[1];
						if (!p || wf.has(p)) return;
						if (D.getUser(p)) return l(p);
						let m = () => {
							wf.add(p),
								kA.unshift(() =>
									d8(p)
										.then(() => {
											l(p), wf.delete(p);
										})
										.catch((y) => {
											y?.status === 429 &&
												(kA.unshift(() =>
													Xo(y?.body?.retry_after ?? 1e3).then(m)
												),
												wf.delete(p));
										})
										.finally(() => Xo(300))
								);
						};
						m();
					},
				},
				c
			)
		);
	}
	var p8,
		RA,
		wf,
		kA,
		Pf,
		DA = g(() => {
			"use strict";
			a();
			re();
			P();
			Yi();
			me();
			di();
			T();
			b();
			(p8 = bt.UserFlags),
				(RA = {
					active_developer: {
						id: "active_developer",
						description: "Active Developer",
						icon: "6bdc42827a38498929a4920da12695d9",
						link: "https://support-dev.discord.com/hc/en-us/articles/10113997751447",
					},
					bug_hunter_level_1: {
						id: "bug_hunter_level_1",
						description: "Discord Bug Hunter",
						icon: "2717692c7dca7289b35297368a940dd0",
						link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs",
					},
					bug_hunter_level_2: {
						id: "bug_hunter_level_2",
						description: "Discord Bug Hunter",
						icon: "848f79194d4be5ff5f81505cbd0ce1e6",
						link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs",
					},
					certified_moderator: {
						id: "certified_moderator",
						description: "Moderator Programs Alumni",
						icon: "fee1624003e2fee35cb398e125dc479b",
						link: "https://discord.com/safety",
					},
					discord_employee: {
						id: "staff",
						description: "Discord Staff",
						icon: "5e74e9b61934fc1f67c65515d1f7e60d",
						link: "https://discord.com/company",
					},
					get staff() {
						return this.discord_employee;
					},
					hypesquad: {
						id: "hypesquad",
						description: "HypeSquad Events",
						icon: "bf01d1073931f921909045f3a39fd264",
						link: "https://discord.com/hypesquad",
					},
					hypesquad_online_house_1: {
						id: "hypesquad_house_1",
						description: "HypeSquad Bravery",
						icon: "8a88d63823d8a71cd5e390baa45efa02",
						link: "https://discord.com/settings/hypesquad-online",
					},
					hypesquad_online_house_2: {
						id: "hypesquad_house_2",
						description: "HypeSquad Brilliance",
						icon: "011940fd013da3f7fb926e4a1cd2e618",
						link: "https://discord.com/settings/hypesquad-online",
					},
					hypesquad_online_house_3: {
						id: "hypesquad_house_3",
						description: "HypeSquad Balance",
						icon: "3aa41de486fa12454c3761e8e223442e",
						link: "https://discord.com/settings/hypesquad-online",
					},
					partner: {
						id: "partner",
						description: "Partnered Server Owner",
						icon: "3f9748e53446a137a052f3454e2de41e",
						link: "https://discord.com/partners",
					},
					premium: {
						id: "premium",
						description: "Subscriber",
						icon: "2ba85e8026a8614b640c2837bcdfe21b",
						link: "https://discord.com/settings/premium",
					},
					premium_early_supporter: {
						id: "early_supporter",
						description: "Early Supporter",
						icon: "7060786766c9c840eb3019e725d2b358",
						link: "https://discord.com/settings/premium",
					},
					verified_developer: {
						id: "verified_developer",
						description: "Early Verified Bot Developer",
						icon: "6df5892e0f35b051f8b61eace34f4967",
					},
				}),
				(wf = new Set()),
				(kA = new Oo(5));
			Pf = h({
				name: "ValidUser",
				description:
					"Fix mentions for unknown users showing up as '@unknown-user' (hover over a mention to fix it)",
				authors: [d.Ven, d.Dolfies],
				tags: ["MentionCacheFix"],
				patches: [
					{
						find: 'className:"mention"',
						replacement: {
							match:
								/react(?=\(\i,\i,\i\).{0,100}return null==.{0,70}\?\(0,\i\.jsx\)\((\i\.\i),.+?jsx\)\((\i\.\i),\{className:"mention")/,
							replace:
								"react:(...args)=>$self.renderMention($1,$2,...args),originalReact",
						},
					},
					{
						find: "unknownUserMentionPlaceholder:",
						replacement: {
							match: /unknownUserMentionPlaceholder:/,
							replace: "$&false&&",
						},
					},
				],
				renderMention(e, t, o, r, i) {
					return n(
						R,
						{ noop: !0 },
						n(m8, {
							key: "mention" + o.userId,
							RoleMention: e,
							UserMention: t,
							data: o,
							parse: r,
							props: i,
						})
					);
				},
			});
		});
	var M0,
		Mf,
		LA = g(() => {
			"use strict";
			a();
			P();
			T();
			b();
			(M0 = {}),
				(Mf = h({
					name: "VoiceChatDoubleClick",
					description:
						"Join voice chats via double click instead of single click",
					authors: [d.Ven, d.D3SOX],
					patches: [
						...[".handleVoiceStatusClick", ".handleClickChat"].map((e) => ({
							find: e,
							replacement: [
								{
									match: /onClick:\(\)=>\{this.handleClick\(\)/g,
									replace:
										"onClick:()=>{$self.schedule(()=>{this.handleClick()},this)",
								},
							],
						})),
						{
							find: 'className:"channelMention",children',
							replacement: {
								match:
									/onClick:(\i)(?=,.{0,30}className:"channelMention".+?(\i)\.inContent)/,
								replace: (e, t, o) =>
									`onClick:(vcDoubleClickEvt)=>$self.shouldRunOnClick(vcDoubleClickEvt,${o})&&${t}()`,
							},
						},
					],
					shouldRunOnClick(e, { channelId: t }) {
						let o = oe.getChannel(t);
						return !o || ![2, 13].includes(o.type) ? !0 : e.detail >= 2;
					},
					schedule(e, t) {
						let o = t.props.channel.id;
						if (xe.getVoiceChannelId() === o) {
							e();
							return;
						}
						let r = (M0[o] ??= { timeout: void 0, i: 0 });
						clearTimeout(r.timeout),
							++r.i >= 2
								? (e(), delete M0[o])
								: (r.timeout = setTimeout(() => {
										delete M0[o];
									}, 500));
					},
				}));
		});
	function Cf(e, t = cr.store) {
		if (!e) return;
		let o = new SpeechSynthesisUtterance(e),
			r = speechSynthesis.getVoices().find((i) => i.voiceURI === t.voice);
		(!r &&
			(new V("VcNarrator").error(
				`Voice "${t.voice}" not found. Resetting to default.`
			),
			(r = speechSynthesis.getVoices().find((i) => i.default)),
			(t.voice = r?.voiceURI),
			!r)) ||
			((o.voice = r),
			(o.volume = t.volume),
			(o.rate = t.rate),
			speechSynthesis.speak(o));
	}
	function If(e) {
		let t = cr.store.latinOnly
			? /[^\p{Script=Latin}\p{Number}\p{Punctuation}\s]/gu
			: /[^\p{Letter}\p{Number}\p{Punctuation}\s]/gu;
		return e.normalize("NFKC").replace(t, "").replace(/_{2,}/g, "_").trim();
	}
	function Af(e, t, o, r, i) {
		return e
			.replaceAll("{{USER}}", If(t) || (t ? "Someone" : ""))
			.replaceAll("{{CHANNEL}}", If(o) || "channel")
			.replaceAll("{{DISPLAY_NAME}}", If(r) || (r ? "Someone" : ""))
			.replaceAll("{{NICKNAME}}", If(i) || (i ? "Someone" : ""));
	}
	function f8({ channelId: e, oldChannelId: t }, o) {
		if ((o && e !== I0 && ((t = I0), (I0 = e)), e !== t)) {
			if (e) return [t ? "move" : "join", e];
			if (t) return ["leave", t];
		}
		return ["", ""];
	}
	function g8(e, t) {
		let o = Object.assign({}, cr.store, e),
			r = D.getCurrentUser(),
			i = to.getGuildId();
		Cf(
			Af(
				o[t + "Message"],
				r.username,
				"general",
				r.globalName ?? r.username,
				Le.getNick(i, r.id) ?? r.username
			),
			o
		);
	}
	var EA,
		I0,
		cr,
		Nf,
		OA = g(() => {
			"use strict";
			a();
			F();
			gi();
			P();
			co();
			De();
			Ye();
			On();
			T();
			U();
			b();
			EA = K("VoiceStateStore");
			(cr = x({
				voice: {
					type: 4,
					description: "Narrator Voice",
					options: Dt(
						() =>
							window.speechSynthesis?.getVoices().map((e) => ({
								label: e.name,
								value: e.voiceURI,
								default: e.default,
							})) ?? []
					),
				},
				volume: {
					type: 5,
					description: "Narrator Volume",
					default: 1,
					markers: [0, 0.25, 0.5, 0.75, 1],
					stickToMarkers: !1,
				},
				rate: {
					type: 5,
					description: "Narrator Speed",
					default: 1,
					markers: [0.1, 0.5, 1, 2, 5, 10],
					stickToMarkers: !1,
				},
				sayOwnName: { description: "Say own name", type: 3, default: !1 },
				latinOnly: {
					description:
						"Strip non latin characters from names before saying them",
					type: 3,
					default: !1,
				},
				joinMessage: {
					type: 0,
					description: "Join Message",
					default: "{{USER}} joined",
				},
				leaveMessage: {
					type: 0,
					description: "Leave Message",
					default: "{{USER}} left",
				},
				moveMessage: {
					type: 0,
					description: "Move Message",
					default: "{{USER}} moved to {{CHANNEL}}",
				},
				muteMessage: {
					type: 0,
					description: "Mute Message (only self for now)",
					default: "{{USER}} Muted",
				},
				unmuteMessage: {
					type: 0,
					description: "Unmute Message (only self for now)",
					default: "{{USER}} unmuted",
				},
				deafenMessage: {
					type: 0,
					description: "Deafen Message (only self for now)",
					default: "{{USER}} deafened",
				},
				undeafenMessage: {
					type: 0,
					description: "Undeafen Message (only self for now)",
					default: "{{USER}} undeafened",
				},
			})),
				(Nf = h({
					name: "VcNarrator",
					description:
						"Announces when users join, leave, or move voice channels via narrator",
					authors: [d.Ven],
					reporterTestable: 2,
					settings: cr,
					flux: {
						VOICE_STATE_UPDATES({ voiceStates: e }) {
							let t = to.getGuildId(),
								o = xe.getVoiceChannelId(),
								r = D.getCurrentUser().id;
							if (oe.getChannel(o)?.type !== 13)
								for (let i of e) {
									let { userId: s, channelId: l, oldChannelId: c } = i,
										u = s === r;
									if (!u && (!o || (l !== o && c !== o))) continue;
									let [p, m] = f8(i, u);
									if (!p) continue;
									let y = cr.store[p + "Message"],
										v = u && !cr.store.sayOwnName ? "" : D.getUser(s).username,
										N = v && (D.getUser(s).globalName ?? v),
										w = v && (Le.getNick(t, s) ?? v),
										I = oe.getChannel(m).name;
									Cf(Af(y, v, I, N, w));
								}
						},
						AUDIO_TOGGLE_SELF_MUTE() {
							let e = xe.getVoiceChannelId(),
								t = EA.getVoiceStateForChannel(e);
							if (!t) return;
							let o = t.mute || t.selfMute ? "unmute" : "mute";
							Cf(
								Af(cr.store[o + "Message"], "", oe.getChannel(e).name, "", "")
							);
						},
						AUDIO_TOGGLE_SELF_DEAF() {
							let e = xe.getVoiceChannelId(),
								t = EA.getVoiceStateForChannel(e);
							if (!t) return;
							let o = t.deaf || t.selfDeaf ? "undeafen" : "deafen";
							Cf(
								Af(cr.store[o + "Message"], "", oe.getChannel(e).name, "", "")
							);
						},
					},
					start() {
						if (
							typeof speechSynthesis > "u" ||
							speechSynthesis.getVoices().length === 0
						) {
							new V("VcNarrator").warn(
								"SpeechSynthesis not supported or no Narrator voices found. Thus, this plugin will not work. Check my Settings for more info"
							);
							return;
						}
					},
					settingsAboutComponent({ tempSettings: e }) {
						let [t, o] = dt(() => {
								let s = speechSynthesis.getVoices();
								return [s.length !== 0, s.some((l) => l.lang.startsWith("en"))];
							}, []),
							r = dt(
								() =>
									Object.keys(cr.def)
										.filter((s) => s.endsWith("Message"))
										.map((s) => s.slice(0, -7)),
								[]
							),
							i = null;
						if (t)
							o ||
								(i = n(
									Fo,
									null,
									"You don't have any English voices installed, so the narrator might sound weird"
								));
						else {
							let s = "No narrator voices found. ";
							(s += navigator.platform?.toLowerCase().includes("linux")
								? "Install speech-dispatcher or espeak and run Discord with the --enable-speech-dispatcher flag"
								: "Try installing some in the Narrator settings of your Operating System"),
								(i = n(Fo, null, s));
						}
						return n(
							S.FormSection,
							null,
							n(
								S.FormText,
								null,
								"You can customise the spoken messages below. You can disable specific messages by setting them to nothing"
							),
							n(
								S.FormText,
								null,
								"The special placeholders ",
								n("code", null, "{{USER}}"),
								", ",
								n("code", null, "{{DISPLAY_NAME}}"),
								", ",
								n("code", null, "{{NICKNAME}}"),
								" and ",
								n("code", null, "{{CHANNEL}}"),
								" ",
								"will be replaced with the user's name (nothing if it's yourself), the user's display name, the user's nickname on current server and the channel's name respectively"
							),
							o &&
								n(
									f,
									null,
									n(
										S.FormTitle,
										{ className: G.top20, tag: "h3" },
										"Play Example Sounds"
									),
									n(
										"div",
										{
											style: {
												display: "grid",
												gridTemplateColumns: "repeat(4, 1fr)",
												gap: "1rem",
											},
											className: "vc-narrator-buttons",
										},
										r.map((s) =>
											n(M, { key: s, onClick: () => g8(e, s) }, mi([s]))
										)
									)
								),
							i
						);
					},
				}));
		});
	var FA = g(() => {});
	function y8(e) {
		let { useQuickCss: t } = Mt(["useQuickCss"]),
			o = [];
		for (let r of Object.values(Vencord.Plugins.plugins))
			r.toolboxActions &&
				Vencord.Plugins.isPluginEnabled(r.name) &&
				o.push(
					n(
						E.MenuGroup,
						{ label: r.name, key: `vc-toolbox-${r.name}` },
						Object.entries(r.toolboxActions).map(([i, s]) => {
							let l = `vc-toolbox-${r.name}-${i}`;
							return n(E.MenuItem, { id: l, key: l, label: i, action: s });
						})
					)
				);
		return n(
			E.Menu,
			{ navId: "vc-toolbox", onClose: e },
			n(E.MenuItem, {
				id: "vc-toolbox-notifications",
				label: "Open Notification Log",
				action: ka,
			}),
			n(E.MenuCheckboxItem, {
				id: "vc-toolbox-quickcss-toggle",
				checked: t,
				label: "Enable QuickCSS",
				action: () => {
					he.useQuickCss = !t;
				},
			}),
			n(E.MenuItem, {
				id: "vc-toolbox-quickcss",
				label: "Open QuickCSS",
				action: () => VencordNative.quickCss.openEditor(),
			}),
			...o
		);
	}
	function v8(e) {
		return n(
			"svg",
			{
				xmlns: "http://www.w3.org/2000/svg",
				viewBox: "0 0 27 27",
				width: 24,
				height: 24,
			},
			n("path", {
				fill: "currentColor",
				d: e
					? "M9 0h1v1h1v2h1v2h3V3h1V1h1V0h1v2h1v2h1v7h-1v-1h-3V9h1V6h-1v4h-3v1h1v-1h2v1h3v1h-1v1h-3v2h1v1h1v1h1v3h-1v4h-2v-1h-1v-4h-1v4h-1v1h-2v-4H9v-3h1v-1h1v-1h1v-2H9v-1H8v-1h3V6h-1v3h1v1H8v1H7V4h1V2h1M5 19h2v1h1v1h1v3H4v-1h2v-1H4v-2h1m15-1h2v1h1v2h-2v1h2v1h-5v-3h1v-1h1m4 3h4v1h-4"
					: "M0 0h7v1H6v1H5v1H4v1H3v1H2v1h5v1H0V6h1V5h1V4h1V3h1V2h1V1H0m13 2h5v1h-1v1h-1v1h-1v1h3v1h-5V7h1V6h1V5h1V4h-3m8 5h1v5h1v-1h1v1h-1v1h1v-1h1v1h-1v3h-1v1h-2v1h-1v1h1v-1h2v-1h1v2h-1v1h-2v1h-1v-1h-1v1h-6v-1h-1v-1h-1v-2h1v1h2v1h3v1h1v-1h-1v-1h-3v-1h-4v-4h1v-2h1v-1h1v-1h1v2h1v1h1v-1h1v1h-1v1h2v-2h1v-2h1v-1h1M8 14h2v1H9v4h1v2h1v1h1v1h1v1h4v1h-6v-1H5v-1H4v-5h1v-1h1v-2h2m17 3h1v3h-1v1h-1v1h-1v2h-2v-2h2v-1h1v-1h1m1 0h1v3h-1v1h-2v-1h1v-1h1",
			})
		);
	}
	function S8() {
		let [e, t] = z(!1);
		return n(
			Jr,
			{
				position: "bottom",
				align: "right",
				animation: Jr.Animation.NONE,
				shouldShow: e,
				onRequestClose: () => t(!1),
				renderPopout: () => y8(() => t(!1)),
			},
			(o, { isShown: r }) =>
				n(h8, {
					className: "vc-toolbox-btn",
					onClick: () => t((i) => !i),
					tooltip: r ? null : "Vencord Toolbox",
					icon: () => v8(r),
					selected: r,
				})
		);
	}
	function b8({ children: e }) {
		return (
			e.splice(e.length - 1, 0, n(R, { noop: !0 }, n(S8, null))), n(f, null, e)
		);
	}
	var h8,
		Rf,
		_A = g(() => {
			"use strict";
			a();
			FA();
			Ac();
			F();
			re();
			P();
			T();
			U();
			b();
			h8 = po("Icon", "Divider");
			Rf = h({
				name: "VencordToolbox",
				description:
					"Adds a button next to the inbox button in the channel header that houses Vencord quick actions",
				authors: [d.Ven, d.AutumnVN],
				patches: [
					{
						find: "toolbar:function",
						replacement: {
							match: /(?<=toolbar:function.{0,100}\()\i.Fragment,/,
							replace: "$self.ToolboxFragmentWrapper,",
						},
					},
				],
				ToolboxFragmentWrapper: R.wrap(b8, {
					fallback: () =>
						n("p", { style: { color: "red" } }, "Failed to render :("),
				}),
			});
		});
	function Us(e) {
		let t = e.startsWith("/") ? "png" : C0.store.format,
			o = new URL(e, window.location.href);
		o.searchParams.set("size", C0.store.imgSize),
			(o.pathname = o.pathname.replace(/\.(png|jpe?g|webp)$/, `.${t}`)),
			(e = o.toString()),
			o.searchParams.set("size", "4096");
		let r = o.toString();
		Lo(e, { original: r, height: 256 });
	}
	var C0,
		T8,
		x8,
		w8,
		kf,
		BA = g(() => {
			"use strict";
			a();
			F();
			yt();
			P();
			it();
			T();
			b();
			C0 = x({
				format: {
					type: 4,
					description:
						"Choose the image format to use for non animated images. Animated images will always use .gif",
					options: [
						{ label: "webp", value: "webp", default: !0 },
						{ label: "png", value: "png" },
						{ label: "jpg", value: "jpg" },
					],
				},
				imgSize: {
					type: 4,
					description: "The image size to use",
					options: ["128", "256", "512", "1024", "2048", "4096"].map((e) => ({
						label: e,
						value: e,
						default: e === "1024",
					})),
				},
			});
			(T8 = (e, { user: t, guildId: o }) => {
				if (!t) return;
				let r = Le.getMember(o, t.id)?.avatar || null;
				e.splice(
					-1,
					0,
					n(
						E.MenuGroup,
						null,
						n(E.MenuItem, {
							id: "view-avatar",
							label: "View Avatar",
							action: () => Us(Rt.getUserAvatarURL(t, !0)),
							icon: tn,
						}),
						r &&
							n(E.MenuItem, {
								id: "view-server-avatar",
								label: "View Server Avatar",
								action: () =>
									Us(
										Rt.getGuildMemberAvatarURLSimple({
											userId: t.id,
											avatar: r,
											guildId: o,
											canAnimate: !0,
										})
									),
								icon: tn,
							})
					)
				);
			}),
				(x8 = (e, { guild: t }) => {
					if (!t) return;
					let { id: o, icon: r, banner: i } = t;
					(!i && !r) ||
						e.splice(
							-1,
							0,
							n(
								E.MenuGroup,
								null,
								r
									? n(E.MenuItem, {
											id: "view-icon",
											label: "View Icon",
											action: () =>
												Us(
													Rt.getGuildIconURL({ id: o, icon: r, canAnimate: !0 })
												),
											icon: tn,
										})
									: null,
								i
									? n(E.MenuItem, {
											id: "view-banner",
											label: "View Banner",
											action: () => Us(Rt.getGuildBannerURL(t, !0)),
											icon: tn,
										})
									: null
							)
						);
				}),
				(w8 = (e, { channel: t }) => {
					!t ||
						e.splice(
							-1,
							0,
							n(
								E.MenuGroup,
								null,
								n(E.MenuItem, {
									id: "view-group-channel-icon",
									label: "View Icon",
									action: () => Us(Rt.getChannelIconURL(t)),
									icon: tn,
								})
							)
						);
				}),
				(kf = h({
					name: "ViewIcons",
					authors: [d.Ven, d.TheKodeToad, d.Nuckyz, d.nyx],
					description:
						"Makes avatars and banners in user profiles clickable, adds View Icon/Banner entries in the user, server and group channel context menu.",
					tags: ["ImageUtilities"],
					settings: C0,
					openImage: Us,
					contextMenus: {
						"user-context": T8,
						"guild-context": x8,
						"gdm-context": w8,
					},
					patches: [
						{
							find: ".overlay:void 0,status:",
							replacement: {
								match: /avatarSrc:(\i),eventHandlers:(\i).+?"div",{...\2,/,
								replace:
									'$&style:{cursor:"pointer"},onClick:()=>{$self.openImage($1)},',
							},
							all: !0,
						},
						{
							find: 'backgroundColor:"COMPLETE"',
							replacement: {
								match:
									/(\.banner,.+?),style:{(?=.+?backgroundImage:null!=(\i)\?"url\("\.concat\(\2,)/,
								replace: (e, t, o) =>
									`${t},onClick:()=>${o}!=null&&$self.openImage(${o}),style:{cursor:${o}!=null?"pointer":void 0,`,
							},
						},
						{
							find: /\.recipients\.length>=2(?!<isMultiUserDM.{0,50})/,
							replacement: {
								match: /null==\i\.icon\?.+?src:(\(0,\i\.\i\).+?\))(?=[,}])/,
								replace: (e, t) => `${e},onClick:()=>$self.openImage(${t})`,
							},
						},
						{
							find: ".cursorPointer:null,children",
							replacement: {
								match: /.Avatar,.+?src:(.+?\))(?=[,}])/,
								replace: (e, t) => `${e},onClick:()=>$self.openImage(${t})`,
							},
						},
						{
							find: 'experimentLocation:"empty_messages"',
							replacement: {
								match: /.Avatar,.+?src:(.+?\))(?=[,}])/,
								replace: (e, t) => `${e},onClick:()=>$self.openImage(${t})`,
							},
						},
					],
				}));
		});
	function P8(e) {
		return Object.fromEntries(
			Object.entries(e).sort(([t], [o]) => t.localeCompare(o))
		);
	}
	function M8(e) {
		let t = P8(JSON.parse(JSON.stringify(e)));
		for (let r of ["email", "phone", "mfaEnabled", "personalConnectionId"])
			delete t.author[r];
		let o = t;
		return (
			delete o.editHistory,
			delete o.deleted,
			delete o.firstEditTimestamp,
			o.attachments?.forEach((r) => delete r.deleted),
			t
		);
	}
	function GA(e, t, o) {
		let r = ge((i) =>
			n(
				R,
				null,
				n(
					Te,
					{ ...i, size: "large" },
					n(
						Ee,
						null,
						n(
							Z,
							{ variant: "heading-lg/semibold", style: { flexGrow: 1 } },
							"View Raw"
						),
						n(rt, { onClick: () => Dn(r) })
					),
					n(
						Ae,
						null,
						n(
							"div",
							{ style: { padding: "16px 0" } },
							!!o &&
								n(
									f,
									null,
									n(S.FormTitle, { tag: "h5" }, "Content"),
									n(ba, { content: o, lang: "" }),
									n(S.FormDivider, { className: G.bottom20 })
								),
							n(S.FormTitle, { tag: "h5" }, t, " Data"),
							n(ba, { content: e, lang: "json" })
						)
					),
					n(
						ht,
						null,
						n(
							pe,
							{ cellSpacing: 10 },
							n(
								M,
								{ onClick: () => Kt(e, `${t} data copied to clipboard!`) },
								"Copy ",
								t,
								" JSON"
							),
							!!o &&
								n(
									M,
									{ onClick: () => Kt(o, "Content copied to clipboard!") },
									"Copy Raw Content"
								)
						)
					)
				)
			)
		);
	}
	function UA(e) {
		e = M8(e);
		let t = JSON.stringify(e, null, 4);
		return GA(t, "Message", e.content);
	}
	function Lf(e) {
		return (t, o) => {
			let r = o[e.toLowerCase()];
			if (!r || o.label === Se.Messages.CHANNEL_ACTIONS_MENU_LABEL) return;
			let i = t.at(-1);
			if (i?.key === "developer-actions") {
				let s = i.props;
				Array.isArray(s.children) || (s.children = [s.children]),
					(t = s.children);
			}
			t.splice(
				-1,
				0,
				n(E.MenuItem, {
					id: `vc-view-${e.toLowerCase()}-raw`,
					label: "View Raw",
					action: () => GA(JSON.stringify(r, null, 4), e),
					icon: $A,
				})
			);
		};
	}
	var $A,
		Df,
		Ef,
		HA = g(() => {
			"use strict";
			a();
			bs();
			F();
			wc();
			re();
			kt();
			P();
			Ye();
			me();
			Ke();
			T();
			b();
			$A = () =>
				n(
					"svg",
					{
						viewBox: "0 0 20 20",
						fill: "currentColor",
						"aria-hidden": "true",
						width: "18",
						height: "18",
					},
					n("path", {
						d: "M12.9297 3.25007C12.7343 3.05261 12.4154 3.05226 12.2196 3.24928L11.5746 3.89824C11.3811 4.09297 11.3808 4.40733 11.5739 4.60245L16.5685 9.64824C16.7614 9.84309 16.7614 10.1569 16.5685 10.3517L11.5739 15.3975C11.3808 15.5927 11.3811 15.907 11.5746 16.1017L12.2196 16.7507C12.4154 16.9477 12.7343 16.9474 12.9297 16.7499L19.2604 10.3517C19.4532 10.1568 19.4532 9.84314 19.2604 9.64832L12.9297 3.25007Z",
					}),
					n("path", {
						d: "M8.42616 4.60245C8.6193 4.40733 8.61898 4.09297 8.42545 3.89824L7.78047 3.24928C7.58466 3.05226 7.26578 3.05261 7.07041 3.25007L0.739669 9.64832C0.5469 9.84314 0.546901 10.1568 0.739669 10.3517L7.07041 16.7499C7.26578 16.9474 7.58465 16.9477 7.78047 16.7507L8.42545 16.1017C8.61898 15.907 8.6193 15.5927 8.42616 15.3975L3.43155 10.3517C3.23869 10.1569 3.23869 9.84309 3.43155 9.64824L8.42616 4.60245Z",
					})
				);
			Df = x({
				clickMethod: {
					description:
						"Change the button to view the raw content/data of any message.",
					type: 4,
					options: [
						{
							label: "Left Click to view the raw content.",
							value: "Left",
							default: !0,
						},
						{ label: "Right click to view the raw content.", value: "Right" },
					],
				},
			});
			Ef = h({
				name: "ViewRaw",
				description:
					"Copy and view the raw content/data of any message, channel or guild",
				authors: [d.KingFish, d.Ven, d.rad, d.ImLvna],
				dependencies: ["MessagePopoverAPI"],
				settings: Df,
				contextMenus: {
					"guild-context": Lf("Guild"),
					"channel-context": Lf("Channel"),
					"thread-context": Lf("Channel"),
					"user-context": Lf("User"),
				},
				start() {
					Qn("ViewRaw", (e) => {
						let t = () => {
								Df.store.clickMethod === "Right" ? Kt(e.content) : UA(e);
							},
							o = (i) => {
								Df.store.clickMethod === "Left"
									? (i.preventDefault(), i.stopPropagation(), Kt(e.content))
									: (i.preventDefault(), i.stopPropagation(), UA(e));
							};
						return {
							label:
								Df.store.clickMethod === "Right"
									? "Copy Raw (Left Click) / View Raw (Right Click)"
									: "View Raw (Left Click) / Copy Raw (Right Click)",
							icon: $A,
							message: e,
							channel: oe.getChannel(e.channel_id),
							onClick: t,
							onContextMenu: o,
						};
					});
				},
				stop() {
					Xn("ViewRaw");
				},
			});
		});
	var zA = g(() => {});
	var Of,
		WA = g(() => {
			"use strict";
			a();
			zA();
			P();
			T();
			Of = h({
				name: "VoiceDownload",
				description:
					"Adds a download to voice messages. (Opens a new browser tab)",
				authors: [d.puv],
				patches: [
					{
						find: "rippleContainer,children",
						replacement: {
							match:
								/\(0,\i\.jsx\).{0,150},children:.{0,50}\("source",{src:(\i)}\)}\)/,
							replace: "[$&, $self.renderDownload($1)]",
						},
					},
				],
				renderDownload(e) {
					return n(
						"a",
						{
							className: "vc-voice-download",
							href: e,
							onClick: (t) => t.stopPropagation(),
							"aria-label": "Download voice message",
							download: "voice-message.ogg",
						},
						n(this.Icon, null)
					);
				},
				Icon: () =>
					n(
						"svg",
						{
							height: "24",
							width: "24",
							viewBox: "0 0 24 24",
							fill: "currentColor",
						},
						n("path", {
							d: "M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1ZM3 20a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z",
						})
					),
			});
		});
	var jA = g(() => {});
	var $s,
		Ff = g(() => {
			"use strict";
			a();
			F();
			T();
			$s = x({
				noiseSuppression: {
					type: 3,
					description: "Noise Suppression",
					default: !0,
				},
				echoCancellation: {
					type: 3,
					description: "Echo Cancellation",
					default: !0,
				},
			});
		});
	var A0,
		Ur,
		Gl = g(() => {
			"use strict";
			a();
			tt();
			U();
			(A0 = K("MediaEngineStore")), (Ur = be("vc-vmsg-"));
		});
	var MTe,
		qA = g(() => {
			"use strict";
			a();
			b();
			Ff();
			Gl();
			MTe = VencordNative.pluginHelpers.VoiceMessages;
		});
	var I8,
		KA,
		YA = g(() => {
			"use strict";
			a();
			ct();
			U();
			Gl();
			(I8 = ae("waveform:", "onVolumeChange")),
				(KA = ({ src: e, waveform: t, recording: o }) => {
					let r = oa({ deps: [o] }),
						i = o ? Math.floor(r / 1e3) : 0,
						s = Math.floor(i / 60) + ":" + (i % 60).toString().padStart(2, "0");
					return e && !o
						? n(I8, { key: e, src: e, waveform: t })
						: n(
								"div",
								{ className: Ur("preview", o ? "preview-recording" : []) },
								n("div", { className: Ur("preview-indicator") }),
								n("div", { className: Ur("preview-time") }, s),
								n(
									"div",
									{ className: Ur("preview-label") },
									o ? "RECORDING" : "----"
								)
							);
				});
		});
	var ZA,
		QA = g(() => {
			"use strict";
			a();
			b();
			Ff();
			Gl();
			ZA = ({ setAudioBlob: e, onRecordingChange: t }) => {
				let [o, r] = z(!1),
					[i, s] = z(!1),
					[l, c] = z(),
					[u, p] = z([]),
					m = (v) => {
						r(v), t?.(v);
					};
				function y() {
					!o
						? navigator.mediaDevices
								.getUserMedia({
									audio: {
										echoCancellation: $s.store.echoCancellation,
										noiseSuppression: $s.store.noiseSuppression,
										deviceId: A0.getInputDeviceId(),
									},
								})
								.then((N) => {
									let w = [];
									p(w);
									let I = new MediaRecorder(N);
									c(I),
										I.addEventListener("dataavailable", (A) => {
											w.push(A.data);
										}),
										I.start(),
										m(!0);
								})
						: l &&
							(l.addEventListener("stop", () => {
								e(new Blob(u, { type: "audio/ogg; codecs=opus" })), m(!1);
							}),
							l.stop());
				}
				return n(
					f,
					null,
					n(M, { onClick: y }, o ? "Stop" : "Start", " recording"),
					n(
						M,
						{
							disabled: !o,
							onClick: () => {
								s(!i), i ? l?.resume() : l?.pause();
							},
						},
						i ? "Resume" : "Pause",
						" recording"
					)
				);
			};
		});
	function k8(e, t) {
		let o = xe.getChannelId(),
			r = A8.getPendingReply(o);
		r && _.dispatch({ type: "DELETE_PENDING_REPLY", channelId: o });
		let i = new C8(
			{
				file: new File([e], "voice-message.ogg", {
					type: "audio/ogg; codecs=opus",
				}),
				isThumbnail: !1,
				platform: 1,
			},
			o,
			!1,
			0
		);
		i.on("complete", () => {
			Pt.post({
				url: bt.Endpoints.MESSAGES(o),
				body: {
					flags: 1 << 13,
					channel_id: o,
					content: "",
					nonce: Po.fromTimestamp(Date.now()),
					sticker_ids: [],
					type: 0,
					attachments: [
						{
							id: "0",
							filename: i.filename,
							uploaded_filename: i.uploadedFilename,
							waveform: t.waveform,
							duration_secs: t.duration,
						},
					],
					message_reference: r
						? Mo.getSendMessageOptionsForReply(r)?.messageReference
						: null,
				},
			});
		}),
			i.on("error", () => ft("Failed to upload voice message", X.Type.FAILURE)),
			i.upload();
	}
	function D8() {
		let [e, t] = z();
		return [
			e,
			(r) => {
				e && URL.revokeObjectURL(e), t(URL.createObjectURL(r));
			},
		];
	}
	function L8({ modalProps: e }) {
		let [t, o] = z(!1),
			[r, i] = z(),
			[s, l] = D8();
		ue(
			() => () => {
				s && URL.revokeObjectURL(s);
			},
			[s]
		);
		let [c] = pt(
				async () => {
					if (!r) return XA;
					let m = await new AudioContext().decodeAudioData(
							await r.arrayBuffer()
						),
						y = m.getChannelData(0),
						v = new Uint8Array(
							ni.clamp(Math.floor(m.duration * 10), Math.min(32, y.length), 256)
						),
						N = Math.floor(y.length / v.length);
					for (let A = 0; A < v.length; A++) {
						let L = 0;
						for (let k = 0; k < N; k++) {
							let $ = A * N + k;
							L += y[$] ** 2;
						}
						v[A] = ~~(Math.sqrt(L / N) * 255);
					}
					let w = Math.max(...v),
						I = 1 + (255 / w - 1) * Math.min(1, 100 * (w / 255) ** 3);
					for (let A = 0; A < v.length; A++) v[A] = Math.min(255, ~~(v[A] * I));
					return {
						waveform: window.btoa(String.fromCharCode(...v)),
						duration: m.duration,
					};
				},
				{ deps: [r], fallbackValue: XA }
			),
			u =
				r &&
				(!r.type.startsWith("audio/ogg") ||
					(r.type.includes("codecs") && !r.type.includes("opus")));
		return n(
			Te,
			{ ...e },
			n(Ee, null, n(S.FormTitle, null, "Record Voice Message")),
			n(
				Ae,
				{ className: Ur("modal") },
				n(
					"div",
					{ className: Ur("buttons") },
					n(N8, {
						setAudioBlob: (p) => {
							i(p), l(p);
						},
						onRecordingChange: o,
					}),
					n(
						M,
						{
							onClick: async () => {
								let p = await Oc("audio/*");
								p && (i(p), l(p));
							},
						},
						"Upload File"
					)
				),
				n(S.FormTitle, null, "Preview"),
				n(KA, { src: s, waveform: c.waveform, recording: t }),
				u &&
					n(
						Nt,
						{ className: `vc-plugins-restart-card ${G.top16}` },
						n(
							S.FormText,
							null,
							"Voice Messages have to be OggOpus to be playable on iOS. This file is ",
							n("code", null, r.type),
							" so it will not be playable on iOS."
						),
						n(
							S.FormText,
							{ className: G.top8 },
							"To fix it, first convert it to OggOpus, for example using the ",
							n(
								He,
								{ href: "https://convertio.co/mp3-opus/" },
								"convertio web converter"
							)
						)
					)
			),
			n(
				ht,
				null,
				n(
					M,
					{
						disabled: !r,
						onClick: () => {
							k8(r, c),
								e.onClose(),
								ft(
									"Now sending voice message... Please be patient",
									X.Type.MESSAGE
								);
						},
					},
					"Send"
				)
			)
		);
	}
	var C8,
		A8,
		N0,
		N8,
		R8,
		_f,
		XA,
		JA = g(() => {
			"use strict";
			a();
			jA();
			yt();
			no();
			P();
			Ye();
			Ke();
			ct();
			T();
			Fc();
			U();
			b();
			qA();
			Ff();
			Gl();
			YA();
			QA();
			(C8 = _e((e) => e.prototype?.trackUploadFinished)),
				(A8 = K("PendingReplyStore")),
				(N0 = C("optionName", "optionIcon", "optionLabel")),
				(N8 = ZA),
				(R8 = (e, t) => {
					(t.channel.guild_id &&
						!(
							qe.can(we.SEND_VOICE_MESSAGES, t.channel) &&
							qe.can(we.SEND_MESSAGES, t.channel)
						)) ||
						e.push(
							n(E.MenuItem, {
								id: "vc-send-vmsg",
								label: n(
									"div",
									{ className: N0.optionLabel },
									n(Ag, { className: N0.optionIcon, height: 24, width: 24 }),
									n("div", { className: N0.optionName }, "Send voice message")
								),
								action: () => ge((o) => n(L8, { modalProps: o })),
							})
						);
				}),
				(_f = h({
					name: "VoiceMessages",
					description:
						"Allows you to send voice messages like on mobile. To do so, right click the upload button and click Send Voice Message",
					authors: [d.Ven, d.Vap, d.Nickyux],
					settings: $s,
					contextMenus: { "channel-attach": R8 },
				})),
				(XA = { waveform: "AAAAAAAAAAAA", duration: 1 });
		});
	async function E8(e) {
		let t = await fetch(e);
		if (t.status === 200) return await t.blob();
	}
	function eN(e) {
		let t = new URL(e);
		return t.host === VA
			? e
			: (t.searchParams.delete("width"),
				t.searchParams.delete("height"),
				t.origin === O8
					? ((t.host = VA),
						t.searchParams.delete("size"),
						t.searchParams.delete("quality"),
						t.searchParams.delete("format"))
					: t.searchParams.set("quality", "lossless"),
				t.toString());
	}
	var Bf,
		Li,
		O8,
		VA,
		Uf,
		tN = g(() => {
			"use strict";
			a();
			F();
			P();
			T();
			Fc();
			U();
			b();
			Bf = C("contextMenuCallbackNative");
			(Li = x({
				addBack: {
					type: 3,
					description:
						"Add back the Discord context menus for images, links and the chat input bar",
					default: !1,
					restartNeeded: !0,
				},
			})),
				(O8 = "https://media.discordapp.net"),
				(VA = "cdn.discordapp.com");
			Uf = h({
				name: "WebContextMenus",
				description:
					"Re-adds context menus missing in the web version of Discord: Links & Images (Copy/Open Link/Image), Text Area (Copy, Cut, Paste, SpellCheck)",
				authors: [d.Ven],
				enabledByDefault: !0,
				required: !1,
				settings: Li,
				start() {
					Li.store.addBack &&
						(window.removeEventListener(
							"contextmenu",
							Bf.contextMenuCallbackWeb
						),
						window.addEventListener(
							"contextmenu",
							Bf.contextMenuCallbackNative
						),
						(this.changedListeners = !0));
				},
				stop() {
					this.changedListeners &&
						(window.removeEventListener(
							"contextmenu",
							Bf.contextMenuCallbackNative
						),
						window.addEventListener("contextmenu", Bf.contextMenuCallbackWeb));
				},
				patches: [
					{
						find: "open-native-link",
						replacement: [
							{ match: /if\(!\i\.\i\|\|null==/, replace: "if(null==" },
							{
								match: /\i\.\i\.copy/,
								replace: "Vencord.Webpack.Common.Clipboard.copy",
							},
						],
					},
					{
						find: 'id:"copy-image"',
						replacement: [
							{ match: /!\i\.isPlatformEmbedded/, replace: "false" },
							{
								match: /return\s*?\[\i\.\i\.canCopyImage\(\)/,
								replace: "return [true",
							},
							{
								match: /(?<=COPY_IMAGE_MENU_ITEM,)action:/,
								replace: "action:()=>$self.copyImage(arguments[0]),oldAction:",
							},
							{
								match: /(?<=SAVE_IMAGE_MENU_ITEM,)action:/,
								replace: "action:()=>$self.saveImage(arguments[0]),oldAction:",
							},
						],
					},
					{
						find: 'navId:"image-context"',
						all: !0,
						predicate: () => Li.store.addBack,
						replacement: {
							match: /return \i\.\i(?=\?|&&)/,
							replace: "return true",
						},
					},
					{
						find: '"interactionUsernameProfile"',
						predicate: () => Li.store.addBack,
						replacement: {
							match: /if\((?="A"===\i\.tagName&&""!==\i\.textContent)/,
							replace: "if(false&&",
						},
					},
					{
						find: 'getElementById("slate-toolbar"',
						predicate: () => Li.store.addBack,
						replacement: {
							match:
								/(?<=handleContextMenu\(\i\)\{.{0,200}isPlatformEmbedded)\?/,
							replace: "||true?",
						},
					},
					{
						find: ".SLASH_COMMAND_SUGGESTIONS_TOGGLED,{",
						predicate: () => Li.store.addBack,
						replacement: [
							{ match: /if\(!\i\.\i\)return null;/, replace: "" },
							{ match: /\b\i\.\i\.(copy|cut|paste)/g, replace: "$self.$1" },
						],
					},
					{
						find: '"add-to-dictionary"',
						predicate: () => Li.store.addBack,
						replacement: {
							match: /let\{text:\i=""/,
							replace: "return [null,null];$&",
						},
					},
					{
						find: '"MediaEngineWebRTC");',
						replacement: {
							match: /supports\(\i\)\{switch\(\i\)\{(case (\i).\i)/,
							replace: "$&.DISABLE_VIDEO:return true;$1",
						},
					},
					{
						find: ".Messages.SEARCH_WITH_GOOGLE",
						replacement: { match: /\i\.isPlatformEmbedded/, replace: "true" },
					},
					{
						find: ".Messages.COPY,hint:",
						replacement: [
							{ match: /\i\.isPlatformEmbedded/, replace: "true" },
							{
								match: /\i\.\i\.copy/,
								replace: "Vencord.Webpack.Common.Clipboard.copy",
							},
						],
					},
					{
						find: '("interactionUsernameProfile',
						replacement: {
							match: /\i\.isPlatformEmbedded(?=.{0,50}\.tagName)/,
							replace: "true",
						},
					},
				],
				async copyImage(e) {
					e = eN(e);
					let t = await fetch(e).then((o) => o.blob());
					if (t.type !== "image/png") {
						let o = await createImageBitmap(t),
							r = document.createElement("canvas");
						(r.width = o.width),
							(r.height = o.height),
							r.getContext("2d").drawImage(o, 0, 0),
							await new Promise((i) => {
								r.toBlob((s) => {
									(t = s), i();
								}, "image/png");
							});
					}
					navigator.clipboard.write([new ClipboardItem({ "image/png": t })]);
				},
				async saveImage(e) {
					e = eN(e);
					let t = await E8(e);
					if (!t) return;
					let o = new URL(e).pathname.split("/").pop(),
						r = new File([t], o, { type: t.type });
					Ec(r);
				},
				copy() {
					let e = document.getSelection();
					!e || Gt.copy(e.toString());
				},
				cut() {
					this.copy(), Vo.dispatch("INSERT_TEXT", { rawText: "" });
				},
				async paste() {
					let e = (await navigator.clipboard.read())[0];
					if (!e) return;
					let t = new DataTransfer();
					for (let o of e.types)
						if (o === "image/png") {
							let r = new File([await e.getType(o)], "unknown.png", {
								type: o,
							});
							t.items.add(r);
						} else if (o === "text/plain") {
							let r = await e.getType(o);
							t.setData(o, await r.text());
						}
					document.dispatchEvent(
						new ClipboardEvent("paste", { clipboardData: t })
					);
				},
			});
		});
	var R0,
		$f,
		oN = g(() => {
			"use strict";
			a();
			P();
			T();
			U();
			b();
			(R0 = C("JUMP_TO_GUILD", "SERVER_NEXT")),
				($f = h({
					name: "WebKeybinds",
					description:
						"Re-adds keybinds missing in the web version of Discord: ctrl+t, ctrl+shift+t, ctrl+tab, ctrl+shift+tab, ctrl+1-9, ctrl+,. Only works fully on Vesktop/ArmCord, not inside your browser",
					authors: [d.Ven],
					enabledByDefault: !0,
					onKey(e) {
						if (e.ctrlKey || (e.metaKey && navigator.platform.includes("Mac")))
							switch (e.key) {
								case "t":
								case "T":
									return;
								case "Tab":
									return;
								case ",":
									e.preventDefault(), ca.open("My Account");
									break;
								default:
									e.key >= "1" &&
										e.key <= "9" &&
										(e.preventDefault(),
										R0.JUMP_TO_GUILD.action(e, `mod+${e.key}`));
									break;
							}
					},
					start() {
						document.addEventListener("keydown", this.onKey);
					},
					stop() {
						document.removeEventListener("keydown", this.onKey);
					},
				}));
		});
	var Gf,
		nN = g(() => {
			"use strict";
			a();
			P();
			T();
			Gf = h({
				name: "WebScreenShareFixes",
				authors: [d.Kaitlyn],
				description:
					"Removes 2500kbps bitrate cap on chromium and vesktop clients.",
				enabledByDefault: !0,
				patches: [
					{
						find: "x-google-max-bitrate",
						replacement: [
							{
								match: /"x-google-max-bitrate=".concat\(\i\)/,
								replace: '"x-google-max-bitrate=".concat("80_000")',
							},
							{
								match: /;level-asymmetry-allowed=1/,
								replace: ";b=AS:800000;level-asymmetry-allowed=1",
							},
						],
					},
				],
			});
		});
	function U8(e, t, o) {
		let r = t.name + (t.id ? `:${t.id}` : "");
		return Pt.get({
			url: bt.Endpoints.REACTIONS(e.channel_id, e.id, r),
			query: { limit: 100, type: o },
			oldFormErrors: !0,
		})
			.then((i) => {
				for (let s of i.body) _.dispatch({ type: "USER_UPDATE", user: s });
				_.dispatch({
					type: "MESSAGE_REACTION_ADD_USERS",
					channelId: e.channel_id,
					messageId: e.id,
					users: i.body,
					emoji: t,
					reactionType: o,
				});
			})
			.catch(console.error)
			.finally(() => Xo(250));
	}
	function $8(e, t, o) {
		let r = `${e.id}:${t.name}:${t.id ?? ""}:${o}`,
			i = (rN[r] ??= { fetched: !1, users: {} });
		return (
			i.fetched || (B8.unshift(() => U8(e, t, o)), (i.fetched = !0)), i.users
		);
	}
	function G8(e) {
		return function (o, r) {
			return n(
				te,
				{
					text: e
						.slice(4)
						.map((i) => i.username)
						.join(", "),
				},
				({ onMouseEnter: i, onMouseLeave: s }) =>
					n(
						"div",
						{ className: _8.moreUsers, onMouseEnter: i, onMouseLeave: s },
						"+",
						e.length - 4
					)
			);
		};
	}
	function H8(e) {
		e.stopPropagation();
	}
	var F8,
		_8,
		k0,
		B8,
		rN,
		Hf,
		iN = g(() => {
			"use strict";
			a();
			re();
			P();
			me();
			di();
			ct();
			T();
			U();
			b();
			(F8 = ae("defaultRenderUser", "showDefaultAvatarsForNullUsers")),
				(_8 = C(
					"moreUsers",
					"emptyUser",
					"avatarContainer",
					"clickableAvatar"
				)),
				(k0 = null),
				(B8 = new Oo());
			Hf = h({
				name: "WhoReacted",
				description: "Renders the avatars of users who reacted to a message",
				authors: [d.Ven, d.KannaDev, d.newwares],
				patches: [
					{
						find: ",reactionRef:",
						replacement: {
							match:
								/(\i)\?null:\(0,\i\.jsx\)\(\i\.\i,{className:\i\.reactionCount,.*?}\),/,
							replace: "$&$1?null:$self.renderUsers(this.props),",
						},
					},
					{
						find: '"MessageReactionsStore"',
						replacement: {
							match: /(?<=CONNECTION_OPEN:function\(\){)(\i)={}/,
							replace: "$&;$self.reactions=$1",
						},
					},
					{
						find: "cleanAutomaticAnchor(){",
						replacement: {
							match: /constructor\(\i\)\{(?=.{0,100}automaticAnchor)/,
							replace: "$&$self.setScrollObj(this);",
						},
					},
				],
				setScrollObj(e) {
					k0 = e;
				},
				renderUsers(e) {
					return e.message.reactions.length > 10
						? null
						: n(R, { noop: !0 }, n(this._renderUsers, { ...e }));
				},
				_renderUsers({ message: e, emoji: t, type: o }) {
					let r = Wo();
					q.useLayoutEffect(() => {
						k0?.scrollCounter > 0 && k0.setAutomaticAnchor(null);
					}),
						q.useEffect(() => {
							let l = (c) => {
								c.messageId === e.id && r();
							};
							return (
								_.subscribe("MESSAGE_REACTION_ADD_USERS", l),
								() => _.unsubscribe("MESSAGE_REACTION_ADD_USERS", l)
							);
						}, [e.id]);
					let i = $8(e, t, o),
						s = Object.values(i).filter(Boolean);
					return n(
						"div",
						{ style: { marginLeft: "0.5em", transform: "scale(0.9)" } },
						n(
							"div",
							{ onClick: H8 },
							n(F8, {
								users: s,
								guildId: oe.getChannel(e.channel_id)?.guild_id,
								renderIcon: !1,
								max: 5,
								showDefaultAvatarsForNullUsers: !0,
								showUserPopout: !0,
								renderMoreUsers: G8(s),
							})
						)
					);
				},
				set reactions(e) {
					rN = e;
				},
			});
		});
	async function D0() {
		return (
			ur && ur.close(),
			(ur = new WebSocket(
				`ws://127.0.0.1:${_t.store.webSocketPort ?? 42070}/?client=Vencord`
			)),
			new Promise((e, t) => {
				(ur.onopen = e), (ur.onerror = t), setTimeout(t, 3e3);
			})
		);
	}
	function W8(e) {
		return (e.type === zf.DM && _t.store.dmNotifications) ||
			(e.type === zf.GROUP_DM && _t.store.groupDmNotifications)
			? !1
			: !_t.store.serverNotifications;
	}
	function j8(e, t, o) {
		fetch(
			`https://cdn.discordapp.com/avatars/${o.author.id}/${o.author.avatar}.png?size=128`
		)
			.then((r) => r.arrayBuffer())
			.then((r) => {
				let i = {
					type: 1,
					timeout: _t.store.lengthBasedTimeout ? cN(t) : _t.store.timeout,
					height: lN(t),
					opacity: _t.store.opacity,
					volume: _t.store.volume,
					audioPath: _t.store.soundPath,
					title: e,
					content: t,
					useBase64Icon: !0,
					icon: new TextDecoder().decode(r),
					sourceApp: "Vencord",
				};
				aN(i);
			});
	}
	function sN(e, t) {
		let o = {
			type: 1,
			timeout: _t.store.lengthBasedTimeout ? cN(e) : _t.store.timeout,
			height: lN(e),
			opacity: _t.store.opacity,
			volume: _t.store.volume,
			audioPath: _t.store.soundPath,
			title: t,
			content: e,
			useBase64Icon: !1,
			icon: "default",
			sourceApp: "Vencord",
		};
		aN(o);
	}
	async function aN(e) {
		let t = {
			sender: "Vencord",
			target: "xsoverlay",
			command: "SendNotification",
			jsonData: JSON.stringify(e),
			rawData: null,
		};
		ur.readyState !== ur.OPEN && (await D0()), ur.send(JSON.stringify(t));
	}
	function q8(e, t) {
		let o = D.getCurrentUser();
		return e.author.id === o.id || (e.author.bot && !_t.store.botNotifications)
			? !1
			: z8(e, t);
	}
	function lN(e) {
		return e.length <= 100
			? 100
			: e.length <= 200
				? 150
				: e.length <= 300
					? 200
					: 250;
	}
	function cN(e) {
		return e.length <= 100 ? 3 : e.length <= 200 ? 4 : e.length <= 300 ? 5 : 6;
	}
	var zf,
		z8,
		_t,
		ur,
		Uxe,
		Wf,
		uN = g(() => {
			"use strict";
			a();
			F();
			ns();
			P();
			T();
			U();
			b();
			(zf = _e((e) => e.ANNOUNCEMENT_THREAD === 10)),
				(z8 = fe(".SUPPRESS_NOTIFICATIONS))return!1")),
				(_t = x({
					webSocketPort: {
						type: 1,
						description: "Websocket port",
						default: 42070,
						async onChange() {
							await D0();
						},
					},
					preferUDP: {
						type: 3,
						description:
							"Enable if you use an older build of XSOverlay unable to connect through websockets. This setting is ignored on web.",
						default: !1,
						disabled: () => !0,
					},
					botNotifications: {
						type: 3,
						description: "Allow bot notifications",
						default: !1,
					},
					serverNotifications: {
						type: 3,
						description: "Allow server notifications",
						default: !0,
					},
					dmNotifications: {
						type: 3,
						description: "Allow Direct Message notifications",
						default: !0,
					},
					groupDmNotifications: {
						type: 3,
						description: "Allow Group DM notifications",
						default: !0,
					},
					callNotifications: {
						type: 3,
						description: "Allow call notifications",
						default: !0,
					},
					pingColor: {
						type: 0,
						description: "User mention color",
						default: "#7289da",
					},
					channelPingColor: {
						type: 0,
						description: "Channel mention color",
						default: "#8a2be2",
					},
					soundPath: {
						type: 0,
						description: "Notification sound (default/warning/error)",
						default: "default",
					},
					timeout: {
						type: 1,
						description: "Notification duration (secs)",
						default: 3,
					},
					lengthBasedTimeout: {
						type: 3,
						description: "Extend duration with message length",
						default: !0,
					},
					opacity: {
						type: 5,
						description: "Notif opacity",
						default: 1,
						markers: Bo(0, 1, 0.1),
					},
					volume: {
						type: 5,
						description: "Volume",
						default: 0.2,
						markers: Bo(0, 1, 0.1),
					},
				}));
			(Uxe = VencordNative.pluginHelpers.XSOverlay),
				(Wf = h({
					name: "XSOverlay",
					description:
						"Forwards discord notifications to XSOverlay, for easy viewing in VR",
					authors: [d.Nyako],
					tags: ["vr", "notify"],
					reporterTestable: 2,
					settings: _t,
					flux: {
						CALL_UPDATE({ call: e }) {
							if (
								e?.ringing?.includes(D.getCurrentUser().id) &&
								_t.store.callNotifications
							) {
								let t = oe.getChannel(e.channel_id);
								sN("Incoming call", `${t.name} is calling you...`);
							}
						},
						MESSAGE_CREATE({ message: e, optimistic: t }) {
							if (t) return;
							let o = oe.getChannel(e.channel_id);
							if (!q8(e, e.channel_id)) return;
							let r = _t.store.pingColor.replaceAll("#", "").trim(),
								i = _t.store.channelPingColor.replaceAll("#", "").trim(),
								s = e.content,
								l = "";
							if (o.guild_id) {
								let m = le.getGuild(o.guild_id);
								l = `${e.author.username} (${m.name}, #${o.name})`;
							}
							switch (o.type) {
								case zf.DM:
									l = e.author.username.trim();
									break;
								case zf.GROUP_DM:
									let m =
										o.name.trim() ??
										o.rawRecipients.map((y) => y.username).join(", ");
									l = `${e.author.username} (${m})`;
									break;
							}
							if (
								(e.referenced_message && (l += " (reply)"),
								e.embeds.length > 0 &&
									((s += " [embed] "),
									e.content === "" && (s = "sent message embed(s)")),
								e.sticker_items &&
									((s += " [sticker] "),
									e.content === "" && (s = "sent a sticker")),
								e.attachments
									.filter(
										(m) =>
											typeof m?.content_type == "string" &&
											m?.content_type.startsWith("image")
									)
									.forEach((m) => {
										s += ` [image: ${m.filename}] `;
									}),
								e.attachments
									.filter((m) => m && !m.content_type?.startsWith("image"))
									.forEach((m) => {
										s += ` [attachment: ${m.filename}] `;
									}),
								e.mentions.length > 0 &&
									(s = s.replace(
										/<@!?(\d{17,20})>/g,
										(m, y) =>
											`<color=#${r}><b>@${D.getUser(y)?.username || "unknown-user"}</color></b>`
									)),
								e.mention_roles.length > 0)
							)
								for (let m of e.mention_roles) {
									let y = le.getRole(o.guild_id, m);
									if (!y) continue;
									let v = y.colorString ?? `#${r}`;
									s = s.replace(
										`<@&${m}>`,
										`<b><color=${v}>@${y.name}</color></b>`
									);
								}
							let u = s.match(new RegExp("(<a?:\\w+:\\d+>)", "g")),
								p = s.match(new RegExp("<(#\\d+)>", "g"));
							if (u)
								for (let m of u)
									s = s.replace(
										new RegExp(`${m}`, "g"),
										`:${m.split(":")[1]}:`
									);
							if (p)
								for (let m of p) {
									let y = m.split("<#")[1];
									(y = y.substring(0, y.length - 1)),
										(s = s.replace(
											new RegExp(`${m}`, "g"),
											`<b><color=#${i}>#${oe.getChannel(y).name}</color></b>`
										));
								}
							W8(o) || j8(l, s, e);
						},
					},
					start: D0,
					stop() {
						ur.close();
					},
					settingsAboutComponent: () =>
						n(
							f,
							null,
							n(
								M,
								{
									onClick: () =>
										sN(
											"This is a test notification! explode",
											"Hello from Vendor!"
										),
								},
								"Send test notification"
							)
						),
				}));
		});
	var We,
		is,
		ZS,
		Hn = g(() => {
			a();
			XS();
			JS();
			VS();
			eb();
			tb();
			ob();
			nb();
			rb();
			ib();
			sb();
			ab();
			lb();
			cb();
			pb();
			_h();
			Lb();
			Eb();
			Ob();
			Fb();
			Ub();
			Gb();
			zh();
			Kb();
			Yb();
			Zb();
			Jb();
			Vb();
			S2();
			b2();
			T2();
			I2();
			N2();
			k2();
			O2();
			W2();
			j2();
			q2();
			Z2();
			X2();
			J2();
			eT();
			tT();
			lT();
			cT();
			pT();
			ET();
			OT();
			FT();
			$T();
			zT();
			WT();
			px();
			bx();
			Tx();
			Px();
			Mx();
			Ix();
			Cx();
			Rx();
			Ex();
			Ox();
			Ux();
			Hx();
			zx();
			Kx();
			Yx();
			H1();
			ew();
			ow();
			rw();
			aw();
			X1();
			fw();
			vw();
			bw();
			Mw();
			sy();
			Fw();
			_w();
			Bw();
			Gw();
			Hw();
			jw();
			Zw();
			Xw();
			Jw();
			Vw();
			eP();
			tP();
			nP();
			rP();
			iP();
			sP();
			aP();
			lP();
			cP();
			uP();
			pP();
			dP();
			mP();
			fP();
			gP();
			hP();
			yP();
			vP();
			xP();
			wP();
			PP();
			yl();
			OP();
			BP();
			Tl();
			aM();
			fM();
			SM();
			kM();
			DM();
			zM();
			WM();
			qM();
			iI();
			sI();
			uI();
			pI();
			fI();
			GI();
			HI();
			WI();
			jI();
			KI();
			XI();
			iC();
			pC();
			dC();
			yC();
			r0();
			PC();
			IC();
			RC();
			kC();
			DC();
			EC();
			a0();
			HC();
			zC();
			qC();
			YC();
			ZC();
			oA();
			nA();
			rA();
			fA();
			yA();
			S0();
			vA();
			SA();
			bA();
			MA();
			AA();
			NA();
			DA();
			LA();
			OA();
			_A();
			BA();
			HA();
			WA();
			JA();
			tN();
			oN();
			nN();
			iN();
			uN();
			(We = {
				[Jc.name]: Jc,
				[tu.name]: tu,
				[ou.name]: ou,
				[nu.name]: nu,
				[ru.name]: ru,
				[iu.name]: iu,
				[su.name]: su,
				[au.name]: au,
				[lu.name]: lu,
				[cu.name]: cu,
				[uu.name]: uu,
				[pu.name]: pu,
				[du.name]: du,
				[mu.name]: mu,
				[cs.name]: cs,
				[yu.name]: yu,
				[vu.name]: vu,
				[Su.name]: Su,
				[bu.name]: bu,
				[Tu.name]: Tu,
				[xu.name]: xu,
				[wu.name]: wu,
				[Pu.name]: Pu,
				[Mu.name]: Mu,
				[Cu.name]: Cu,
				[Au.name]: Au,
				[Nu.name]: Nu,
				[Ru.name]: Ru,
				[ku.name]: ku,
				[Du.name]: Du,
				[Lu.name]: Lu,
				[Eu.name]: Eu,
				[Ou.name]: Ou,
				[Fu.name]: Fu,
				[Uu.name]: Uu,
				[$u.name]: $u,
				[Gu.name]: Gu,
				[Hu.name]: Hu,
				[zu.name]: zu,
				[Wu.name]: Wu,
				[ju.name]: ju,
				[qu.name]: qu,
				[Yu.name]: Yu,
				[Zu.name]: Zu,
				[Qu.name]: Qu,
				[ip.name]: ip,
				[sp.name]: sp,
				[ap.name]: ap,
				[cp.name]: cp,
				[pp.name]: pp,
				[dp.name]: dp,
				[Tp.name]: Tp,
				[xp.name]: xp,
				[wp.name]: wp,
				[Pp.name]: Pp,
				[Mp.name]: Mp,
				[Ip.name]: Ip,
				[Cp.name]: Cp,
				[Ap.name]: Ap,
				[Np.name]: Np,
				[Rp.name]: Rp,
				[Dp.name]: Dp,
				[Ep.name]: Ep,
				[Op.name]: Op,
				[Fp.name]: Fp,
				[_p.name]: _p,
				[Bp.name]: Bp,
				[Up.name]: Up,
				[Gp.name]: Gp,
				[Hp.name]: Hp,
				[zp.name]: zp,
				[qp.name]: qp,
				[Kp.name]: Kp,
				[Yp.name]: Yp,
				[Zp.name]: Zp,
				[Jp.name]: Jp,
				[ed.name]: ed,
				[rd.name]: rd,
				[id.name]: id,
				[sd.name]: sd,
				[ad.name]: ad,
				[ld.name]: ld,
				[cd.name]: cd,
				[ud.name]: ud,
				[pd.name]: pd,
				[dd.name]: dd,
				[md.name]: md,
				[fd.name]: fd,
				[gd.name]: gd,
				[hd.name]: hd,
				[yd.name]: yd,
				[vd.name]: vd,
				[Sd.name]: Sd,
				[Td.name]: Td,
				[xd.name]: xd,
				[wd.name]: wd,
				[Pd.name]: Pd,
				[Md.name]: Md,
				[Id.name]: Id,
				[Cd.name]: Cd,
				[Ad.name]: Ad,
				[Nd.name]: Nd,
				[Rd.name]: Rd,
				[Dd.name]: Dd,
				[Ld.name]: Ld,
				[Ed.name]: Ed,
				[Od.name]: Od,
				[Fd.name]: Fd,
				[Hd.name]: Hd,
				[Wd.name]: Wd,
				[jd.name]: jd,
				[Qd.name]: Qd,
				[Xd.name]: Xd,
				[tm.name]: tm,
				[om.name]: om,
				[lm.name]: lm,
				[cm.name]: cm,
				[dm.name]: dm,
				[mm.name]: mm,
				[hm.name]: hm,
				[bm.name]: bm,
				[Tm.name]: Tm,
				[xm.name]: xm,
				[wm.name]: wm,
				[Mm.name]: Mm,
				[Dm.name]: Dm,
				[Lm.name]: Lm,
				[Em.name]: Em,
				[Om.name]: Om,
				[Fm.name]: Fm,
				[Bm.name]: Bm,
				[$m.name]: $m,
				[Gm.name]: Gm,
				[Hm.name]: Hm,
				[Wm.name]: Wm,
				[jm.name]: jm,
				[qm.name]: qm,
				[Km.name]: Km,
				[Ym.name]: Ym,
				[Zm.name]: Zm,
				[Qm.name]: Qm,
				[Xm.name]: Xm,
				[Vm.name]: Vm,
				[ef.name]: ef,
				[tf.name]: tf,
				[of.name]: of,
				[nf.name]: nf,
				[sf.name]: sf,
				[uf.name]: uf,
				[pf.name]: pf,
				[df.name]: df,
				[mf.name]: mf,
				[hf.name]: hf,
				[gf.name]: gf,
				[yf.name]: yf,
				[vf.name]: vf,
				[Sf.name]: Sf,
				[bf.name]: bf,
				[Tf.name]: Tf,
				[xf.name]: xf,
				[Pf.name]: Pf,
				[Mf.name]: Mf,
				[Nf.name]: Nf,
				[Rf.name]: Rf,
				[kf.name]: kf,
				[Ef.name]: Ef,
				[Of.name]: Of,
				[_f.name]: _f,
				[Uf.name]: Uf,
				[$f.name]: $f,
				[Gf.name]: Gf,
				[Hf.name]: Hf,
				[Wf.name]: Wf,
			}),
				(is = {
					[Jc.name]: { folderName: "_api/badges", userPlugin: !1 },
					[tu.name]: { folderName: "_api/chatButtons.ts", userPlugin: !1 },
					[ou.name]: { folderName: "_api/commands.ts", userPlugin: !1 },
					[nu.name]: { folderName: "_api/contextMenu.ts", userPlugin: !1 },
					[ru.name]: {
						folderName: "_api/memberListDecorators.ts",
						userPlugin: !1,
					},
					[iu.name]: {
						folderName: "_api/messageAccessories.ts",
						userPlugin: !1,
					},
					[su.name]: {
						folderName: "_api/messageDecorations.ts",
						userPlugin: !1,
					},
					[au.name]: { folderName: "_api/messageEvents.ts", userPlugin: !1 },
					[lu.name]: { folderName: "_api/messagePopover.ts", userPlugin: !1 },
					[cu.name]: { folderName: "_api/messageUpdater.ts", userPlugin: !1 },
					[uu.name]: { folderName: "_api/notices.ts", userPlugin: !1 },
					[pu.name]: { folderName: "_api/serverList.ts", userPlugin: !1 },
					[du.name]: { folderName: "_api/userSettings.ts", userPlugin: !1 },
					[mu.name]: { folderName: "_core/noTrack.ts", userPlugin: !1 },
					[cs.name]: { folderName: "_core/settings.tsx", userPlugin: !1 },
					[yu.name]: { folderName: "_core/supportHelper.tsx", userPlugin: !1 },
					[vu.name]: { folderName: "alwaysAnimate", userPlugin: !1 },
					[Su.name]: { folderName: "alwaysTrust", userPlugin: !1 },
					[bu.name]: { folderName: "anonymiseFileNames", userPlugin: !1 },
					[Tu.name]: { folderName: "arRPC.web", userPlugin: !1 },
					[xu.name]: { folderName: "banger", userPlugin: !1 },
					[wu.name]: { folderName: "betterFolders", userPlugin: !1 },
					[Pu.name]: { folderName: "betterGifAltText", userPlugin: !1 },
					[Mu.name]: { folderName: "betterGifPicker", userPlugin: !1 },
					[Cu.name]: { folderName: "betterNotes", userPlugin: !1 },
					[Au.name]: { folderName: "betterRoleContext", userPlugin: !1 },
					[Nu.name]: { folderName: "betterRoleDot", userPlugin: !1 },
					[Ru.name]: { folderName: "betterSessions", userPlugin: !1 },
					[ku.name]: { folderName: "betterSettings", userPlugin: !1 },
					[Du.name]: { folderName: "betterUploadButton", userPlugin: !1 },
					[Lu.name]: { folderName: "biggerStreamPreview", userPlugin: !1 },
					[Eu.name]: { folderName: "blurNsfw", userPlugin: !1 },
					[Ou.name]: { folderName: "callTimer", userPlugin: !1 },
					[Fu.name]: { folderName: "clearURLs", userPlugin: !1 },
					[Uu.name]: { folderName: "clientTheme", userPlugin: !1 },
					[$u.name]: { folderName: "colorSighted", userPlugin: !1 },
					[Gu.name]: { folderName: "consoleJanitor", userPlugin: !1 },
					[Hu.name]: { folderName: "consoleShortcuts", userPlugin: !1 },
					[zu.name]: { folderName: "copyEmojiMarkdown", userPlugin: !1 },
					[Wu.name]: { folderName: "copyUserURLs", userPlugin: !1 },
					[ju.name]: { folderName: "crashHandler", userPlugin: !1 },
					[qu.name]: { folderName: "ctrlEnterSend", userPlugin: !1 },
					[Yu.name]: { folderName: "customRPC", userPlugin: !1 },
					[Zu.name]: { folderName: "customidle", userPlugin: !1 },
					[Qu.name]: { folderName: "dearrow", userPlugin: !1 },
					[ip.name]: { folderName: "decor", userPlugin: !1 },
					[sp.name]: { folderName: "disableCallIdle", userPlugin: !1 },
					[ap.name]: { folderName: "dontRoundMyTimestamps", userPlugin: !1 },
					[cp.name]: { folderName: "emoteCloner", userPlugin: !1 },
					[pp.name]: { folderName: "experiments", userPlugin: !1 },
					[dp.name]: { folderName: "f8break", userPlugin: !1 },
					[Tp.name]: { folderName: "fakeNitro", userPlugin: !1 },
					[xp.name]: { folderName: "fakeProfileThemes", userPlugin: !1 },
					[wp.name]: { folderName: "favEmojiFirst", userPlugin: !1 },
					[Pp.name]: { folderName: "favGifSearch", userPlugin: !1 },
					[Mp.name]: { folderName: "fixCodeblockGap", userPlugin: !1 },
					[Ip.name]: { folderName: "forceOwnerCrown", userPlugin: !1 },
					[Cp.name]: { folderName: "friendInvites", userPlugin: !1 },
					[Ap.name]: { folderName: "friendsSince", userPlugin: !1 },
					[Np.name]: { folderName: "gameActivityToggle", userPlugin: !1 },
					[Rp.name]: { folderName: "gifPaste", userPlugin: !1 },
					[Dp.name]: { folderName: "greetStickerPicker", userPlugin: !1 },
					[Ep.name]: { folderName: "hideAttachments", userPlugin: !1 },
					[Op.name]: { folderName: "iLoveSpam", userPlugin: !1 },
					[Fp.name]: { folderName: "ignoreActivities", userPlugin: !1 },
					[_p.name]: { folderName: "imageLink", userPlugin: !1 },
					[Bp.name]: { folderName: "imageZoom", userPlugin: !1 },
					[Up.name]: { folderName: "implicitRelationships", userPlugin: !1 },
					[Gp.name]: { folderName: "keepCurrentChannel", userPlugin: !1 },
					[Hp.name]: { folderName: "lastfm", userPlugin: !1 },
					[zp.name]: { folderName: "loadingQuotes", userPlugin: !1 },
					[qp.name]: { folderName: "memberCount", userPlugin: !1 },
					[Kp.name]: { folderName: "mentionAvatars", userPlugin: !1 },
					[Yp.name]: { folderName: "messageClickActions", userPlugin: !1 },
					[Zp.name]: { folderName: "messageLatency", userPlugin: !1 },
					[Jp.name]: { folderName: "messageLinkEmbeds", userPlugin: !1 },
					[ed.name]: { folderName: "messageLogger", userPlugin: !1 },
					[rd.name]: { folderName: "messageTags", userPlugin: !1 },
					[id.name]: { folderName: "moreCommands", userPlugin: !1 },
					[sd.name]: { folderName: "moreKaomoji", userPlugin: !1 },
					[ad.name]: { folderName: "moreUserTags", userPlugin: !1 },
					[ld.name]: { folderName: "moyai", userPlugin: !1 },
					[cd.name]: { folderName: "mutualGroupDMs", userPlugin: !1 },
					[ud.name]: { folderName: "newGuildSettings", userPlugin: !1 },
					[pd.name]: { folderName: "noBlockedMessages", userPlugin: !1 },
					[dd.name]: { folderName: "noDefaultHangStatus", userPlugin: !1 },
					[md.name]: { folderName: "noDevtoolsWarning", userPlugin: !1 },
					[fd.name]: { folderName: "noF1", userPlugin: !1 },
					[gd.name]: { folderName: "noMaskedUrlPaste", userPlugin: !1 },
					[hd.name]: { folderName: "noMosaic", userPlugin: !1 },
					[yd.name]: { folderName: "noOnboardingDelay", userPlugin: !1 },
					[vd.name]: { folderName: "noPendingCount", userPlugin: !1 },
					[Sd.name]: { folderName: "noProfileThemes", userPlugin: !1 },
					[Td.name]: { folderName: "noReplyMention", userPlugin: !1 },
					[xd.name]: { folderName: "noScreensharePreview", userPlugin: !1 },
					[wd.name]: { folderName: "noServerEmojis", userPlugin: !1 },
					[Pd.name]: { folderName: "noTypingAnimation", userPlugin: !1 },
					[Md.name]: { folderName: "noUnblockToJump", userPlugin: !1 },
					[Id.name]: { folderName: "normalizeMessageLinks", userPlugin: !1 },
					[Cd.name]: { folderName: "notificationVolume", userPlugin: !1 },
					[Ad.name]: { folderName: "nsfwGateBypass", userPlugin: !1 },
					[Nd.name]: { folderName: "onePingPerDM", userPlugin: !1 },
					[Rd.name]: { folderName: "oneko", userPlugin: !1 },
					[Dd.name]: { folderName: "openInApp", userPlugin: !1 },
					[Ld.name]: { folderName: "overrideForumDefaults", userPlugin: !1 },
					[Ed.name]: { folderName: "partyMode", userPlugin: !1 },
					[Od.name]: { folderName: "pauseInvitesForever", userPlugin: !1 },
					[Fd.name]: { folderName: "permissionFreeWill", userPlugin: !1 },
					[Hd.name]: { folderName: "permissionsViewer", userPlugin: !1 },
					[Wd.name]: { folderName: "petpet", userPlugin: !1 },
					[jd.name]: { folderName: "pictureInPicture", userPlugin: !1 },
					[Qd.name]: { folderName: "pinDms", userPlugin: !1 },
					[Xd.name]: { folderName: "plainFolderIcon", userPlugin: !1 },
					[tm.name]: { folderName: "platformIndicators", userPlugin: !1 },
					[om.name]: { folderName: "previewMessage", userPlugin: !1 },
					[lm.name]: { folderName: "pronoundb", userPlugin: !1 },
					[cm.name]: { folderName: "quickMention", userPlugin: !1 },
					[dm.name]: { folderName: "quickReply", userPlugin: !1 },
					[mm.name]: { folderName: "reactErrorDecoder", userPlugin: !1 },
					[hm.name]: {
						folderName: "readAllNotificationsButton",
						userPlugin: !1,
					},
					[bm.name]: { folderName: "relationshipNotifier", userPlugin: !1 },
					[Tm.name]: { folderName: "replaceGoogleSearch", userPlugin: !1 },
					[xm.name]: { folderName: "replyTimestamp", userPlugin: !1 },
					[wm.name]: { folderName: "revealAllSpoilers", userPlugin: !1 },
					[Mm.name]: { folderName: "reverseImageSearch", userPlugin: !1 },
					[Dm.name]: { folderName: "reviewDB", userPlugin: !1 },
					[Lm.name]: { folderName: "roleColorEverywhere", userPlugin: !1 },
					[Em.name]: { folderName: "searchReply", userPlugin: !1 },
					[Om.name]: { folderName: "secretRingTone", userPlugin: !1 },
					[Fm.name]: { folderName: "seeSummaries", userPlugin: !1 },
					[Bm.name]: { folderName: "sendTimestamps", userPlugin: !1 },
					[$m.name]: { folderName: "serverInfo", userPlugin: !1 },
					[Gm.name]: { folderName: "serverListIndicators", userPlugin: !1 },
					[Hm.name]: { folderName: "showAllMessageButtons", userPlugin: !1 },
					[Wm.name]: { folderName: "showConnections", userPlugin: !1 },
					[jm.name]: { folderName: "showHiddenChannels", userPlugin: !1 },
					[qm.name]: { folderName: "showHiddenThings", userPlugin: !1 },
					[Km.name]: { folderName: "showMeYourName", userPlugin: !1 },
					[Ym.name]: { folderName: "showTimeoutDuration", userPlugin: !1 },
					[Zm.name]: { folderName: "silentMessageToggle", userPlugin: !1 },
					[Qm.name]: { folderName: "silentTyping", userPlugin: !1 },
					[Xm.name]: { folderName: "sortFriendRequests", userPlugin: !1 },
					[Vm.name]: { folderName: "spotifyControls", userPlugin: !1 },
					[ef.name]: { folderName: "spotifyCrack", userPlugin: !1 },
					[tf.name]: { folderName: "spotifyShareCommands", userPlugin: !1 },
					[of.name]: { folderName: "startupTimings", userPlugin: !1 },
					[nf.name]: { folderName: "streamerModeOnStream", userPlugin: !1 },
					[sf.name]: { folderName: "superReactionTweaks", userPlugin: !1 },
					[uf.name]: { folderName: "textReplace", userPlugin: !1 },
					[pf.name]: { folderName: "themeAttributes", userPlugin: !1 },
					[df.name]: { folderName: "timeBarAllActivities", userPlugin: !1 },
					[mf.name]: { folderName: "translate", userPlugin: !1 },
					[hf.name]: { folderName: "typingIndicator", userPlugin: !1 },
					[gf.name]: { folderName: "typingTweaks", userPlugin: !1 },
					[yf.name]: { folderName: "unindent", userPlugin: !1 },
					[vf.name]: { folderName: "unlockedAvatarZoom", userPlugin: !1 },
					[Sf.name]: { folderName: "unsuppressEmbeds", userPlugin: !1 },
					[bf.name]: { folderName: "userVoiceShow", userPlugin: !1 },
					[Tf.name]: { folderName: "usrbg", userPlugin: !1 },
					[xf.name]: { folderName: "validReply", userPlugin: !1 },
					[Pf.name]: { folderName: "validUser", userPlugin: !1 },
					[Mf.name]: { folderName: "vcDoubleClick", userPlugin: !1 },
					[Nf.name]: { folderName: "vcNarrator", userPlugin: !1 },
					[Rf.name]: { folderName: "vencordToolbox", userPlugin: !1 },
					[kf.name]: { folderName: "viewIcons", userPlugin: !1 },
					[Ef.name]: { folderName: "viewRaw", userPlugin: !1 },
					[Of.name]: { folderName: "voiceDownload", userPlugin: !1 },
					[_f.name]: { folderName: "voiceMessages", userPlugin: !1 },
					[Uf.name]: { folderName: "webContextMenus.web", userPlugin: !1 },
					[$f.name]: { folderName: "webKeybinds.web", userPlugin: !1 },
					[Gf.name]: { folderName: "webScreenShareFixes.web", userPlugin: !1 },
					[Hf.name]: { folderName: "whoReacted", userPlugin: !1 },
					[Wf.name]: { folderName: "xsOverlay", userPlugin: !1 },
				}),
				(ZS = {
					AppleMusicRichPresence: "desktop",
					DevCompanion: "dev",
					FixSpotifyEmbeds: "desktop",
					FixYoutubeEmbeds: "desktop",
					InvisibleChat: "desktop",
					NoRPC: "discordDesktop",
					NoSystemBadge: "discordDesktop",
					ShikiCodeblocks: "desktop",
					VolumeBooster: "discordDesktop",
					YoutubeAdblock: "desktop",
				});
		});
	var E0 = {};
	et(E0, {
		BadgePosition: () => Vc,
		_getBadges: () => Eh,
		addBadge: () => Ly,
		removeBadge: () => Ey,
	});
	function Ly(e) {
		(e.component &&= R.wrap(e.component, { noop: !0 })), L0.add(e);
	}
	function Ey(e) {
		return L0.delete(e);
	}
	function Eh(e) {
		let t = [];
		for (let r of L0)
			if (!r.shouldShow || r.shouldShow(e)) {
				let i = r.getBadges
					? r
							.getBadges(e)
							.map(
								(s) => ((s.component &&= R.wrap(s.component, { noop: !0 })), s)
							)
					: [{ ...r, ...e }];
				r.position === 0 ? t.unshift(...i) : t.push(...i);
			}
		let o = We.BadgeAPI.getDonorBadges(e.userId);
		return o && t.unshift(...o), t;
	}
	var Vc,
		L0,
		eu = g(() => {
			"use strict";
			a();
			re();
			Hn();
			(Vc = ((o) => (
				(o[(o.START = 0)] = "START"), (o[(o.END = 1)] = "END"), o
			))(Vc || {})),
				(L0 = new Set());
		});
	var O0 = {};
	et(O0, {
		Badges: () => X8,
		ChatButtons: () => iE,
		Commands: () => Y8,
		ContextMenu: () => rE,
		DataStore: () => gt,
		MemberListDecorators: () => eE,
		MessageAccessories: () => Z8,
		MessageDecorations: () => V8,
		MessageEvents: () => K8,
		MessagePopover: () => Q8,
		MessageUpdater: () => sE,
		Notices: () => Kn,
		Notifications: () => nE,
		ServerList: () => J8,
		Settings: () => tE,
		Styles: () => oE,
		UserSettings: () => aE,
	});
	var K8,
		Kn,
		Y8,
		gt,
		Z8,
		Q8,
		X8,
		J8,
		V8,
		eE,
		tE,
		oE,
		nE,
		rE,
		iE,
		sE,
		aE,
		qn = g(() => {
			"use strict";
			a();
			eu();
			_r();
			jo();
			ho();
			$o();
			Cy();
			Xa();
			ky();
			Sn();
			bs();
			Qp();
			Bc();
			Bn();
			gm();
			F();
			tt();
			Ir();
			(K8 = o1),
				(Kn = ah),
				(Y8 = mh),
				(gt = Qo),
				(Z8 = Bh),
				(Q8 = _1),
				(X8 = E0),
				(J8 = $y),
				(V8 = Ry),
				(eE = Iy),
				(tE = rh),
				(oE = Tg),
				(nE = zg),
				(rE = Ih),
				(iE = Fy),
				(sE = ey),
				(aE = $h);
		});
	var fE = {};
	et(fE, {
		Api: () => O0,
		Components: () => $g,
		PlainSettings: () => hn,
		Plugins: () => Qc,
		QuickCss: () => U0,
		Settings: () => he,
		Updater: () => xh,
		Util: () => gg,
		Webpack: () => $0,
		WebpackPatcher: () => H0,
	});
	a();
	a();
	a();
	a();
	var K0 =
		'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Vencord QuickCSS Editor</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/editor/editor.main.css" integrity="sha256-tiJPQ2O04z/pZ/AwdyIghrOMzewf+PIvEl1YKbQvsZk=" crossorigin="anonymous" referrerpolicy="no-referrer"><style>#container,body,html{position:absolute;left:0;top:0;width:100%;height:100%;margin:0;padding:0;overflow:hidden}</style></head><body><div id="container"></div><script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js" integrity="sha256-KcU48TGr84r7unF7J5IgBo95aeVrEbrGe04S7TcFUjs=" crossorigin="anonymous" referrerpolicy="no-referrer"></script><script>require.config({paths:{vs:"https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs"}}),require(["vs/editor/editor.main"],(()=>{getCurrentCss().then((e=>{var t=monaco.editor.create(document.getElementById("container"),{value:e,language:"css",theme:getTheme()});t.onDidChangeModelContent((()=>setCss(t.getValue()))),window.addEventListener("resize",(()=>{t.layout()}))}))}))</script></body></html>';
	$o();
	var gg = {};
	et(gg, {
		ChangeList: () => Ws,
		Devs: () => d,
		DevsById: () => Oi,
		ImageModal: () => dg,
		LazyComponent: () => Kr,
		Logger: () => V,
		Margins: () => G,
		ModalCloseButton: () => rt,
		ModalContent: () => Ae,
		ModalFooter: () => ht,
		ModalHeader: () => Ee,
		ModalRoot: () => Te,
		ModalSize: () => Io,
		Modals: () => Ki,
		NoopComponent: () => Be,
		Queue: () => Oo,
		REACT_GLOBAL: () => RN,
		SUPPORT_CHANNEL_ID: () => Ei,
		SYM_LAZY_CACHED: () => Go,
		SYM_LAZY_COMPONENT_INNER: () => uo,
		SYM_LAZY_GET: () => Ho,
		SYM_PROXY_INNER_GET: () => xo,
		SYM_PROXY_INNER_VALUE: () => At,
		Theme: () => da,
		UNCONFIGURABLE_PROPERTIES: () => qr,
		ZWSP: () => fa,
		canonicalizeDescriptor: () => jl,
		canonicalizeFind: () => Jf,
		canonicalizeMatch: () => Yt,
		canonicalizeReplace: () => Ks,
		canonicalizeReplacement: () => Ys,
		checkIntersecting: () => Zf,
		classes: () => H,
		closeAllModals: () => mn,
		closeModal: () => Dn,
		copyWithToast: () => Kt,
		debounce: () => $t,
		fetchUserProfile: () => mg,
		formatDuration: () => ga,
		getCurrentChannel: () => fn,
		getCurrentGuild: () => li,
		getTheme: () => Sr,
		getUniqueUsername: () => Ln,
		humanFriendlyJoin: () => t5,
		identity: () => Fi,
		insertTextIntoChatInputBox: () => ci,
		interpolateIfDefined: () => js,
		isMobile: () => LN,
		isNonNullish: () => En,
		isObject: () => kN,
		isObjectEmpty: () => jr,
		isPluginDev: () => In,
		isTruthy: () => mc,
		lazyString: () => ON,
		localStorage: () => ui,
		makeCodeblock: () => fi,
		makeLazy: () => pn,
		mergeDefaults: () => Zi,
		onceDefined: () => NN,
		onlyOnce: () => pi,
		openImageModal: () => Lo,
		openInviteModal: () => ai,
		openModal: () => ge,
		openModalLazy: () => pa,
		openPrivateChannel: () => jN,
		openUserProfile: () => Eo,
		parseUrl: () => DN,
		pluralise: () => Qf,
		proxyInner: () => _i,
		proxyLazy: () => Dt,
		sendMessage: () => dc,
		sleep: () => Xo,
		stripIndent: () => o5,
		toInlineCode: () => n5,
		tryOrElse: () => Xf,
		useAwaiter: () => pt,
		useForceUpdater: () => Wo,
		useIntersection: () => UN,
		useTimer: () => oa,
		wordsFromCamel: () => fg,
		wordsFromKebab: () => KN,
		wordsFromPascal: () => YN,
		wordsFromSnake: () => qN,
		wordsFromTitle: () => ZN,
		wordsToCamel: () => QN,
		wordsToKebab: () => JN,
		wordsToPascal: () => VN,
		wordsToSnake: () => XN,
		wordsToTitle: () => mi,
	});
	a();
	fr();
	a();
	function NN(e, t, o) {
		let r = t;
		if (t in e) return void o(e[r]);
		Object.defineProperty(e, t, {
			set(i) {
				delete e[r], (e[r] = i), o(i);
			},
			configurable: !0,
			enumerable: !1,
		});
	}
	Yf();
	P();
	it();
	Yi();
	co();
	qs();
	fc();
	De();
	Ye();
	gc();
	me();
	Ke();
	ma();
	Jo();
	Zs();
	di();
	ct();
	On();
	a();
	var Iv;
	it();
	a();
	var r5 = /[^\S\r\n]*?\r?(?:\r\n|\n)[^\S\r\n]*?\*[^\S\r\n]?/,
		i5 = /^\\@/;
	function hg(e, t = {}) {
		return {
			fileName: e,
			name: t.name ?? e.replace(/\.css$/i, ""),
			author: t.author ?? "Unknown Author",
			description: t.description ?? "A Discord Theme.",
			version: t.version,
			license: t.license,
			source: t.source,
			website: t.website,
			invite: t.invite,
		};
	}
	function Cv(e, t) {
		if (!e) return hg(t);
		let o = e.split("/**", 2)?.[1]?.split("*/", 1)?.[0];
		if (!o) return hg(t);
		let r = {},
			i = "",
			s = "";
		for (let l of o.split(r5))
			if (l.length !== 0)
				if (l.charAt(0) === "@" && l.charAt(1) !== " ") {
					r[i] = s.trim();
					let c = l.indexOf(" ");
					(i = l.substring(1, c)), (s = l.substring(c + 1));
				} else
					s +=
						" " +
						l
							.replace(
								"\\n",
								`
`
							)
							.replace(i5, "@");
		return (r[i] = s.trim()), delete r[""], hg(t, r);
	}
	var { localStorage: Av } = window,
		Nv = new Set(),
		s5 = () => {},
		a5 = async () => {},
		l5 = $t((e) => VencordNative.quickCss.set(e)),
		hc = Wl("VencordThemes", "VencordThemeData");
	window.VencordNative = {
		themes: {
			uploadTheme: (e, t) => wt(e, t, hc),
			deleteTheme: (e) => zs(e, hc),
			getThemesDir: async () => "",
			getThemesList: () =>
				Kf(hc).then((e) => e.map(([t, o]) => Cv(o, t.toString()))),
			getThemeData: (e) => lt(e, hc),
			getSystemValues: async () => ({}),
		},
		native: {
			getVersions: () => ({}),
			openExternal: async (e) => void open(e, "_blank"),
		},
		updater: {
			getRepo: async () => ({
				ok: !0,
				value: "https://github.com/Vendicated/Vencord",
			}),
			getUpdates: async () => ({ ok: !0, value: [] }),
			update: async () => ({ ok: !0, value: !1 }),
			rebuild: async () => ({ ok: !0, value: !0 }),
		},
		quickCss: {
			get: () => lt("VencordQuickCss").then((e) => e ?? ""),
			set: async (e) => {
				await wt("VencordQuickCss", e), Nv.forEach((t) => t(e));
			},
			addChangeListener(e) {
				Nv.add(e);
			},
			addThemeChangeListener: s5,
			openFile: a5,
			async openEditor() {
				let e = `popup,width=${Math.min(window.innerWidth, 1e3)},height=${Math.min(window.innerHeight, 1e3)}`,
					t = open("about:blank", "VencordQuickCss", e);
				if (!t) {
					alert("Failed to open QuickCSS popup. Make sure to allow popups!");
					return;
				}
				(t.baseUrl = Iv),
					(t.setCss = l5),
					(t.getCurrentCss = () => VencordNative.quickCss.get()),
					(t.getTheme = () => (Sr() === 2 ? "vs-light" : "vs-dark")),
					t.document.write(K0);
			},
		},
		settings: {
			get: () => {
				try {
					return JSON.parse(Av.getItem("VencordSettings") || "{}");
				} catch (e) {
					return (
						console.error("Failed to parse settings from localStorage: ", e), {}
					);
				}
			},
			set: async (e) => Av.setItem("VencordSettings", JSON.stringify(e)),
			getSettingsDir: async () => "LocalStorage",
		},
		pluginHelpers: {},
	};
	a();
	qn();
	Na();
	Za();
	var U0 = {};
	et(U0, { toggle: () => _0 });
	a();
	F();
	var Gs, pN;
	function B0(e) {
		let t = document.createElement("style");
		return (t.id = e), document.documentElement.append(t), t;
	}
	async function lE() {
		let e = await VencordNative.themes.getSystemValues(),
			t = Object.entries(e)
				.filter(([, o]) => o !== "#")
				.map(([o, r]) => `--${o}: ${r};`)
				.join("");
		B0("vencord-os-theme-values").textContent = `:root{${t}}`;
	}
	async function _0(e) {
		Gs
			? (Gs.disabled = !e)
			: e &&
				((Gs = B0("vencord-custom-css")),
				VencordNative.quickCss.addChangeListener((t) => {
					(Gs.textContent = t), (Gs.disabled = !he.useQuickCss);
				}),
				(Gs.textContent = await VencordNative.quickCss.get()));
	}
	async function F0() {
		pN ??= B0("vencord-themes");
		let { themeLinks: e, enabledThemes: t } = he,
			o = [...e];
		for (let r of t) {
			let i = await VencordNative.themes.getThemeData(r);
			if (!i) continue;
			let s = new Blob([i], { type: "text/css" });
			o.push(URL.createObjectURL(s));
		}
		pN.textContent = o.map((r) => `@import url("${r.trim()}");`).join(`
`);
	}
	document.addEventListener("DOMContentLoaded", () => {
		lE(),
			F0(),
			_0(he.useQuickCss),
			ro.addChangeListener("useQuickCss", _0),
			ro.addChangeListener("themeLinks", F0),
			ro.addChangeListener("enabledThemes", F0);
	});
	vi();
	var $0 = {};
	et($0, {
		ChunkIdsRegex: () => Xl,
		Common: () => qi,
		DefaultExtractAndLoadChunksRegex: () => rg,
		LazyComponentWebpack: () => J0,
		_cacheFind: () => ea,
		_cacheFindAll: () => Jl,
		_initWebpack: () => Xs,
		_resolveDiscordLoaded: () => Qs,
		cache: () => zo,
		cacheFind: () => ig,
		cacheFindAll: () => ko,
		cacheFindBulk: () => sg,
		cacheFindModuleFactory: () => Q0,
		cacheFindModuleId: () => Ui,
		extract: () => ta,
		extractAndLoadChunksLazy: () => Rn,
		factoryListeners: () => Js,
		filters: () => ne,
		find: () => _e,
		findAll: () => av,
		findBulk: () => lv,
		findByCode: () => fe,
		findByCodeLazy: () => tv,
		findByFactoryCode: () => Ql,
		findByProps: () => C,
		findByPropsLazy: () => ev,
		findComponent: () => Zr,
		findComponentByCode: () => ae,
		findComponentByCodeLazy: () => rv,
		findComponentByFields: () => Zl,
		findComponentLazy: () => nv,
		findExportedComponent: () => po,
		findExportedComponentLazy: () => iv,
		findLazy: () => V0,
		findModuleFactory: () => og,
		findModuleId: () => cv,
		findProp: () => Bi,
		findStore: () => K,
		findStoreLazy: () => ov,
		mapMangledModule: () => zt,
		mapMangledModuleLazy: () => sv,
		moduleListeners: () => Yl,
		onceDiscordLoaded: () => Yr,
		proxyLazyWebpack: () => X0,
		search: () => uv,
		searchFactories: () => Qr,
		stringMatches: () => eg,
		waitFor: () => An,
		waitForSubscriptions: () => Cn,
		webpackDependantLazy: () => Nn,
		webpackDependantLazyComponent: () => ng,
		webpackSearchHistory: () => Z0,
		wreq: () => Ht,
	});
	a();
	U();
	b();
	a();
	var H0 = {};
	et(H0, { allWebpackInstances: () => Hl, patchTimings: () => cE });
	a();
	F();
	De();
	me();
	Jo();
	ql();
	Za();
	var un = new V("WebpackInterceptor", "#8caaee"),
		Hl = new Set(),
		dN = !1,
		cE = [],
		pr = (e, t, o) => (
			Object.hasOwn(o, "value") && (o.writable = !0),
			Reflect.defineProperty(e, t, { configurable: !0, enumerable: !0, ...o })
		);
	pr(Function.prototype, "m", {
		enumerable: !1,
		set(e) {
			pr(this, "m", { value: e });
			let { stack: t } = new Error();
			if (
				!t?.includes("http") ||
				t.match(/at \d+? \(/) ||
				!String(this).includes("exports:{}")
			)
				return;
			let o = t.match(/\/assets\/(.+?\.js)/)?.[1];
			un.info("Found Webpack module factories" + js` in ${o}`),
				Hl.add(this),
				pr(this, "e", {
					enumerable: !1,
					set(s) {
						pr(this, "e", { value: s }),
							clearTimeout(r),
							un.info(
								"Main WebpackInstance found" +
									js` in ${o}` +
									", initializing internal references to WebpackRequire"
							),
							Xs(this);
					},
				});
			let r = setTimeout(() => Reflect.deleteProperty(this, "e"), 0);
			for (let s in e)
				mN(e, s, e[s], !0) ||
					(fN(e[s]), gN(s, he.eagerPatches ? G0(s, e[s]) : e[s]));
			pr(e, Symbol.toStringTag, { value: "ModuleFactories", enumerable: !1 });
			let i = new Proxy(e, uE);
			pr(this, "m", { value: i });
		},
	});
	var uE = {
		set: (e, t, o, r) =>
			Number.isNaN(Number(t))
				? pr(e, t, { value: o })
				: (mN(e, t, o) || (fN(o), gN(t, he.eagerPatches ? G0(t, o) : o)), !0),
	};
	function mN(e, t, o, r = !1) {
		let i, s;
		for (let l of Hl)
			if (
				!(r && l.m === e) &&
				Reflect.getOwnPropertyDescriptor(l.m, t) != null
			) {
				(i = Reflect.getOwnPropertyDescriptor(l.m, t)), (s = l.m);
				break;
			}
		return i != null
			? (s !== e && Reflect.defineProperty(e, t, i), Reflect.set(e, t, o, e))
			: !1;
	}
	function fN(e) {
		for (let t of Js)
			try {
				t(e);
			} catch (o) {
				un.error(
					`Error in Webpack factory listener:
`,
					o,
					t
				);
			}
	}
	function gN(e, t) {
		let o = {
			get() {
				return t.$$vencordOriginal != null ? t : (t = G0(e, t));
			},
			set(r) {
				t.$$vencordOriginal != null
					? ((t.toString = r.toString.bind(r)), (t.$$vencordOriginal = r))
					: (t = r);
			},
		};
		for (let r of Hl) pr(r.m, e, o);
	}
	function G0(e, t) {
		let o = pE(e, t),
			r = function (...i) {
				for (let p of Hl) pr(p.m, e, { value: r.$$vencordOriginal });
				let [s, l, c] = i;
				if (
					Ht == null &&
					!dN &&
					((dN = !0), typeof c == "function" && c.m != null)
				) {
					let { stack: p } = new Error(),
						m = p?.match(/\/assets\/(.+?\.js)/)?.[1];
					un.warn(
						`WebpackRequire was not initialized, falling back to WebpackRequire passed to the first called patched module factory (id: ${String(e)}` +
							js`, WebpackInstance origin: ${m}` +
							")"
					),
						Xs(c);
				}
				let u;
				try {
					u = o.apply(this, i);
				} catch (p) {
					if (o === t) throw p;
					return (
						un.error(
							`Error in patched module factory:
`,
							p
						),
						r.$$vencordOriginal.apply(this, i)
					);
				}
				if (((l = s.exports), l == null)) return u;
				if (typeof c == "function") {
					let p = !1;
					if (l === window) p = !0;
					else if (typeof l == "object")
						if (l.default === window) p = !0;
						else for (let m in l) m.length <= 3 && l[m] === window && (p = !0);
					if (p)
						return (
							c.c != null &&
								Object.defineProperty(c.c, e, {
									value: c.c[e],
									enumerable: !1,
									configurable: !0,
									writable: !0,
								}),
							u
						);
				}
				for (let p of Yl)
					try {
						p(l, { id: e, factory: r.$$vencordOriginal });
					} catch (m) {
						un.error(
							`Error in Webpack module listener:
`,
							m,
							p
						);
					}
				for (let [p, m] of Cn)
					try {
						if (p.$$vencordIsFactoryFilter) {
							p(r.$$vencordOriginal) &&
								(Cn.delete(p),
								m(l, { id: e, exportKey: null, factory: r.$$vencordOriginal }));
							continue;
						}
						if (p(l)) {
							Cn.delete(p),
								m(l, { id: e, exportKey: null, factory: r.$$vencordOriginal });
							continue;
						}
						if (typeof l != "object") continue;
						if (l.default != null && p(l.default)) {
							Cn.delete(p),
								m(l.default, {
									id: e,
									exportKey: "default",
									factory: r.$$vencordOriginal,
								});
							continue;
						}
						for (let y in l)
							if (y.length <= 3) {
								let v = l[y];
								if (v != null && p(v)) {
									Cn.delete(p),
										m(v, { id: e, exportKey: y, factory: r.$$vencordOriginal });
									break;
								}
							}
					} catch (y) {
						un.error(
							`Error while firing callback for Webpack waitFor subscription:
`,
							y,
							p,
							m
						);
					}
				return u;
			};
		return (r.toString = t.toString.bind(t)), (r.$$vencordOriginal = t), r;
	}
	function pE(e, t) {
		let o = "0," + String(t),
			r = t,
			i = new Set();
		for (let s = 0; s < as.length; s++) {
			let l = as[s];
			if (
				!(typeof l.find == "string"
					? o.includes(l.find)
					: (l.find.global && (l.find.lastIndex = 0), l.find.test(o)))
			)
				continue;
			i.add(l.plugin);
			let u = Y0(
					`patch by ${l.plugin}`,
					(y, v) => (
						y instanceof RegExp && y.global && (y.lastIndex = 0),
						o.replace(y, v)
					)
				),
				p = o,
				m = t;
			for (let y of l.replacement) {
				let v = o,
					N = t;
				Ys(y, l.plugin);
				try {
					let [w, I] = u(y.match, y.replace);
					if (w === o) {
						if (
							(l.noWarn ||
								un.warn(
									`Patch by ${l.plugin} had no effect (Module id is ${String(e)}): ${y.match}`
								),
							l.group)
						) {
							un.warn(
								`Undoing patch group ${l.find} by ${l.plugin} because replacement ${y.match} had no effect`
							),
								(o = p),
								(r = m),
								i.delete(l.plugin);
							break;
						}
						continue;
					}
					(o = w),
						(r = (0,
						eval)(`// Webpack Module ${String(e)} - Patched by ${[...i].join(", ")}
${w}
//# sourceURL=WebpackModule${String(e)}`));
				} catch (w) {
					if (
						(un.error(
							`Patch by ${l.plugin} errored (Module id is ${String(e)}): ${y.match}
`,
							w
						),
						i.delete(l.plugin),
						l.group)
					) {
						un.warn(
							`Undoing patch group ${l.find} by ${l.plugin} because replacement ${y.match} errored`
						),
							(o = p),
							(r = m);
						break;
					}
					(o = v), (r = N);
				}
			}
			l.all || as.splice(s--, 1);
		}
		return r;
	}
	gu();
	T();
	$o();
	Bn();
	F();
	Za();
	fc();
	Gn();
	Fa();
	vi();
	b();
	async function dE() {
		if (he.cloud.authenticated && !(await lt("Vencord_cloudSecret"))) {
			ze({
				title: "Cloud Integrations",
				body: "We've noticed you have cloud integrations enabled in another client! Due to limitations, you will need to re-authenticate to continue using them. Click here to go to the settings page to do so!",
				color: "var(--yellow-360)",
				onClick: () => ca.open("VencordCloud"),
			});
			return;
		}
		he.cloud.settingsSync &&
			he.cloud.authenticated &&
			(ui.Vencord_settingsDirty
				? (await Vi(), delete ui.Vencord_settingsDirty)
				: (await _c(!1)) &&
					ze({
						title: "Cloud Settings",
						body: "Your settings have been updated! Click here to restart to fully apply changes!",
						color: "var(--green-360)",
						onClick: Ji,
					}));
	}
	async function mE() {
		if ((await Yr, Ya("WebpackReady"), dE(), !1))
			try {
			} catch (e) {}
	}
	Ya("Init");
	mE();
	document.addEventListener(
		"DOMContentLoaded",
		() => {
			Ya("DOMContentLoaded");
		},
		{ once: !0 }
	);
	return q0(fE);
})();
//# sourceURL=VencordWeb
/*! For license information please see browser.js.LEGAL.txt */
