/**
 * Het koppenniveau, sinds v1.4.0.
 *
 * Dit is een contract tussen drie repo's: Uluma Systems schrijft het weg, de
 * twee marketingsites renderen het. De regel die hier vastligt en die je
 * nergens anders ziet staan: **ontbreekt `level`, dan is het 2**. Alle blokken
 * die vóór v1.4.0 zijn geschreven hebben geen `level`, en die renderden als
 * `<h2>`. Zou een renderer bij afwezigheid 1 kiezen, dan verspringt met terugwerkende
 * kracht elke kop in elk bestaand artikel.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zBlock, zBlocks, blockInlineTexts } from "../dist/index.js";

test("een kop zonder level blijft geldig en houdt zijn vorm", () => {
  const parsed = zBlock.parse({ type: "heading", text: "Een kop" });
  assert.deepEqual(parsed, { type: "heading", text: "Een kop" });
  assert.equal(parsed.level, undefined, "afwezig blijft afwezig, geen stille 2");
});

test("elk niveau van 1 tot en met 6 wordt geaccepteerd", () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const parsed = zBlock.parse({ type: "heading", text: "Kop", level });
    assert.equal(parsed.level, level);
  }
});

test("niveaus buiten 1 tot en met 6 worden geweigerd", () => {
  for (const level of [0, 7, -1, 2.5, "2", null]) {
    assert.throws(
      () => zBlock.parse({ type: "heading", text: "Kop", level }),
      `level ${JSON.stringify(level)} hoort geweigerd te worden`,
    );
  }
});

test("subheading bestaat nog, want de sites renderen hem nog", () => {
  const parsed = zBlock.parse({ type: "subheading", text: "Tussenkop" });
  assert.deepEqual(parsed, { type: "subheading", text: "Tussenkop" });
});

test("een kop met niveau doet gewoon mee in de inline-tekst", () => {
  assert.deepEqual(blockInlineTexts({ type: "heading", text: "Kop", level: 4 }), ["Kop"]);
});

test("een lijst blokken met gemengde niveaus parseert in zijn geheel", () => {
  const blocks = [
    { type: "heading", text: "Hoofdstuk", level: 2 },
    { type: "paragraph", text: "Tekst." },
    { type: "heading", text: "Onderdeel", level: 3 },
    { type: "subheading", text: "Oude tussenkop" },
  ];
  assert.deepEqual(zBlocks.parse(blocks), blocks);
});
