/**
 * Het schema voor de voorbeeldweergave van een concept.
 *
 * Bewust losser dan `blogPostSchema` / `newsArticleSchema`, want dit zijn twee
 * verschillende poorten:
 *
 * - De **codegen** bewaakt de weg naar productie. Ontbreekt er een categorie of
 *   een datum, dan is het artikel niet af en moet de build weigeren.
 * - De **voorbeeldweergave** laat een concept zien terwijl de redacteur eraan
 *   werkt. Halverwege je artikel wil je kunnen kijken hoe het eruitziet, niet te
 *   horen krijgen dat je nog geen categorie hebt gekozen.
 *
 * Daarnaast normaliseert dit schema `null` naar `undefined`. `get_preview` in
 * Uluma Systems levert een vaste sleutelset waarin elke sleutel altijd aanwezig
 * is en `null` is waar hij niet van toepassing is (`metaTitle` bij nieuws,
 * `location` bij blog). Dat is een prettige, testbare vorm om te consumeren —
 * maar zod's `.optional()` accepteert alleen `undefined`, en de site-types
 * zeggen `metaTitle?: string`, niet `string | null`. Zonder deze vertaalslag
 * levert parsen dus iets op dat geen geldige `BlogPost` is.
 *
 * `.nullish()` accepteert beide, de transform maakt er één ding van.
 */

import { z } from "zod";
import { zBlocks, zArticleImage } from "./blocks.js";

/** Accepteert null én undefined, levert altijd undefined of de waarde zelf. */
function nullishText(max?: number) {
  const base = max === undefined ? z.string() : z.string().max(max);
  return base
    .nullish()
    .transform((value) => (value === null || value === "" ? undefined : value));
}

/**
 * De vorm die `get_preview` teruggeeft, genormaliseerd naar iets dat je
 * rechtstreeks aan `ArticleBody` kunt geven.
 *
 * `kind` bepaalt welk soort artikel het is, zodat de route weet welke dateline
 * en welke structured data erbij horen. De rest volgt `BlogPost`,
 * `NewsArticle` en `KnowledgeArticle`, met alle optionele velden nullish.
 *
 * De enum staat hier los van de drie schema's hieronder en dat is met opzet:
 * dit valideert een concept dat nog nergens aan hoeft te voldoen. Ontbreekt een
 * soort hier, dan krijgt de redacteur "het concept is niet geldig" te zien in
 * plaats van zijn eigen tekst.
 */
export const previewArticleSchema = z.object({
  kind: z.enum(["blog", "news", "knowledge"]),
  slug: z.string(),
  title: z.string(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  excerpt: nullishText(),
  metaTitle: nullishText(),
  category: nullishText(),
  location: nullishText(),
  author: nullishText(),
  date: nullishText(),
  readingMinutes: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? 1),
  image: zArticleImage.nullish().transform((value) => value ?? undefined),
  // Blokken blijven wél streng gevalideerd: een misvormd blok laat de renderer
  // struikelen, en dat wil je in de voorbeeldweergave net zo goed niet.
  content: zBlocks.nullish().transform((value) => value ?? []),
});

export type PreviewArticle = z.infer<typeof previewArticleSchema>;

/**
 * Parseert een `get_preview`-respons. Geeft `null` terug als het token nergens
 * op uitkomt — dat is geen fout maar een verlopen of verkeerd gekopieerde link.
 */
export function parsePreview(
  payload: unknown,
):
  | { ok: true; article: PreviewArticle }
  | { ok: false; reason: "not-found" | "invalid"; detail?: string } {
  if (payload === null || payload === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const parsed = previewArticleSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      detail: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    };
  }
  return { ok: true, article: parsed.data };
}
