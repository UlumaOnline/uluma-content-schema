/**
 * Het onderschrift bij een afbeelding, sinds v1.5.0.
 *
 * Aanleiding: terugkoppeling op de Revloft-site, 1 september 2026. `alt` was
 * er al en is géén vervanging — dat is de beschrijving voor wie het beeld niet
 * ziet, een onderschrift is zichtbare tekst met een andere functie.
 *
 * Wat hier vastligt en wat je nergens anders ziet staan: het veld is optioneel,
 * dus élk bestaand image-blok blijft geldig, en het gaat door `parseInline` —
 * een bronvermelding is vaak een link, en die moet de codegen dus controleren.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zBlock, blockInlineTexts, blockPlainTexts, blockHrefs } from "../dist/index.js";

const AFBEELDING = {
  src: "/img/grafiek.png",
  alt: "Een grafiek met een stijgende lijn",
  width: 1600,
  height: 900,
};

test("een image-blok zonder caption blijft geldig", () => {
  const blok = { type: "image", image: AFBEELDING };
  const uitkomst = zBlock.safeParse(blok);
  assert.equal(uitkomst.success, true);
  assert.equal(uitkomst.data.caption, undefined);
});

test("een caption komt er heelhuids doorheen", () => {
  const blok = { type: "image", image: AFBEELDING, caption: "Bron: CBS, 2026" };
  const uitkomst = zBlock.safeParse(blok);
  assert.equal(uitkomst.success, true);
  assert.equal(uitkomst.data.caption, "Bron: CBS, 2026");
});

test("een lege caption wordt afgekeurd", () => {
  // Een lege string is geen onderschrift maar een lege regel onder de
  // afbeelding. Weglaten dus — zelfde regel als `cite` op een citaat.
  const uitkomst = zBlock.safeParse({ type: "image", image: AFBEELDING, caption: "" });
  assert.equal(uitkomst.success, false);
});

test("de caption telt als inline-tekst, alt niet", () => {
  const blok = { type: "image", image: AFBEELDING, caption: "Bron: **CBS**" };
  assert.deepEqual(blockInlineTexts(blok), ["Bron: **CBS**"]);
  assert.deepEqual(blockInlineTexts({ type: "image", image: AFBEELDING }), []);
});

test("een link in de caption wordt door de codegen gezien", () => {
  // Dit is de reden dat caption in blockInlineTexts staat. Zou hij daar
  // ontbreken, dan controleert de linkcontrole hem niet en is een typefout in
  // een bronvermelding een echte 404 die niemand tegenhoudt.
  const blok = {
    type: "image",
    image: AFBEELDING,
    caption: "Bron: [CBS](/bronnen/cbs)",
  };
  assert.deepEqual(blockHrefs(blok), ["/bronnen/cbs"]);
});

test("de caption telt mee voor de leestijd, naast alt", () => {
  const blok = { type: "image", image: AFBEELDING, caption: "Bron: CBS" };
  assert.deepEqual(blockPlainTexts(blok), [AFBEELDING.alt, "Bron: CBS"]);
  assert.deepEqual(blockPlainTexts({ type: "image", image: AFBEELDING }), [AFBEELDING.alt]);
});
