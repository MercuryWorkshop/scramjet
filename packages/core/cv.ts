import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
	definePackage,
	type Requirement,
	type TaskContext,
} from "../cv/api.ts";
import { runRspack } from "../cv/rspack.ts";

const WASM_BINDGEN_VERSION = "0.2.105";

const rustTools: Requirement[] = [
	{
		bin: "cargo",
		hint: "install rust via https://rustup.rs (nightly is picked up from rust-toolchain.toml)",
	},
	{ bin: "rustup", hint: "install rust via https://rustup.rs" },
	{
		bin: "wasm-bindgen",
		version: WASM_BINDGEN_VERSION,
		versionArgs: ["-V"],
		install: [
			"cargo",
			"install",
			"wasm-bindgen-cli",
			"--version",
			WASM_BINDGEN_VERSION,
		],
	},
	{
		bin: "wasm-opt",
		install: ["cargo", "install", "wasm-opt"],
		hint: "binaryen: https://github.com/WebAssembly/binaryen",
	},
	{
		bin: "wasm-snip",
		install: [
			"cargo",
			"install",
			"--git",
			"https://github.com/r58playz/wasm-snip",
		],
	},
];

// functions the rewriter never reaches; snipping them keeps oxc's ts/jsx paths out of the binary
const SNIP = [
	"oxc_regular_expression::.*",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_non_array_type",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_ts_import_type",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_operator_or_higher",
	"oxc_parser::ts::statement::<impl oxc_parser::ParserImpl>::parse_ts_interface_declaration",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_mapped_type",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_index_signature_declaration",
	"oxc_parser::ts::statement::<impl oxc_parser::ParserImpl>::parse_ts_import_equals_declaration",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_or_type_predicate",
	"oxc_parser::ts::statement::<impl oxc_parser::ParserImpl>::parse_ts_namespace_or_module_declaration_body",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_ts_implements_clause",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_intersection_type_or_higher",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_ts_type_name",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_literal_type_node",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_asserts_type_predicate",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_tuple_element_type",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_arguments_of_type_reference",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_ts_call_signature_member",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::is_start_of_type",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_this_type_predicate",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_query",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_reference",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_operator",
	"oxc_parser::ts::types::<impl oxc_parser::ParserImpl>::parse_type_literal",
	"oxc_parser::ts::statement::<impl oxc_parser::ParserImpl>::is_at_enum_declaration",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_element",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_identifier",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_element_name",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_children",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_fragment",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_expression_container",
	"oxc_parser::jsx::<impl oxc_parser::ParserImpl>::parse_jsx_expression",
	// these are confirmed to break oxc:
	//   parse_declaration, parse_ts_type, parse_type_arguments_in_expression,
	//   parse_ts_type_parameters, parse_class_element_modifiers, eat_decorators,
	//   is_nth_at_modifier, try_parse_type_arguments, is_at_ts_index_signature_member,
	//   parse_ts_return_type_annotation, parse_ts_type_annotation
];

// wasm-opt pass chain used for release builds; order matters and was tuned by hand
const WASM_OPT_PASSES = (() => {
	const G = "--generate-global-effects";
	const round = (o: string) => [
		G,
		"--flatten",
		G,
		"--rereloop",
		G,
		o,
		G,
		o,
		G,
		o,
	];
	return [
		"--converge",
		"-tnh",
		"--vacuum",
		G,
		"-O4",
		...round("-O4"),
		G,
		"-Oz",
		...round("-Oz"),
		G,
		"--code-folding",
		G,
		"--const-hoisting",
		G,
		"--dae",
		G,
		"--flatten",
		G,
		"--merge-locals",
		G,
		"-O4",
		...round("-O4"),
		G,
		"-Oz",
		...round("-Oz"),
	];
})();

async function buildWasm(ctx: TaskContext) {
	const release = process.env.RELEASE === "1";
	const rewriter = join(ctx.dir, "rewriter");
	const wasmDir = join(rewriter, "wasm");
	const out = join(wasmDir, "out");
	const dist = join(ctx.dir, "dist");

	let features = process.env.FEATURES ?? "";
	if (!release) features = `debug,${features}`;

	let rustflags = "-Zlocation-detail=none -Zfmt-debug=none";
	if (process.env.OPTIMIZE_FOR_SIZE === "1") rustflags += " -C opt-level=z";
	const stdFeatures =
		process.env.OPTIMIZE_FOR_SPEED === "1" ? "" : ",optimize_for_size";

	ctx.log(`cargo build (${release ? "release" : "debug"} features)`);
	await ctx.sh({
		cwd: wasmDir,
		env: { RUSTFLAGS: rustflags },
	})`cargo +nightly build --release
		--target wasm32-unknown-unknown
		-Z build-std=panic_abort,std -Z build-std-features=${stdFeatures}
		--no-default-features --features ${features}`;

	const built = join(
		rewriter,
		"target/wasm32-unknown-unknown/release/wasm.wasm"
	);
	await ctx.sh({
		cwd: wasmDir,
	})`wasm-bindgen --target web --out-dir ${out} ${built}`;
	// the glue is bundled by rspack; a live import.meta.url would break in workers
	const glue = join(out, "wasm.js");
	await fs.writeFile(
		glue,
		(await fs.readFile(glue, "utf-8")).replaceAll("import.meta.url", '""')
	);

	const snipped = join(out, "wasm_snipped.wasm");
	await ctx.sh`wasm-snip ${join(out, "wasm_bg.wasm")} -o ${snipped} -p ${SNIP}`;

	const optimized = join(out, "optimized.wasm");
	if (release) {
		const extra = (process.env.WASMOPTFLAGS ?? "").split(/\s+/).filter(Boolean);
		ctx.log("wasm-opt (this takes a few minutes)");
		await ctx.sh`wasm-opt ${extra} ${snipped} -o ${optimized} ${WASM_OPT_PASSES}`;
	} else {
		const extra = (process.env.WASMOPTFLAGS ?? "-g")
			.split(/\s+/)
			.filter(Boolean);
		if (extra.length && extra.join(" ") !== "-g") {
			await ctx.sh`wasm-opt ${extra} ${snipped} -o ${optimized}`;
		} else {
			await fs.copyFile(snipped, optimized);
		}
	}

	await fs.mkdir(dist, { recursive: true });
	await fs.copyFile(optimized, join(dist, "scramjet.wasm"));
}

export default definePackage(import.meta.dirname, {
	name: "core",
	tasks: {
		wasm: {
			desc: "compile the rust rewriter to wasm",
			inputs: [
				"rewriter/{transform,js,wasm,coverage-macro}/**/*.rs",
				"rewriter/{transform,js,wasm,coverage-macro,native}/Cargo.toml",
				"rewriter/Cargo.toml",
				"rewriter/Cargo.lock",
				"rewriter/rust-toolchain.toml",
			],
			outputs: [
				"dist/scramjet.wasm",
				"rewriter/wasm/out/wasm.js",
				"rewriter/wasm/out/wasm_bg.wasm",
			],
			env: [
				"RELEASE",
				"FEATURES",
				"WASMOPTFLAGS",
				"OPTIMIZE_FOR_SIZE",
				"OPTIMIZE_FOR_SPEED",
			],
			requires: rustTools,
			exclusive: true,
			run: buildWasm,
		},
		build: {
			desc: "bundle scramjet (iife, esm, bundled variants, types)",
			deps: [":wasm"],
			inputs: [
				"src/**",
				"package.json",
				"tsconfig*.json",
				"../../rspack.config.ts",
			],
			outputs: [
				"dist/scramjet.js",
				"dist/scramjet.mjs",
				"dist/scramjet_bundled.js",
				"dist/scramjet_bundled.mjs",
				"dist/scramjet-external.mjs",
				"dist/types/index.d.ts",
			],
			run: (ctx) =>
				runRspack(
					join(ctx.dir, "../../rspack.config.ts"),
					[
						"scramjet-iife",
						"scramjet-iife-bundled",
						"scramjet-esmodule",
						"scramjet-esmodule-bundled",
						"scramjet-types",
					],
					{ mode: "production", log: ctx.log }
				),
		},
		test: {
			desc: "vitest unit tests",
			persistent: true,
			run: (ctx) => ctx.sh`pnpm exec vitest run ${ctx.args}`,
		},
	},
});
