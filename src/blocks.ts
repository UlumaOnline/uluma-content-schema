/**
 * Het gedeelde artikelmodel, gebruikt door de blog- en nieuwssecties van elke
 * Uluma-site én door de editor in Uluma Systems.
 *
 * Artikelen zijn platte data (metadata + een geordende lijst contentblokken),
 * geen ruwe HTML. Daardoor blijven ze getypeerd en kan de renderer schone,
 * semantische, SEO-vriendelijke markup uitpoepen die bij build-tijd statisch
 * geprerenderd wordt.
 *
 * Inline opmaak binnen de tekst van een blok (alinea's, lijstitems, tabelcellen,
 * quotes, FAQ-antwoorden, noten) ondersteunt een piepklein stukje markdown:
 *   **vet**             → <strong>
 *   [label](/pad)       → interne link
 *   [label](https://…)  → externe link (opent in een nieuw tabblad)
 * Zie `parseInline` in ./inline.ts — dat is de enige parser, gedeeld door de
 * sites en de editor, zodat een voorbeeldweergave niet kan afwijken van live.
 *
 * TYPES ZIJN HIER DE BRON, de zod-schema's staan ernaast als runtime-poort.
 * De twee `AssertAssignable`-regels onderaan falen bij compileren zodra ze uit
 * elkaar lopen, dus je kunt er niet één aanpassen zonder de ander.
 */

import { z } from "zod";

/**
 * Een foto in een artikel — de foto bovenaan het artikel en in de overzichtshero,
 * of een `image`-blok in de body.
 *
 * `src` en `webp` betekenen niet overal hetzelfde, en dat is opzet:
 *
 * - In de database staat er de publieke Supabase Storage-URL in, zodat de
 *   voorbeeldweergave hem direct kan tonen.
 * - In een gegenereerd contentbestand staat er het geïmporteerde asset in, zodat
 *   Vite hem fingerprint. Dat is nodig omdat de og:image wordt opgebouwd als
 *   `SITE_URL + image.src`, wat alleen klopt bij een root-relatief pad.
 *
 * De codegen zet het eerste om in het tweede en genereert dan pas de `webp`.
 */
export interface ArticleImage {
  /** JPEG/PNG-fallback, en de bron voor og:image. */
  src: string;
  /** Optionele WebP-versie; browsers die het ondersteunen krijgen deze. */
  webp?: string;
  /** Beschrijft de foto voor schermlezers. Laat dit nooit leeg. */
  alt: string;
  /** Intrinsieke pixelmaat. Reserveert ruimte en voedt og:image:width/height. */
  width: number;
  height: number;
}

/** Eén stap in een `levels`-blok: de 6 niveaus van The Operator Shift als trap. */
export interface LevelStep {
  /** Korte badge, bijv. "N4". */
  badge: string;
  /** Naam van het niveau, bijv. "Integrator". */
  name: string;
  /** De vraag die iemand op dit niveau stelt; wordt tussen aanhalingstekens gezet. */
  question: string;
  description: string;
  /** Licht de stap uit (donkere kaart, accentrand). Gebruik op hooguit één stap. */
  featured?: boolean;
  /** Dimt de badge voor niveaus die niet de focus van het artikel zijn. */
  dim?: boolean;
  /** Streepjeslijn direct onder deze stap, bijv. een overgangslabel. */
  dividerBelow?: string;
}

/** De zes koppenniveaus uit HTML. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Eén stuk artikelinhoud. */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  /**
   * Een kop, met het niveau erbij.
   *
   * `level` ontbrak tot v1.4.0 en de editor had er twee bloktypes voor:
   * `heading` werd `<h2>` en `subheading` werd `<h3>`. In de editor stonden
   * daar de iconen H1 en H2 bij, en dat klopte dus met geen van beide. Nienke
   * liep er in september tegenaan bij Revloft.
   *
   * Ontbreekt `level`, lees dan 2. Dat is precies wat `heading` altijd al was,
   * dus oude blokken hoeven niet aangeraakt te worden om goed te blijven.
   *
   * Let op bij het renderen: de artikeltitel is de `<h1>` van de pagina. Een
   * blok met `level: 1` zet er een tweede naast. Dat mag de redactie kiezen,
   * maar het is geen standaard.
   */
  | { type: "heading"; text: string; level?: HeadingLevel }
  /**
   * @deprecated Sinds v1.4.0 vervangen door `heading` met `level: 3`.
   *
   * Blijft in de union staan zolang er sites zijn die hem nog renderen.
   * Weghalen is een breaking change: `assertNever` maakt er een compileerfout
   * van, en dat is precies de bedoeling, maar niet in dezelfde release als de
   * toevoeging hierboven.
   */
  | { type: "subheading"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "quote"; text: string; cite?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "cta"; text: string; label: string; href: string }
  | { type: "note"; text: string }
  | { type: "levels"; items: LevelStep[] }
  /**
   * `framed` zet een witte rand om de afbeelding. Bedoeld voor screenshots van
   * een licht scherm: die hebben dezelfde achtergrondkleur als de pagina en
   * lopen er zonder rand in over. Uitzondering, geen standaard — een foto heeft
   * dit niet nodig.
   */
  | { type: "image"; image: ArticleImage; framed?: boolean };

/** Alle bloktypes, als waarde. Handig voor een "+ blok toevoegen"-menu. */
export const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "subheading",
  "list",
  "quote",
  "table",
  "faq",
  "cta",
  "note",
  "levels",
  "image",
] as const satisfies readonly ContentBlock["type"][];

// ── zod ──────────────────────────────────────────────────────────────────────

export const zArticleImage = z.object({
  src: z.string().min(1),
  webp: z.string().min(1).optional(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const zLevelStep = z.object({
  badge: z.string().min(1),
  name: z.string().min(1),
  question: z.string().min(1),
  description: z.string().min(1),
  featured: z.boolean().optional(),
  dim: z.boolean().optional(),
  dividerBelow: z.string().min(1).optional(),
});

export const zHeadingLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const zBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({
    type: z.literal("heading"),
    text: z.string().min(1),
    level: zHeadingLevel.optional(),
  }),
  z.object({ type: z.literal("subheading"), text: z.string().min(1) }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string()).min(1),
    ordered: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("quote"),
    text: z.string().min(1),
    cite: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.object({
    type: z.literal("faq"),
    items: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1),
  }),
  z.object({
    type: z.literal("cta"),
    text: z.string().min(1),
    label: z.string().min(1),
    href: z.string().min(1),
  }),
  z.object({ type: z.literal("note"), text: z.string().min(1) }),
  z.object({ type: z.literal("levels"), items: z.array(zLevelStep).min(1) }),
  z.object({
    type: z.literal("image"),
    image: zArticleImage,
    framed: z.boolean().optional(),
  }),
]);

export const zBlocks = z.array(zBlock);

/**
 * Een tabel waarvan elke rij evenveel cellen heeft als er kolomkoppen zijn.
 * Los van `zBlock` omdat de renderer een rij met te weinig cellen wel overleeft
 * (er ontstaat een gat) maar het altijd een fout van de redacteur is. De codegen
 * gebruikt dit, de voorbeeldweergave niet — daar wil je een half-afgemaakte
 * tabel gewoon kunnen zien.
 */
export const zStrictBlock = zBlock.superRefine((block, ctx) => {
  if (block.type !== "table") return;
  block.rows.forEach((row, i) => {
    if (row.length !== block.headers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", i],
        message: `rij heeft ${row.length} cellen, verwacht ${block.headers.length}`,
      });
    }
  });
});

// ── vangnet ──────────────────────────────────────────────────────────────────

/**
 * Faalt bij compileren zodra `A` niet toewijsbaar is aan `B`. Puur type-niveau,
 * geen runtime-kosten.
 */
type AssertAssignable<A extends B, B> = A extends B ? true : never;

/** Elk parseresultaat is een geldige `ContentBlock` … */
export type _BlockOut = AssertAssignable<z.infer<typeof zBlock>, ContentBlock>;
/** … en elke `ContentBlock` is door het schema te parseren. */
export type _BlockIn = AssertAssignable<ContentBlock, z.infer<typeof zBlock>>;

/**
 * Uitputtendheidscheck voor een `switch` over `ContentBlock["type"]`.
 *
 * Voeg je een bloktype toe aan de union, dan geeft elke renderer die het niet
 * afhandelt een compileerfout in plaats van stilletjes de verkeerde markup te
 * tonen. Op runtime is dit de vangnetregel in het `default`-geval: onbekende
 * blokken uit de database worden overgeslagen in plaats van dat ze de
 * prerenderer laten crashen.
 */
export function assertNever(value: never, context = "onbekende variant"): null {
  console.warn(`[content-schema] ${context}:`, value);
  return null;
}
