// Ported from htmlparser2 v12.0.0 (src/WritableStream.spec.ts). Upstream feeds
// the fixture documents through its node stream wrapper, which isn't vendored;
// the same documents are written here in small chunks and then in one pass,
// against upstream's snapshots (renamed from `WritableStream > ...`).
//
// Dropped: "should decode fragmented unicode characters", which tests the
// stream's byte decoding rather than the parser.
import * as fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
    Parser,
    type ParserOptions,
} from "../../src/shared/htmlparser/Parser";
import * as helper from "./__fixtures__/testHelper";

describe("Documents", () => {
    it("Basic html", () => testDocument("Basic.html"));
    it("Attributes", () => testDocument("Attributes.html"));
    it("SVG", () => testDocument("Svg.html"));
    it("RSS feed", () => testDocument("RSS_Example.xml", { xmlMode: true }));
    it("Atom feed", () => testDocument("Atom_Example.xml", { xmlMode: true }));
    it("RDF feed", () => testDocument("RDF_Example.xml", { xmlMode: true }));
});

function collect(
    write: (parser: Parser) => void,
    options?: ParserOptions,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const handler = helper.getEventCollector((error, events) =>
            error ? reject(error) : resolve(events),
        );
        write(new Parser(handler, options));
    });
}

async function testDocument(
    file: string,
    options?: ParserOptions,
): Promise<void> {
    const data = await fs.readFile(
        new URL(`__fixtures__/Documents/${file}`, import.meta.url),
        "utf8",
    );

    const events = await collect((parser) => {
        for (let index = 0; index < data.length; index += 7) {
            parser.write(data.slice(index, index + 7));
        }
        parser.end();
    }, options);

    expect(events).toMatchSnapshot();

    expect(await collect((parser) => parser.end(data), options)).toStrictEqual(
        events,
    );
}
