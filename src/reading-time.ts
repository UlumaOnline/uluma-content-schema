/**
 * Leestijdschatting.
 *
 * Bewust een schatting met een handmatige override in de editor: de bestaande
 * artikelen hebben hun leestijd met de hand gekozen en die getallen wil je niet
 * ongevraagd verzetten. Dit hulpje vult het veld vóór bij een nieuw artikel.
 */

import type { ContentBlock } from "./blocks.js";
import { stripInline } from "./inline.js";
import { blockPlainTexts } from "./walk.js";

/**
 * Woorden per minuut. 200 is de gangbare ondergrens voor stil lezen van
 * Nederlands proza; aan de lage kant gekozen, want een leestijd die tegenvalt
 * is vervelender dan een die meevalt.
 */
const WORDS_PER_MINUTE = 200;

export function countWords(blocks: ContentBlock[]): number {
  return blocks
    .flatMap(blockPlainTexts)
    .map(stripInline)
    .join(" ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Naar boven afgerond, minimaal 1 — "0 min" leest als een fout. */
export function estimateReadingMinutes(blocks: ContentBlock[]): number {
  return Math.max(1, Math.ceil(countWords(blocks) / WORDS_PER_MINUTE));
}
