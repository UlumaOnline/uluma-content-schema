/**
 * Legt vast dat het preview-schema omgaat met de vorm die `get_preview` in
 * Uluma Systems teruggeeft: een vaste sleutelset waarin elke sleutel altijd
 * aanwezig is en `null` waar hij niet van toepassing is.
 *
 * Dit is een contract tussen twee repo's. Breekt het, dan blijft de
 * voorbeeldweergave leeg terwijl er niets in de logs staat — vandaar dat de
 * exacte respons hier letterlijk als fixture staat.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreview } from "../dist/index.js";

/** Zoals get_preview hem levert voor een blogpost. */
const BLOG_RESPONSE = {
  kind: "blog",
  slug: "een-concept",
  title: "Een concept",
  description: "Beschrijving.",
  excerpt: null,
  metaTitle: "SEO-titel",
  category: "Praktijk",
  location: null, // niet van toepassing op blog
  author: "Nienke Zijsling",
  date: "2026-09-01",
  readingMinutes: 4,
  image: null,
  content: [{ type: "paragraph", text: "Hallo **wereld**." }],
};

/** Zoals get_preview hem levert voor nieuws. */
const NEWS_RESPONSE = {
  ...BLOG_RESPONSE,
  kind: "news",
  metaTitle: null, // nieuws heeft geen metaTitle
  author: null,
  location: "Breda",
  category: "Aankondiging",
};

test("null wordt undefined, niet null", () => {
  const result = parsePreview(BLOG_RESPONSE);
  assert.equal(result.ok, true);

  // Cruciaal: de site-types zeggen `location?: string`, niet `string | null`.
  assert.equal(result.article.location, undefined);
  assert.equal(result.article.excerpt, undefined);
  assert.equal(result.article.image, undefined);
  assert.equal(result.article.metaTitle, "SEO-titel");
});

test("nieuws krijgt geen metaTitle en geen auteur", () => {
  const result = parsePreview(NEWS_RESPONSE);
  assert.equal(result.ok, true);
  assert.equal(result.article.metaTitle, undefined);
  assert.equal(result.article.author, undefined);
  assert.equal(result.article.location, "Breda");
});

test("een half afgemaakt concept mag getoond worden", () => {
  // De codegen zou dit weigeren — terecht, het is niet af. De
  // voorbeeldweergave moet het juist wél laten zien.
  const result = parsePreview({
    ...BLOG_RESPONSE,
    category: null,
    date: null,
    readingMinutes: null,
    description: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.article.category, undefined);
  assert.equal(result.article.date, undefined);
  assert.equal(result.article.readingMinutes, 1);
  assert.equal(result.article.description, "");
});

test("een onbekend token levert not-found, geen fout", () => {
  assert.deepEqual(parsePreview(null), { ok: false, reason: "not-found" });
  assert.deepEqual(parsePreview(undefined), { ok: false, reason: "not-found" });
});

test("een misvormd blok wordt wél afgekeurd", () => {
  // Blokken blijven streng: een blok zonder `text` laat de renderer struikelen,
  // en dat wil je in de voorbeeldweergave net zo min als op productie.
  const result = parsePreview({
    ...BLOG_RESPONSE,
    content: [{ type: "paragraph" }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.match(result.detail, /content/);
});

test("lege strings tellen als afwezig", () => {
  const result = parsePreview({ ...BLOG_RESPONSE, metaTitle: "", excerpt: "" });
  assert.equal(result.article.metaTitle, undefined);
  assert.equal(result.article.excerpt, undefined);
});
