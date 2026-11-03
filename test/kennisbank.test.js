/**
 * De bouwblokken uit de bouwbrief voor de Revloft-kennisbank, sinds v1.7.0.
 *
 * Drie velden op het artikel (`heroStat`, `keyPoints`, `ctaBand`), twee nieuwe
 * blokken (`stat`, `cards`) en één veld op een bestaand blok (`note.label`).
 * Wat hier vastligt en nergens anders zichtbaar is:
 *
 *  - een vers `stat`-blok mag leeg zijn, een gepubliceerd niet;
 *  - de nummering van `cards` staat niet in de data, net als bij `steps`;
 *  - aantallen (3 tot 6 kaarten, twee getallen per artikel) zijn géén
 *    schemaregel — een build die daarop omvalt houdt de hele site tegen.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zBlock,
  zStrictBlock,
  blockInlineTexts,
  blockPlainTexts,
  blockHrefs,
  blogPostSchema,
  knowledgeArticleSchema,
  previewArticleSchema,
} from "../dist/index.js";

const getal = {
  type: "stat",
  value: "81%",
  text: "van de B2B-kopers had al een voorkeursleverancier bij het eerste contact.",
  source: "6sense, Buyer Experience Report 2024",
  sourceUrl: "https://www.businesswire.com/news/home/20241029/",
};

// ── stat ─────────────────────────────────────────────────────────────────────

test("een stat-blok houdt zijn vorm", () => {
  assert.deepEqual(zBlock.parse(getal), getal);
});

test("een vers, leeg stat-blok is geldig voor de voorbeeldweergave", () => {
  assert.doesNotThrow(() =>
    zBlock.parse({ type: "stat", value: "", text: "", source: "", sourceUrl: "" }),
  );
});

test("de codegen eist een bron en een echte URL", () => {
  assert.doesNotThrow(() => zStrictBlock.parse(getal));
  assert.throws(() => zStrictBlock.parse({ ...getal, source: "" }));
  assert.throws(() => zStrictBlock.parse({ ...getal, sourceUrl: "businesswire.com" }));
});

test("de bron-URL gaat mee in de linkcontrole", () => {
  assert.deepEqual(blockHrefs(getal), [getal.sourceUrl]);
});

test("alleen de zin is inline-tekst; getal en bron tellen wel mee voor leestijd", () => {
  assert.deepEqual(blockInlineTexts(getal), [getal.text]);
  assert.deepEqual(blockPlainTexts(getal), [getal.value, getal.text, getal.source]);
});

// ── cards ────────────────────────────────────────────────────────────────────

const raster = {
  type: "cards",
  label: "Uitkomst",
  items: [
    {
      title: "Te weinig verkeer",
      text: "Onder de 500 bezoekers per maand blijft er te weinig over.",
      conclusion: "meer budget voor bereik.",
    },
    {
      title: "Meer dan je dacht",
      text: "Er komen al bedrijven uit je doelgroep langs.",
      conclusion: "de eerste euro van 2027 naar opvolging.",
      highlight: true,
    },
  ],
};

test("een cards-blok houdt zijn vorm, met en zonder label", () => {
  assert.deepEqual(zBlock.parse(raster), raster);
  const genummerd = {
    type: "cards",
    items: [{ title: "Herkenningspercentage", text: "Welk deel.", badge: "Meestal niet gemeten" }],
  };
  assert.deepEqual(zBlock.parse(genummerd), genummerd);
});

test("de nummering staat niet in de data", () => {
  const parsed = zBlock.parse({ type: "cards", items: [{ title: "A", text: "B" }] });
  assert.deepEqual(Object.keys(parsed.items[0]).sort(), ["text", "title"]);
});

test("een lege badge of conclusie is geen badge — weglaten", () => {
  assert.throws(() => zBlock.parse({ type: "cards", items: [{ title: "A", text: "B", badge: "" }] }));
  assert.throws(() =>
    zBlock.parse({ type: "cards", items: [{ title: "A", text: "B", conclusion: "" }] }),
  );
});

test("aantallen zijn geen schemaregel: twee kaarten en twee uitgelicht komen door", () => {
  // Dat bewaakt de editor. Zie de toelichting bij `zStrictBlock`.
  const twee = { ...raster, items: raster.items.map((k) => ({ ...k, highlight: true })) };
  assert.doesNotThrow(() => zStrictBlock.parse(twee));
});

test("de codegen weigert een kaart zonder titel", () => {
  assert.throws(() => zStrictBlock.parse({ type: "cards", items: [{ title: " ", text: "B" }] }));
});

test("titel, tekst en conclusie zijn inline-tekst; label en badge niet", () => {
  assert.deepEqual(blockInlineTexts(raster), [
    "Te weinig verkeer",
    "Onder de 500 bezoekers per maand blijft er te weinig over.",
    "meer budget voor bereik.",
    "Meer dan je dacht",
    "Er komen al bedrijven uit je doelgroep langs.",
    "de eerste euro van 2027 naar opvolging.",
  ]);
});

// ── note.label ───────────────────────────────────────────────────────────────

test("een terzijde zonder label blijft wat het was", () => {
  const note = { type: "note", text: "Lees ook [dit](/nl/kennisbank/x/)." };
  assert.deepEqual(zBlock.parse(note), note);
});

test("een terzijde met label 'Lees ook'", () => {
  const note = { type: "note", label: "Lees ook", text: "[Bezoekers verrijking](/nl/kennisbank/x/)" };
  assert.deepEqual(zBlock.parse(note), note);
  assert.throws(() => zBlock.parse({ ...note, label: "" }));
});

// ── faq.heading ──────────────────────────────────────────────────────────────

test("een faq zonder kop blijft wat hij was", () => {
  const faq = { type: "faq", items: [{ q: "Wat kost het?", a: "Niets." }] };
  assert.deepEqual(zBlock.parse(faq), faq);
  assert.deepEqual(blockInlineTexts(faq), ["Wat kost het?", "Niets."]);
});

test("een faq met kop, en die kop staat vooraan in de tekst", () => {
  const faq = { type: "faq", heading: "Veelgestelde vragen", items: [{ q: "Wat kost het?", a: "Niets." }] };
  assert.deepEqual(zBlock.parse(faq), faq);
  assert.throws(() => zBlock.parse({ ...faq, heading: "" }));
  assert.deepEqual(blockInlineTexts(faq), ["Veelgestelde vragen", "Wat kost het?", "Niets."]);
});

// ── artikelvelden ────────────────────────────────────────────────────────────

const zKennis = knowledgeArticleSchema(["Uitleg"]);
const zBlog = blogPostSchema(["Algemeen"]);

function artikel(extra = {}, category = "Uitleg") {
  return {
    slug: "marketingbudget-2027",
    title: "Marketingbudget 2027",
    description: "Hoe je begroot.",
    category,
    date: "2026-11-01",
    readingMinutes: 6,
    author: "nienke",
    content: [{ type: "paragraph", text: "Tekst." }],
    ...extra,
  };
}

const hero = {
  value: "3,5%",
  text: "van de bezoekers van een B2B-site vult een formulier in.",
  source: "6sense, 2022",
  sourceUrl: "https://www.demandgenreport.com/",
};

test("de drie nieuwe velden zijn optioneel", () => {
  const parsed = zKennis.parse(artikel());
  assert.equal(parsed.heroStat, undefined);
  assert.equal(parsed.keyPoints, undefined);
  assert.equal(parsed.ctaBand, undefined);
});

test("heroStat eist alle vier de velden", () => {
  assert.deepEqual(zKennis.parse(artikel({ heroStat: hero })).heroStat, hero);
  assert.throws(() => zKennis.parse(artikel({ heroStat: { ...hero, source: "" } })));
});

test("keyPoints is precies drie zinnen", () => {
  const drie = ["Eén.", "Twee.", "Drie."];
  assert.deepEqual(zKennis.parse(artikel({ keyPoints: drie })).keyPoints, drie);
  assert.throws(() => zKennis.parse(artikel({ keyPoints: ["Eén.", "Twee."] })));
  assert.throws(() => zKennis.parse(artikel({ keyPoints: [...drie, "Vier."] })));
});

test("ctaBand: facts ontbreekt meestal, en false komt door", () => {
  const band = { kicker: "Eerst meten", heading: "Weet wat er in je verkeer zit.", text: "Meet." };
  assert.equal(zKennis.parse(artikel({ ctaBand: band })).ctaBand.facts, undefined);
  assert.equal(zKennis.parse(artikel({ ctaBand: { ...band, facts: false } })).ctaBand.facts, false);
});

test("de velden gelden ook voor blog — Uitblinkers heeft geen kennisbank", () => {
  assert.deepEqual(zBlog.parse(artikel({ heroStat: hero }, "Algemeen")).heroStat, hero);
});

test("de voorbeeldweergave neemt ze mee en maakt van null undefined", () => {
  const parsed = previewArticleSchema.parse({
    kind: "knowledge",
    slug: "x",
    title: "X",
    heroStat: hero,
    keyPoints: null,
    ctaBand: null,
  });
  assert.deepEqual(parsed.heroStat, hero);
  assert.equal(parsed.keyPoints, undefined);
  assert.equal(parsed.ctaBand, undefined);
});
