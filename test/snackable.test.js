/**
 * De blokken en velden uit het "hapbaarder"-ontwerp, sinds v1.6.0.
 *
 * Net als bij het koppenniveau is dit een contract tussen drie repo's: Uluma
 * Systems schrijft het weg, de twee marketingsites renderen het. De regels die
 * hier vastliggen en die je nergens anders ziet staan:
 *
 *  - de nummering van een `steps`-blok staat NIET in de data;
 *  - `tocLabel` ontbreekt meestal, en dan is `text` het label;
 *  - `aiGenerated` ontbreekt bij elk bestaand beeld, en dat betekent `false`.
 *
 * Die drie zijn allemaal "afwezig betekent iets", en dat is precies het soort
 * afspraak dat een renderer anders zelf gaat verzinnen.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zBlock,
  zBlocks,
  zArticleImage,
  blockInlineTexts,
  blockHrefs,
  blogPostSchema,
  previewArticleSchema,
} from "../dist/index.js";

// ── steps ────────────────────────────────────────────────────────────────────

test("een steps-blok houdt zijn vorm", () => {
  const block = {
    type: "steps",
    items: [
      { title: "Let op de formulering.", body: ["Dit is de snelste controle."] },
      { title: "Vraag naar de uitvoerder.", body: ["Eerste alinea.", "Tweede alinea."] },
    ],
  };
  assert.deepEqual(zBlock.parse(block), block);
});

test("de nummering staat niet in de data", () => {
  // Anders moet een auteur hernummeren zodra hij punt twee weghaalt, en dan
  // staat er vroeg of laat 1, 2, 4 in een live artikel.
  const parsed = zBlock.parse({
    type: "steps",
    items: [{ title: "Eerste", body: ["Tekst."] }],
  });
  assert.deepEqual(Object.keys(parsed.items[0]).sort(), ["body", "title"]);
});

test("een verse, nog lege kaart blijft geldig", () => {
  // De editor maakt een nieuw blok aan met één lege kaart. Zou dat ongeldig
  // zijn, dan toont de voorbeeldweergave een foutmelding in plaats van het
  // artikel waar de redacteur op dat moment aan zit te werken.
  const parsed = zBlock.parse({ type: "steps", items: [{ title: "", body: [""] }] });
  assert.equal(parsed.items.length, 1);
});

test("een steps-blok zonder kaarten wordt geweigerd", () => {
  assert.throws(() => zBlock.parse({ type: "steps", items: [] }));
});

test("een kaart zonder alinea's wordt geweigerd", () => {
  assert.throws(() => zBlock.parse({ type: "steps", items: [{ title: "Kop", body: [] }] }));
});

test("body is een lijst alinea's en geen tekst met witregels", () => {
  // Zou dit een string zijn, dan moet elke renderer zelf op \n\n splitsen —
  // een tweede parser naast parseInline, die het ooit oneens wordt.
  assert.throws(() =>
    zBlock.parse({ type: "steps", items: [{ title: "Kop", body: "Een.\n\nTwee." }] }),
  );
});

test("kop en alinea's van een steps-blok gaan allebei door de linkcontrole", () => {
  const block = {
    type: "steps",
    items: [{ title: "Kop met [link](/a)", body: ["Body met [link](/b)"] }],
  };
  assert.deepEqual(blockInlineTexts(block), ["Kop met [link](/a)", "Body met [link](/b)"]);
  assert.deepEqual(blockHrefs(block), ["/a", "/b"]);
});

// ── sources ──────────────────────────────────────────────────────────────────

test("een bronnenlijst houdt zijn vorm", () => {
  const block = { type: "sources", items: ["SIDN, [Een taalassistent](https://sidn.nl), 2026."] };
  assert.deepEqual(zBlock.parse(block), block);
});

test("een lege bronnenlijst wordt geweigerd", () => {
  assert.throws(() => zBlock.parse({ type: "sources", items: [] }));
});

test("de links in een bronnenlijst worden gecontroleerd", () => {
  // Dit is de hele reden dat sources in blockInlineTexts zit: een bronnenlijst
  // bestaat grotendeels uit links, en een kapotte bron vindt niemand handmatig
  // terug.
  const block = {
    type: "sources",
    items: ["Kalai e.a., [Why Language Models Hallucinate](https://example.org/paper), 2025."],
  };
  assert.deepEqual(blockHrefs(block), ["https://example.org/paper"]);
});

// ── tocLabel ─────────────────────────────────────────────────────────────────

test("een kop zonder tocLabel blijft geldig en houdt zijn vorm", () => {
  const parsed = zBlock.parse({ type: "heading", text: "Een lange kop", level: 2 });
  assert.equal(parsed.tocLabel, undefined, "afwezig blijft afwezig — text is dan het label");
});

test("tocLabel kort de kop af in de inhoudsopgave", () => {
  const parsed = zBlock.parse({
    type: "heading",
    text: "Schijnzekerheid: als AI gelijk heeft in de feiten en ongelijk in de conclusie",
    level: 2,
    tocLabel: "Schijnzekerheid",
  });
  assert.equal(parsed.tocLabel, "Schijnzekerheid");
});

test("een leeg tocLabel wordt geweigerd", () => {
  // Een lege chip in de inhoudsopgave is erger dan geen chip. Weglaten dus,
  // net als bij cite en caption.
  assert.throws(() =>
    zBlock.parse({ type: "heading", text: "Kop", level: 2, tocLabel: "" }),
  );
});

test("tocLabel telt niet mee als inline-tekst", () => {
  // Het is een navigatielabel, geen zichtbare zin in het artikel, en er hoort
  // dus ook geen opmaak of link in.
  assert.deepEqual(
    blockInlineTexts({ type: "heading", text: "Kop", level: 2, tocLabel: "Kort" }),
    ["Kop"],
  );
});

// ── aiGenerated ──────────────────────────────────────────────────────────────

test("een beeld zonder aiGenerated blijft geldig en houdt zijn vorm", () => {
  // Dit is de regel die de migratie in Uluma Systems veilig maakt: elk
  // bestaand beeld heeft dit veld niet, en dat moet "niet door AI gemaakt"
  // betekenen zonder dat er één rij hoeft te worden aangeraakt.
  const image = { src: "/foto.jpg", alt: "Een foto", width: 1200, height: 800 };
  const parsed = zArticleImage.parse(image);
  assert.deepEqual(parsed, image);
  assert.equal(parsed.aiGenerated, undefined);
});

test("een AI-beeld draagt het merkteken", () => {
  const parsed = zArticleImage.parse({
    src: "/ai.jpg",
    alt: "Gegenereerd beeld",
    width: 1200,
    height: 800,
    aiGenerated: true,
  });
  assert.equal(parsed.aiGenerated, true);
});

test("een image-blok neemt het merkteken mee", () => {
  const block = {
    type: "image",
    image: { src: "/ai.jpg", alt: "Beeld", width: 10, height: 10, aiGenerated: true },
  };
  assert.deepEqual(zBlock.parse(block), block);
});

// ── kern ─────────────────────────────────────────────────────────────────────

const zBlog = blogPostSchema(["Praktijk"]);

function artikel(extra = {}) {
  return {
    slug: "een-artikel",
    title: "Een artikel",
    description: "Een beschrijving.",
    category: "Praktijk",
    date: "2026-08-06",
    readingMinutes: 7,
    author: "fabian-slosse",
    content: [{ type: "paragraph", text: "Tekst." }],
    ...extra,
  };
}

test("kern is optioneel — niet elk artikel heeft er een", () => {
  const parsed = zBlog.parse(artikel());
  assert.equal(parsed.kern, undefined);
});

test("kern komt door als hij er staat", () => {
  const parsed = zBlog.parse(artikel({ kern: "Het komt doordat het zekerder klinkt." }));
  assert.equal(parsed.kern, "Het komt doordat het zekerder klinkt.");
});

test("kern is begrensd op 400 tekens, gelijk aan de CHECK op articles.kern", () => {
  // Lopen die twee uit elkaar, dan kun je iets opslaan dat pas bij de build
  // stukloopt — precies wat de lengtegrenzen hier horen te voorkomen.
  assert.doesNotThrow(() => zBlog.parse(artikel({ kern: "k".repeat(400) })));
  assert.throws(() => zBlog.parse(artikel({ kern: "k".repeat(401) })));
});

test("een lege kern wordt geweigerd — dat is geen kern maar een lege kaart", () => {
  assert.throws(() => zBlog.parse(artikel({ kern: "" })));
});

test("de voorbeeldweergave maakt van een ontbrekende kern undefined", () => {
  // get_preview levert een vaste sleutelset met null waar iets niet van
  // toepassing is; de sites typen `kern?: string` en niet `string | null`.
  for (const waarde of [null, undefined, ""]) {
    const parsed = previewArticleSchema.parse({
      kind: "blog",
      slug: "x",
      title: "Titel",
      kern: waarde,
      content: [],
    });
    assert.equal(parsed.kern, undefined, `${JSON.stringify(waarde)} hoort undefined te worden`);
  }
});

// ── het geheel ───────────────────────────────────────────────────────────────

test("een artikel met alle nieuwe blokken parseert in zijn geheel", () => {
  const blocks = [
    { type: "heading", text: "Waarom AI zo stellig klinkt", level: 2, tocLabel: "Stelligheid" },
    { type: "paragraph", text: "Drie dingen." },
    { type: "steps", items: [{ title: "Eerste", body: ["Uitleg."] }] },
    { type: "heading", text: "Bronnen", level: 2 },
    { type: "sources", items: ["SIDN, 2026."] },
  ];
  assert.deepEqual(zBlocks.parse(blocks), blocks);
});
