/**
 * Doorloophulpjes over een blokkenlijst.
 *
 * Beide consumenten hebben ze nodig en beide zouden ze anders zelf schrijven:
 * de codegen om afbeeldingen te vinden en links te controleren, de editor om
 * leestijd te schatten. Er is precies één `switch` over alle bloktypes, hier,
 * en die is uitputtend — voeg je een bloktype toe, dan faalt het compileren
 * hier tot je hebt bepaald welke tekst en welke afbeeldingen erin zitten.
 */

import type { ArticleImage, ContentBlock } from "./blocks.js";
import { inlineHrefs } from "./inline.js";

/**
 * Alle tekst in een blok die door `parseInline` gaat, in leesvolgorde.
 *
 * Let op wat er *niet* in zit: `cta.label` (knoptekst, geen inline-opmaak),
 * `levels`-velden (badge, naam, vraag, beschrijving — die worden letterlijk
 * gerenderd) en `image.alt`. Dat is met opzet — dit is de verzameling waar
 * inline-opmaak in mag staan, en dus ook de verzameling die de codegen op
 * kapotte links controleert.
 */
export function blockInlineTexts(block: ContentBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "subheading":
    case "note":
      return [block.text];
    case "quote":
      return block.cite ? [block.text, block.cite] : [block.text];
    case "list":
      return block.items;
    case "table":
      return [...block.headers, ...block.rows.flat()];
    case "faq":
      return block.items.flatMap((item) => [item.q, item.a]);
    case "cta":
      return [block.text];
    case "levels":
      return [];
    case "image":
      return [];
  }
}

/**
 * Alle zichtbare tekst in een blok, inclusief wat er letterlijk gerenderd wordt.
 * Dit is de verzameling voor leestijdschatting; `blockInlineTexts` is smaller.
 */
export function blockPlainTexts(block: ContentBlock): string[] {
  switch (block.type) {
    case "cta":
      return [block.text, block.label];
    case "levels":
      return block.items.flatMap((item) => [
        item.name,
        item.question,
        item.description,
        ...(item.dividerBelow ? [item.dividerBelow] : []),
      ]);
    case "image":
      return [block.image.alt];
    default:
      return blockInlineTexts(block);
  }
}

/**
 * Elke afbeelding in de body, met een setter om hem te vervangen.
 *
 * De codegen heeft die setter nodig: hij downloadt elke afbeelding uit Supabase
 * Storage, optimaliseert hem en schrijft er een geïmporteerd asset voor terug.
 * Dat geldt niet alleen voor de hero-afbeelding van een artikel maar ook voor
 * elk `image`-blok in de body — vergeet je die, dan blijven er in een verder
 * statische site alsnog Supabase-URL's staan.
 */
export function blockImages(blocks: ContentBlock[]): {
  image: ArticleImage;
  replace: (next: ArticleImage) => void;
}[] {
  const found: { image: ArticleImage; replace: (next: ArticleImage) => void }[] = [];
  for (const block of blocks) {
    if (block.type === "image") {
      const target = block;
      found.push({
        image: target.image,
        replace: (next) => {
          target.image = next;
        },
      });
    }
  }
  return found;
}

/**
 * Elke `href` in een blok: de links ín de tekst, plus de knop-href van een cta.
 * Die laatste staat niet in de tekst maar is wel een echte link, en juist de
 * cta's wijzen naar de plekken waar het geld verdiend wordt.
 */
export function blockHrefs(block: ContentBlock): string[] {
  const fromText = blockInlineTexts(block).flatMap((text) => inlineHrefs(text));
  return block.type === "cta" ? [...fromText, block.href] : fromText;
}
