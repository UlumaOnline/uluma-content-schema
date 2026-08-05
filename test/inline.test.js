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
