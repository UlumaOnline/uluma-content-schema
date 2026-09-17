/**
 * Vastleggen dat `parseInline` zich exact gedraagt als de `renderInline` die hij
 * vervangt (src/components/article-body.tsx in de marketingsite).
 *
 * De referentie-implementatie staat hieronder letterlijk overgenomen, maar dan
 * met tokens in plaats van React-nodes. Wijkt de parser af, dan valt dat hier om
 * — en niet pas als er een artikel verkeerd op productie staat.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, stripInline, inlineHrefs, isExternalHref } from "../dist/index.js";

/** De oorspronkelijke lus, één-op-één, met tokens als uitvoer. */
function referenceParse(text) {
  const nodes = [];
  const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      nodes.push({ kind: "bold", text: m[1] });
    } else {
      nodes.push({
        kind: "link",
        label: m[2],
        href: m[3],
        external: /^(https?:|mailto:)/.test(m[3]),
      });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push({ kind: "text", text: text.slice(last) });
  return nodes;
}

const CASES = [
  "",
  "Gewone tekst zonder opmaak.",
  "Tekst met **vet** erin.",
  "**Helemaal vet.**",
  "Een [interne link](/blog/iets) midden in een zin.",
  "Een [externe link](https://arxiv.org/pdf/2507.07935) naar een studie.",
  "Mail ons op [info@uitblinkers.ai](mailto:info@uitblinkers.ai).",
  "**Vet** aan het begin en [een link](/over) aan het eind",
  "Twee **stukken** vet in **één** zin.",
  "Losse ** sterretjes die niets afsluiten.",
  "Een [link](/a) direct gevolgd door **vet**.",
  "Haakjes (gewoon) en [een link](/pad-met-streepjes) door elkaar.",
  "Ongepaarde [blokhaak zonder href.",
  "**",
  "****",
  "[](/leeg-label-telt-niet)",
  "Tekst met een **vet stuk** en daarna nog wat tekst.",
];

test("parseInline komt exact overeen met de oorspronkelijke renderInline", () => {
  for (const input of CASES) {
    assert.deepEqual(
      parseInline(input),
      referenceParse(input),
      `afwijking bij: ${JSON.stringify(input)}`,
    );
  }
});

test("parseInline overleeft invoer die geen string is", () => {
  // De voorbeeldweergave leest rechtstreeks uit jsonb; daar kan alles in staan.
  // Zonder deze guard sloopt één kapot blok de hele prerender.
  assert.deepEqual(parseInline(undefined), []);
  assert.deepEqual(parseInline(null), []);
  assert.deepEqual(parseInline(42), []);
});

test("de globale regex lekt geen state tussen aanroepen", () => {
  const input = "Een [link](/a) en **vet**.";
  const first = parseInline(input);
  const second = parseInline(input);
  assert.deepEqual(first, second);
});

test("stripInline geeft de leesbare tekst terug", () => {
  assert.equal(
    stripInline("Lees de [gratis test](https://cursus.uitblinkers.ai/test) en word **beter**."),
    "Lees de gratis test en word beter.",
  );
});

test("inlineHrefs vindt elke link", () => {
  assert.deepEqual(inlineHrefs("[een](/a) en [twee](https://b.nl) en **vet**"), [
    "/a",
    "https://b.nl",
  ]);
});

test("isExternalHref onderscheidt intern van extern", () => {
  assert.equal(isExternalHref("/blog/iets"), false);
  assert.equal(isExternalHref("https://uitblinkers.ai"), true);
  assert.equal(isExternalHref("http://example.com"), true);
  assert.equal(isExternalHref("mailto:info@uitblinkers.ai"), true);
});

/*
 * ── Cursief en onderstreept (v1.5.0) ────────────────────────────────────────
 *
 * De referentietest hierboven blijft staan en blijft slagen: geen van zijn
 * gevallen bevat de nieuwe markeringen, dus hij pint nog steeds exact vast hoe
 * vet en links zich gedragen. Dat is precies wat hij moet doen — de nieuwe
 * takken mogen het oude gedrag niet verschuiven, en dat bewijst hij.
 */

test("cursief en onderstreept worden herkend", () => {
  assert.deepEqual(parseInline("Een *cursief* woord."), [
    { kind: "text", text: "Een " },
    { kind: "italic", text: "cursief" },
    { kind: "text", text: " woord." },
  ]);
  assert.deepEqual(parseInline("Een ++onderstreept++ woord."), [
    { kind: "text", text: "Een " },
    { kind: "underline", text: "onderstreept" },
    { kind: "text", text: " woord." },
  ]);
});

test("vet wint van cursief, want ** staat vóór * in het patroon", () => {
  assert.deepEqual(parseInline("**vet**"), [{ kind: "bold", text: "vet" }]);
  assert.deepEqual(parseInline("**vet** en *cursief*"), [
    { kind: "bold", text: "vet" },
    { kind: "text", text: " en " },
    { kind: "italic", text: "cursief" },
  ]);
});

test("een rekensom wordt niet cursief", () => {
  // Dit is de reden dat er een niet-spatie-eis op de markering staat. Zonder
  // die eis wordt hier " 3 = 15 en 2 " cursief, midden in lopende tekst.
  const input = "5 * 3 = 15 en 2 * 4 = 8";
  assert.deepEqual(parseInline(input), [{ kind: "text", text: input }]);
});

test("losse plussen worden niet onderstreept", () => {
  const input = "een ++ twee en drie ++ vier";
  assert.deepEqual(parseInline(input), [{ kind: "text", text: input }]);
});

test("een ster in een linklabel splijt de link niet", () => {
  assert.deepEqual(parseInline("[een *ster* erin](/pad)"), [
    { kind: "link", label: "een *ster* erin", href: "/pad", external: false },
  ]);
});

test("één teken tussen de markeringen mag", () => {
  assert.deepEqual(parseInline("*a* en ++b++"), [
    { kind: "italic", text: "a" },
    { kind: "text", text: " en " },
    { kind: "underline", text: "b" },
  ]);
});

test("een ongepaarde markering blijft gewone tekst", () => {
  assert.deepEqual(parseInline("Losse * ster en losse ++ plus."), [
    { kind: "text", text: "Losse * ster en losse ++ plus." },
  ]);
});

test("stripInline haalt ook de nieuwe markeringen weg", () => {
  assert.equal(
    stripInline("Een *cursief* en ++onderstreept++ stuk met **vet**."),
    "Een cursief en onderstreept stuk met vet.",
  );
});

test("inlineHrefs blijft alleen links vinden", () => {
  assert.deepEqual(inlineHrefs("*cursief* ++onder++ [een](/a) **vet**"), ["/a"]);
});
