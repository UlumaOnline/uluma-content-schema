/**
 * De inline-tekstparser: het piepkleine stukje markdown dat in de tekst van een
 * blok is toegestaan.
 *
 *   **vet**             → { kind: "bold" }
 *   *cursief*           → { kind: "italic" }
 *   ++onderstreept++    → { kind: "underline" }
 *   [label](/pad)       → { kind: "link", external: false }
 *   [label](https://…)  → { kind: "link", external: true }
 *
 * Deze parser is gedeeld en er is er precies één. De marketingsites renderen de
 * tokens als React-nodes, de editor in Uluma Systems rendert ze in zijn
 * voorbeeldweergave. Zouden dat twee implementaties zijn, dan wijkt vroeg of
 * laat af wat de redacteur ziet van wat er live komt — en dat merk je pas als
 * het al gepubliceerd is.
 *
 * Bewust géén echte markdown-parser. De set is klein, de regex is te overzien,
 * en elke uitbreiding hier is een uitbreiding die elke renderer moet volgen.
 */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "underline"; text: string }
  | { kind: "link"; label: string; href: string; external: boolean };

/**
 * Externe links openen in een nieuw tabblad; interne blijven gewone anchors,
 * zodat de prerender-crawler ze volgt en de losse pagina's ontdekt.
 */
export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:)/.test(href);
}

/**
 * Let op de globale vlag: `lastIndex` blijft staan tussen aanroepen, dus dit
 * patroon moet per aanroep vers zijn. Vandaar dat het hier in de functie staat
 * en niet op moduleniveau.
 *
 * De volgorde van de alternatieven is dragend. `**` staat vóór `*`, anders
 * knipt de cursief-tak elk vet stuk doormidden. Een link staat vóór cursief,
 * zodat een `*` in een label niet de link opensplijt.
 *
 * Cursief en onderstreept eisen een niet-spatie direct binnen de markering,
 * aan beide kanten. Zonder die regel wordt `5 * 3 en 2 * 4` cursief vanaf de
 * eerste ster, en `een ++ twee` onderstreept — rekensommen en losse plussen
 * komen in deze teksten echt voor. Vet heeft die regel bewust níét: dat gedrag
 * ligt vast in de referentietest en veranderen zou bestaande artikelen anders
 * laten renderen dan ze nu doen.
 */
function inlinePattern(): RegExp {
  return new RegExp(
    [
      /\*\*(?<bold>.+?)\*\*/,
      /\+\+(?<underline>[^+\s](?:[^+]*[^+\s])?)\+\+/,
      /\[(?<label>[^\]]+)\]\((?<href>[^)]+)\)/,
      /\*(?<italic>[^*\s](?:[^*]*[^*\s])?)\*/,
    ]
      .map((part) => part.source)
      .join("|"),
    "g",
  );
}

/**
 * Splitst tekst in tokens. Onbekende of ongepaarde opmaak blijft gewoon staan
 * als letterlijke tekst — er is geen foutgeval, want een halve `**` in een
 * concept mag de voorbeeldweergave niet stukmaken.
 *
 * Het argument is defensief getypt: de voorbeeldweergave krijgt zijn artikel
 * rechtstreeks uit de database, en jsonb kan alles bevatten. Zonder deze guard
 * zou een blok zonder `text` een TypeError geven — en tijdens het prerenderen
 * neemt die de hele build mee in plaats van één artikel.
 */
export function parseInline(text: string): InlineToken[] {
  if (typeof text !== "string" || text.length === 0) return [];

  const tokens: InlineToken[] = [];
  const regex = inlinePattern();
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ kind: "text", text: text.slice(last, match.index) });
    }
    const groups = match.groups ?? {};
    if (groups.bold !== undefined) {
      tokens.push({ kind: "bold", text: groups.bold });
    } else if (groups.italic !== undefined) {
      tokens.push({ kind: "italic", text: groups.italic });
    } else if (groups.underline !== undefined) {
      tokens.push({ kind: "underline", text: groups.underline });
    } else {
      const label = groups.label ?? "";
      const href = groups.href ?? "";
      tokens.push({ kind: "link", label, href, external: isExternalHref(href) });
    }
    last = regex.lastIndex;
  }

  if (last < text.length) {
    tokens.push({ kind: "text", text: text.slice(last) });
  }

  return tokens;
}

/** De platte tekst van een blokveld, zonder opmaak. Voedt leestijd en zoekindex. */
export function stripInline(text: string): string {
  return parseInline(text)
    .map((token) => (token.kind === "link" ? token.label : token.text))
    .join("");
}

/**
 * Elke `href` in een stuk tekst. De codegen controleert hiermee of interne
 * links naar een bestaande route wijzen: de prerender-crawler volgt ze, dus een
 * typefout is een echte 404 en niet alleen een dode link.
 */
export function inlineHrefs(text: string): string[] {
  return parseInline(text)
    .filter((token): token is Extract<InlineToken, { kind: "link" }> => token.kind === "link")
    .map((token) => token.href);
}
