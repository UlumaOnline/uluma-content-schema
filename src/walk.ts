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
 * gerenderd) en `image.alt`. Het onderschrift van een afbeelding zit er wél in. Dat is met opzet — dit is de verzameling waar
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
    case "steps":
      // Kop én alinea's. De kop staat hier — anders dan bij `heading`, waar een
      // kop bewust géén inline-opmaak krijgt — omdat dit er geen sectiekop is
      // maar de eerste regel van een kaart, en de renderers hem daarom net als
      // de rest door `parseInline` halen. Zie ook `faq`, waar de vraag om
      // dezelfde reden meedoet.
      return block.items.flatMap((item) => [item.title, ...item.body]);
    case "sources":
      // Juist hier moet de linkcontrole langs: een bronnenlijst bestáát
      // grotendeels uit links, en een kapotte bron is precies het soort fout
      // dat niemand handmatig terugvindt.
      return block.items;
    case "image":
      // Het onderschrift wel, `image.alt` niet: alt is geen inline-opmaak en
      // geen zichtbare tekst. Staat de caption hier niet in, dan controleert de
      // codegen de links erin niet en is een typefout daar een echte 404.
      return block.caption ? [block.caption] : [];
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
      return block.caption ? [block.image.alt, block.caption] : [block.image.alt];
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
