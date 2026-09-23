# Vendored htmlparser2

The HTML/XML parser and serializer behind `rewriteHtml` / `unrewriteHtml`,
vendored from fb55's libraries and hardened to run in a realm whose globals
belong to the page.

## Provenance

| Upstream                                                      | Version | Commit     | Here                                                                             |
| ------------------------------------------------------------- | ------- | ---------- | -------------------------------------------------------------------------------- |
| [htmlparser2](https://github.com/fb55/htmlparser2)            | 12.0.0  | `c73fec0c` | `Tokenizer.ts`, `Parser.ts`                                                      |
| [entities](https://github.com/fb55/entities)                  | 8.0.0   | `2322ee76` | `decode.ts`, `decode-data-*.ts`, `decode-base64.ts`, escapers in `serializer.ts` |
| [dom-serializer](https://github.com/cheeriojs/dom-serializer) | 3.0.0   | `a2a7ced2` | `serializer.ts`                                                                  |
| [domhandler](https://github.com/fb55/domhandler)              | 6.0.1   | `8f660711` | `dom.ts` (rewritten, not ported)                                                 |

It replaces the `htmlparser2`, `domhandler`, `domutils` and `dom-serializer`
dependencies, and `patches/htmlparser2@12.0.0.patch`, which is folded in.
The root workspace still applies that patch to the other packages that
depend on htmlparser2.

## Files

- `Tokenizer.ts`, `Parser.ts`, `decode.ts`, `decode-data-*.ts`,
  `decode-base64.ts`: ported line for line. They keep upstream's formatting
  (4-space indent, trailing commas) and are in `.prettierignore`, so
  `diff -w` against upstream shows only real changes.
- `dom.ts`: node classes and `DomBuilder`, the parser handler that builds
  the tree. It replaces domhandler and domelementtype.
- `serializer.ts`: dom-serializer's `render`, reduced to the options
  scramjet uses.
- `safe.ts`: the null-prototype containers everything above is built on.
- `index.ts`: `parseDocument`, `render`, and re-exports.

## Behaviour differences from upstream

The parser is meant to be indistinguishable from stock htmlparser2 12.0.0
with scramjet's patch. It was fuzzed against that (600k generated documents
over every parser option, written in random chunk sizes), comparing every
parser event including start/end indices, plus the serialized output. Nothing
differed except:

- **Attributes named `__proto__` are kept.** Upstream stores attributes in a
  `{}`, where `attribs.__proto__ = v` calls the `Object.prototype` setter, so
  the attribute silently disappears. The browser keeps it, and so does this
  parser, because attribute records have no prototype.

Also carried over from `patches/htmlparser2@12.0.0.patch`, and marked
`Scramjet` in the source:

- the `startingForeignContext` option (fragment parsing inside `<svg>` or
  `<math>`)
- the `scriptingEnabled` option, plus `<noscript>` as raw text when it is on
  (the default)
- `</p>` and `</br>` breaking out of foreign content

The patch's other `noscript` branch in `stateBeforeTagName` was dropped: it
compared against a sequence `specialStartSequences` can never return.

Removed because scramjet never used it:

- Parser: the `Tokenizer` option (custom tokenizer class).
- entities: the string decoders (`decodeHTML` & co.), the encode trie and
  the parse-error reporting hooks in `EntityDecoder`.
- htmlparser2's `index.ts` helpers: feeds, `DomUtils`, the stream wrappers,
  `DefaultHandler`.
- domhandler: `prev`/`next`, start/end indices, the DOM-level-1 aliases
  (`childNodes`, `nodeType`...), the parse5 fields, `cloneNode`, the handler
  options and the element callback, plus the separate `script`/`style` node
  types (check `name` instead).
- dom-serializer: every option except `xmlMode`. Output is always what
  `{ encodeEntities: "utf8", decodeEntities: false }` produced.

## Hardening rules

Every markup sink in the client rewrites through this code, inside the page's
realm, so every builtin prototype and global is page-controlled at call time.
Module initialisation runs before any page script and is trusted. Anything
that runs later follows these rules; `tests/htmlparser/hardening.spec.ts`
checks them by instrumenting every builtin and failing if the parser touches
one.

| Upstream                                                         | Here                                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `s.charCodeAt(i)`, `s.slice(a, b)`, `s.toLowerCase()` ...        | `String_charCodeAt(s, i)`, `String_slice(s, a, b)`, ... from `../snapshot`                                                       |
| `re.exec(s)`, `s.search(re)`                                     | `RegExp_exec(re, s)`                                                                                                             |
| `Math.min`, `Object.hasOwn`, `new Error`, `String.fromCodePoint` | the snapshot's `Math_min`, `Object_hasOwn`, `Error`, `String_fromCodePoint`                                                      |
| `new Set([...])`, `new Map([...])`                               | `new SafeSet([...])`, `new SafeMap([...])` (same `has`/`get`, backed by a null-prototype record)                                 |
| `[]` that is written to or read out of range                     | `nullArray()`, with `Array_push(a, x)`, `Array_shift(a)`, `Array_includes(a, x)`... instead of methods                           |
| `new Uint8Array([...])` sequences                                | `sequence([...])`: a frozen null-prototype array whose `length` is an own property                                               |
| `{}` used as a record                                            | `Object_create(null)` / `nullRecord()`                                                                                           |
| options objects from callers                                     | copied onto a null-prototype record (`toNullRecord`) before any read                                                             |
| classes                                                          | `Object_setPrototypeOf(Class.prototype, null)` after the declaration, so neither field reads nor writes reach `Object.prototype` |
| `for...of`, spread, destructuring of arrays, `for...in`          | indexed loops over `Object_keys(...)` or `.length`                                                                               |

Why arrays need a null prototype, not just snapshotted methods: `push` (and
`arr[arr.length] = x`) stores with `[[Set]]`. When the index isn't an own
property yet, that walks the prototype chain, finds any setter the page put
on `Array.prototype[n]`, and calls it instead of storing. Reads past the end
go to the page's getters the same way.

This costs speed. V8 only has fast paths for arrays with the stock
prototype, so the parser runs roughly 1.3–1.7x slower than stock
htmlparser2.

## Backporting an upstream fix

1. Get the upstream diff, e.g.
   `git -C htmlparser2 diff v12.0.0 <fix> -- src/Tokenizer.ts src/Parser.ts`.
2. Apply it to the ported files, from the repository root, or by hand:

   ```sh
   git apply --ignore-whitespace -p2 \
       --directory=packages/scramjet/packages/core/src/shared/htmlparser fix.diff
   ```

   Most hunks apply cleanly. Checked against htmlparser2's five most
   recent parser fixes (`f2daa22` to `cbf4b19`): 43 of 51 hunks apply
   as-is. The other 8 fall on lines the hardening rewrote (the `Set` tables,
   the `Uint8Array` sequences, `charCodeAt` calls) and need the same
   substitution applied to the new code by hand.

3. Rewrite any new builtin use in the fix per the table above.
4. If the fix changes upstream's specs or snapshots, copy them over (see
   below), then run `pnpm test` and `pnpm lint` in `packages/core`. The lint
   `no-globals` rule catches most missed rewrites; `hardening.spec.ts`
   catches the rest.

## Tests

`packages/core/tests/htmlparser`, run with `pnpm test` in `packages/core`:

- `Tokenizer.spec.ts`, `Parser.spec.ts`, `Parser.events.spec.ts`,
  `__fixtures__/`: upstream's, with upstream's snapshot files verbatim.
  Only the imports differ, and `Parser.spec.ts` drops the custom-tokenizer
  test.
- `Documents.spec.ts`: upstream's `WritableStream.spec.ts` without the
  stream wrapper, against upstream's snapshots (renamed).
- `serializer.spec.ts`: dom-serializer's spec, minus the cases for options
  that were removed.
- `dom.spec.ts`: the DOM builder and the scramjet parser options.
- `hardening.spec.ts`: prototype-pollution checks.
