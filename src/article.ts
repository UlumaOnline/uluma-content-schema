/**
 * Artikelschema's.
 *
 * De *types* van een artikel blijven per site staan, want de categorielijst
 * verschilt per site (en straks per taal) en die hoort niet in een gedeeld
 * pakket. Wat hier staat zijn de **runtime-poorten**: schemafabrieken die je de
 * toegestane categorieën meegeeft en die er een validator van maken.
 *
 * Zo blijft de bestaande `BlogPost`-interface in de site het contract voor de
 * renderer, en is dit het contract voor alles wat uit de database komt.
 */

import { z } from "zod";
import { zBlocks, zStrictBlock, zArticleImage } from "./blocks.js";
import { SLUG_PATTERN } from "./slug.js";

/** Categorielijst zoals `z.enum` hem wil: minstens één waarde. */
export type CategoryList = readonly [string, ...string[]];

const zIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "verwacht een ISO-datum YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "bestaat niet als datum");

/**
 * Velden die blog en nieuws delen. Let op de lengtegrenzen: die staan óók als
 * CHECK-constraint op de tabel, zodat de database en de codegen het over
 * hetzelfde eens zijn en je niet iets kunt opslaan dat pas bij de build stukloopt.
 */
function commonFields(categories: CategoryList) {
  return {
    slug: z.string().regex(SLUG_PATTERN, "slug moet kleine letters, cijfers en koppeltekens zijn"),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(320),
    excerpt: z.string().min(1).max(400).optional(),
    category: z.enum(categories),
    date: zIsoDate,
    readingMinutes: z.number().int().min(1).max(60),
    image: zArticleImage.optional(),
    content: zBlocks.min(1),
  };
}

/**
 * Blog. `author` is een sleutel in het auteursregister van de site, geen naam —
 * de codegen controleert of hij bestaat. Doet hij dat niet, dan rendert de
 * `AuthorBox` stilletjes niets en verdwijnt het auteursblok uit een live
 * artikel zonder dat iemand een fout ziet.
 */
export function blogPostSchema(categories: CategoryList) {
  return z.object({
    ...commonFields(categories),
    metaTitle: z.string().min(1).max(120).optional(),
    author: z.string().min(1),
  });
}

/**
 * Nieuws. Geen auteur (nieuws wordt door de organisatie gepubliceerd, niet door
 * een persoon) en wel een optionele plaatsnaam voor de dateline.
 *
 * Bewust géén `featured`-vlag: de hero op het overzicht is altijd het nieuwste
 * gepubliceerde item, op zowel /blog als /nieuws. Een vlag die je bij elke
 * publicatie moet verzetten wordt vergeten, en dan staat er oud nieuws
 * uitgelicht.
 */
export function newsArticleSchema(categories: CategoryList) {
  return z.object({
    ...commonFields(categories),
    location: z.string().min(1).max(80).optional(),
  });
}

/**
 * Kennisartikel. Uitleg die je opzoekt en herleest, in tegenstelling tot een
 * blog (een mening of een ervaring) en nieuws (een bericht van de organisatie).
 *
 * Vandaag structureel gelijk aan `blogPostSchema`, en dat blijft een tijdje zo.
 * Toch een eigen naam en geen alias: dit is de plek waar de twee later uit
 * elkaar mogen lopen zonder dat iemand per ongeluk de blog meeneemt. Dezelfde
 * afweging als bij `newsArticleSchema`, dat ook maar in twee velden verschilt.
 *
 * De categorielijst is wél een andere. Een blogcategorie zegt waar een stuk
 * *over* gaat, een kenniscategorie wat voor *soort* uitleg het is; ze delen
 * geen enkele waarde. Vandaar dat de lijst hier net als overal wordt
 * meegegeven en niet vastligt.
 */
export function knowledgeArticleSchema(categories: CategoryList) {
  return z.object({
    ...commonFields(categories),
    metaTitle: z.string().min(1).max(120).optional(),
    author: z.string().min(1),
  });
}

/**
 * Strengere variant voor de codegen: naast het gewone schema controleert deze
 * ook of elke tabelrij evenveel cellen heeft als er kolomkoppen zijn.
 *
 * De editor gebruikt hem niet — daar wil je een half-afgemaakte tabel gewoon
 * kunnen zien terwijl je hem typt. De poort naar productie is strenger dan de
 * poort naar een concept.
 */
export function strictContent() {
  return z.array(zStrictBlock).min(1);
}

export type BlogPostInput = z.infer<ReturnType<typeof blogPostSchema>>;
export type NewsArticleInput = z.infer<ReturnType<typeof newsArticleSchema>>;
export type KnowledgeArticleInput = z.infer<ReturnType<typeof knowledgeArticleSchema>>;

/** Eén validatiefout, plat genoeg om als regel in een buildlog te passen. */
export interface ContentIssue {
  /** `blog/mijn-slug` — waar het fout zit, in mensentaal. */
  where: string;
  /** `content[3].items[0]` — het pad binnen het artikel. */
  path: string;
  message: string;
}

/**
 * Verzamelt álle fouten in plaats van te stoppen bij de eerste.
 *
 * Dat is met opzet: de codegen draait in CI en een build die één fout per keer
 * meldt kost je een ronde van drie minuten per typefout. Beter één rapport met
 * alles wat er mis is.
 */
export function collectIssues(where: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    where,
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
    message: issue.message,
  }));
}

export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((issue) => `  ${issue.where} → ${issue.path}: ${issue.message}`).join("\n");
}
