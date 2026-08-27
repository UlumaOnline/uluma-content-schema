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

// ── de vorm die get_preview sinds de fix levert ──────────────────────────────
//
// Lege velden worden nu wéggelaten in plaats van als null gestuurd. Alleen
// kind, slug, title en content zijn altijd aanwezig. De nul-varianten hierboven
// blijven staan: tolerantie voor beide kost niets en beschermt tegen een
// wijziging aan de andere kant van de repo-grens die hier niemand ziet aankomen.

/** Een blogpost zonder optionele velden — sleutels ontbreken, geen nulls. */
const BLOG_OMITTED = {
  kind: "blog",
  slug: "een-concept",
  title: "Een concept",
  description: "Beschrijving.",
  category: "Praktijk",
  author: "Nienke Zijsling",
  date: "2026-09-01",
  readingMinutes: 4,
  content: [{ type: "paragraph", text: "Hallo **wereld**." }],
};

test("ontbrekende sleutels worden net zo behandeld als null", () => {
  const result = parsePreview(BLOG_OMITTED);
  assert.equal(result.ok, true);
  assert.equal(result.article.metaTitle, undefined);
  assert.equal(result.article.excerpt, undefined);
  assert.equal(result.article.location, undefined);
  assert.equal(result.article.image, undefined);
  assert.equal(result.article.kind, "blog");
});

test("een half ingevuld concept met ontbrekende verplichte velden wordt getoond", () => {
  // Dit is het geval waar het om gaat. Een redacteur klikt halverwege op
  // "Voorbeeld": categorie en datum zijn er nog niet. De codegen zou dit
  // terecht weigeren, de voorbeeldweergave moet het juist laten zien.
  const { kind, slug, title, content } = BLOG_OMITTED;
  const result = parsePreview({ kind, slug, title, content });

  assert.equal(result.ok, true);
  assert.equal(result.article.category, undefined);
  assert.equal(result.article.date, undefined);
  assert.equal(result.article.readingMinutes, 1);
  assert.equal(result.article.description, "");
});

test("kind blijft behouden — anders weet de route niet welk soort artikel dit is", () => {
  // blogPostSchema en newsArticleSchema zijn strip-objecten en zouden `kind`
  // stilzwijgend weglaten. Vandaar dat de voorbeeldweergave zijn eigen schema
  // heeft en niet die twee gebruikt.
  assert.equal(parsePreview(BLOG_OMITTED).article.kind, "blog");
  assert.equal(
    parsePreview({ ...BLOG_OMITTED, kind: "news" }).article.kind,
    "news",
  );
  assert.equal(
    parsePreview({ ...BLOG_OMITTED, kind: "knowledge" }).article.kind,
    "knowledge",
  );
});

test("de taal van het concept komt door", () => {
  // Zonder dit veld kan een meertalige site niet weten in welke taal een
  // concept staat, en valt hij terug op zijn standaardtaal.
  assert.equal(parsePreview({ ...BLOG_RESPONSE, locale: "nl" }).article.locale, "nl");
  assert.equal(parsePreview({ ...BLOG_RESPONSE, locale: "en" }).article.locale, "en");
});

test("een concept zonder taal blijft geldig", () => {
  // De voorbeeldweergave valideert een concept en geen publicatie; een
  // ontbrekend veld mag hier nooit een leeg scherm opleveren.
  const { locale, ...zonder } = { ...BLOG_RESPONSE, locale: "nl" };
  assert.equal(parsePreview(zonder).ok, true);
});

test("een kennisartikel komt door de voorbeeldweergave", () => {
  // Zonder `knowledge` in de enum krijgt de redacteur "het concept is niet
  // geldig" te zien in plaats van zijn tekst. Dat is de hele reden dat dit
  // pakket vóór de CMS aan de beurt is.
  const result = parsePreview({ ...BLOG_RESPONSE, kind: "knowledge" });
  assert.equal(result.ok, true);
  assert.equal(result.article.kind, "knowledge");
  assert.equal(result.article.author, "Nienke Zijsling");
});

test("een onbekende soort wordt wél geweigerd", () => {
  // De enum is geen formaliteit: hij is de plek waar een typefout in Systems
  // opvalt in plaats van als leeg scherm te eindigen.
  assert.equal(parsePreview({ ...BLOG_RESPONSE, kind: "artikel" }).ok, false);
});

test("een blok met een weggelaten optioneel veld komt schoon door", () => {
  const result = parsePreview({
    ...BLOG_OMITTED,
    content: [{ type: "quote", text: "Zonder bronvermelding." }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.article.content[0].cite, undefined);
});
