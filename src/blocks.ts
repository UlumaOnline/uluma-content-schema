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
  /**
   * Of dit beeld door AI is gemaakt. De sites zetten er een merkteken bij; de
   * transparantieplicht uit de AI Act vraagt erom.
   *
   * Eigenschap van het bestand en niet van de plaatsing: dezelfde foto is in
   * elk artikel even AI-gegenereerd. In Uluma Systems staat hij dan ook op de
   * mediarij, en een `image`-blok kopieert hem mee bij het kiezen — net als
   * alt, width en height. De hero leest hem via de foreign key.
   *
   * Ontbreekt hij, lees dan `false`. Dat is wat elk bestaand beeld is, dus
   * bestaande content hoeft niet aangeraakt te worden.
   */
  aiGenerated?: boolean;
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

/**
 * Eén kaart in een `steps`-blok.
 *
 * Los van `LevelStep` en niet ermee samengevoegd: die beschrijft de zes
 * niveaus van The Operator Shift en heeft een badge, een vraag en een
 * uitlichtvlag. Deze heeft een kop en alinea's. Ze lijken alleen op elkaar
 * doordat ze allebei een rijtje kaarten opleveren.
 */
export interface Step {
  /** De vette regel bovenaan de kaart. */
  title: string;
  /**
   * De alinea's eronder, als aparte strings en niet als één tekst met witregels.
   *
   * Een renderer die op `\n\n` moet splitsen is een tweede, ongeschreven
   * parser naast `parseInline`, en die twee gaan het een keer oneens worden.
   * Inline-opmaak mag er wel in, net als in een gewone alinea.
   */
  body: string[];
}

/**
 * Een getal met een bron: het hero-getal bovenaan een artikel en het
 * `stat`-blok in de tekst. Eén vorm voor allebei, omdat het in het ontwerp
 * hetzelfde component is in twee maten.
 *
 * Alle vier de velden horen ingevuld te zijn. Een getal zonder bron is in een
 * kennisbankartikel een bewering, en dat is precies wat dit blok niet wil zijn.
 * In `zBlock` mogen ze toch leeg (een vers blok moet in de voorbeeldweergave
 * kunnen staan); `zStrictBlock` en het artikelschema eisen ze.
 */
export interface StatFigure {
  /** Het getal zelf, als tekst: "3,5%", "€ 53", "1 op 4". */
  value: string;
  /** De zin die bij het getal hoort, beginnend waar het getal ophoudt. */
  text: string;
  /** De bron zoals die op het scherm staat: "6sense, 2022". */
  source: string;
  /** Waar de bron te lezen is. Een externe URL. */
  sourceUrl: string;
}

/**
 * Eén kaart in een `cards`-blok.
 *
 * Los van `Step`, hoewel ze lijken: een stap is een stuk van een reeks met
 * meerdere alinea's, een kaart is één van een handvol naast elkaar te
 * vergelijken gevallen met één korte tekst. Ze staan ook anders: stappen onder
 * elkaar, kaarten in een raster.
 */
export interface Card {
  title: string;
  /** Eén korte tekst. Inline-opmaak mag. */
  text: string;
  /** Een klein label onder de tekst, bijv. "Meestal niet gemeten". */
  badge?: string;
  /**
   * De "Dan:"-regel onderaan, bijv. "meer budget voor bereik.". Het woord
   * "Dan:" zet de renderer ervoor, in de taal van het artikel.
   */
  conclusion?: string;
  /** Licht de kaart uit. Hooguit één per raster; de editor bewaakt dat. */
  highlight?: boolean;
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
   *
   * `tocLabel` is de korte naam in de inhoudsopgave. Die lijst wordt afgeleid
   * uit de koppen van niveau 2, en een kop die de hele lading dekt is daar
   * vaak te lang: "Schijnzekerheid: als AI gelijk heeft in de feiten en
   * ongelijk in de conclusie" hoort als "Schijnzekerheid" in de lijst te
   * staan. Ontbreekt hij, dan is `text` het label — dus invullen hoeft alleen
   * waar het nodig is.
   */
  | { type: "heading"; text: string; level?: HeadingLevel; tocLabel?: string }
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
  /**
   * `heading` is de kop boven de vragen, bijv. "Veelgestelde vragen". Sinds
   * v1.8.0. Tot dan zette de redactie er een los `heading`-blok boven, en dat
   * werkt nog steeds. Maar sinds de CTA-band (v1.7.0) knipt Revloft het artikel
   * vlak voor de vragen, en een kop die los staat moet de site dan raden: hoort
   * hij bij de vragen of bij de tekst ervoor? In het blok zelf hoeft niemand te
   * raden. De sites renderen hem als `<h2>`, de kop van een eigen sectie, en
   * nemen hem op in de inhoudsopgave net als een `heading` van niveau 2.
   */
  | { type: "faq"; heading?: string; items: { q: string; a: string }[] }
  | { type: "cta"; text: string; label: string; href: string }
  /**
   * `label` is een kicker boven de tekst, bijv. "Lees ook". Sinds v1.7.0.
   * Ontbreekt hij, dan is dit het terzijde zoals het altijd was. Vrije tekst en
   * geen vaste waarde, zodat een Engels artikel er "Read next" in kan zetten.
   */
  | { type: "note"; text: string; label?: string }
  | { type: "levels"; items: LevelStep[] }
  /**
   * Een genummerde reeks kaarten: per punt een vette kop en er een of meer
   * alinea's onder. Bedoeld voor opsommingen die te veel tekst hebben voor een
   * `list` en te weinig structuur voor een `table` — "drie redenen waarom",
   * "drie controles die je kunt doen".
   *
   * De nummering komt van de renderer en staat niet in de inhoud: een auteur
   * die punt twee verwijdert hoort niet zelf te hoeven hernummeren.
   */
  | { type: "steps"; items: Step[] }
  /**
   * De bronnenlijst onderaan een artikel.
   *
   * Vormt met `list` bijna hetzelfde, en is er toch apart, om twee redenen.
   * De eerste is semantiek: dit is een bronvermelding en geen opsomming, en
   * dat onderscheid is later nodig voor citatie-markup. De tweede is opmaak —
   * links in lopende tekst krijgen op de sites een opvallende pil, en een
   * bronnenlijst hoort daar juist níét in mee te gaan. Met een eigen bloktype
   * is dat een redactionele keuze in plaats van een toevalligheid van markup.
   *
   * Geen eigen kop, net als `faq`: daar zet je een gewoon `heading`-blok
   * boven. Zo blijft "Bronnen" een echte H2 en komt hij vanzelf in de
   * inhoudsopgave terecht.
   */
  | { type: "sources"; items: string[] }
  /**
   * `framed` zet een witte rand om de afbeelding. Bedoeld voor screenshots van
   * een licht scherm: die hebben dezelfde achtergrondkleur als de pagina en
   * lopen er zonder rand in over. Uitzondering, geen standaard — een foto heeft
   * dit niet nodig.
   */
  /**
   * `caption` is het zichtbare onderschrift: bronvermelding, toelichting,
   * fotocredit. Nadrukkelijk iets anders dan `image.alt` — dat is de
   * beschrijving voor wie het beeld niet ziet en hoort niet op het scherm.
   * Een afbeelding kan beide hebben, en ze zeggen dan ook verschillende dingen.
   *
   * Inline-opmaak mag erin, net als in de tekst van een blok: een
   * bronvermelding is vaak een link. Daarom staat hij ook in
   * `blockInlineTexts`, zodat de linkcontrole van de codegen hem meeneemt.
   */
  | { type: "image"; image: ArticleImage; framed?: boolean; caption?: string }
  /**
   * Een getal met een bron, in de tekst. Sinds v1.7.0.
   *
   * Hetzelfde component als `heroStat` op het artikel, in een kleinere maat.
   * `text` mag inline-opmaak hebben; `sourceUrl` gaat mee in de linkcontrole.
   * De redactieregel "hooguit twee per artikel" bewaakt de editor, niet dit
   * schema: een artikel met drie is lelijk, niet kapot.
   */
  | ({ type: "stat" } & StatFigure)
  /**
   * Een raster van kaarten. Sinds v1.7.0.
   *
   * Zonder `label` nummert de renderer de kaarten 01, 02, 03; met `label`
   * wordt het "Uitkomst 1", "Uitkomst 2". Net als bij `steps` staat de
   * nummering niet in de data.
   *
   * 3 tot 6 kaarten en hooguit één `highlight` is de afspraak; de editor
   * bewaakt het, het schema niet, om dezelfde reden als bij `stat`.
   */
  | { type: "cards"; label?: string; items: Card[] };

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
  "steps",
  "sources",
  "stat",
  "cards",
] as const satisfies readonly ContentBlock["type"][];

// ── zod ──────────────────────────────────────────────────────────────────────

export const zArticleImage = z.object({
  src: z.string().min(1),
  webp: z.string().min(1).optional(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aiGenerated: z.boolean().optional(),
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

/**
 * Losser dan `zLevelStep` hierboven: lege strings mogen.
 *
 * De editor maakt een nieuw blok aan met één lege kaart erin, en daarna wil de
 * redacteur hem kunnen bekijken terwijl hij typt. Zou `title` hier `.min(1)`
 * eisen, dan is een vers blok ongeldig en toont de voorbeeldweergave een
 * foutmelding in plaats van het artikel. Dezelfde afweging als bij `list` en
 * `paragraph`, die om precies die reden ook geen ondergrens hebben.
 */
export const zStep = z.object({
  title: z.string(),
  body: z.array(z.string()).min(1),
});

/**
 * Leeg mag hier, net als bij `zStep`: de editor maakt een vers blok met lege
 * velden en de voorbeeldweergave moet dat kunnen tonen. De eisen staan in
 * `zStrictBlock` (codegen) en in `zStatFigureStrict` (het artikelveld).
 */
export const zStatFigure = z.object({
  value: z.string(),
  text: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
});

const zHttpUrl = z
  .string()
  .regex(/^https?:\/\/\S+$/, "verwacht een volledige URL die begint met http(s)://");

/** Het hero-getal: geen concept meer maar een veld op een gepubliceerd artikel. */
export const zStatFigureStrict = z.object({
  value: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: zHttpUrl,
});

export const zCard = z.object({
  title: z.string(),
  text: z.string(),
  // `.min(1)` op de optionele velden: leeg is weglaten, geen lege badge of
  // een kale "Dan:". Zelfde afweging als bij `caption` en `tocLabel`.
  badge: z.string().min(1).optional(),
  conclusion: z.string().min(1).optional(),
  highlight: z.boolean().optional(),
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
    // `.min(1)`: een leeg label is geen label maar een lege chip in de
    // inhoudsopgave. Weglaten dus, net als bij `cite` en `caption`.
    tocLabel: z.string().min(1).optional(),
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
    // `.min(1)`: leeg is weglaten, geen lege kop. Zelfde afweging als bij
    // `note.label` en `tocLabel`.
    heading: z.string().min(1).optional(),
    items: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1),
  }),
  z.object({
    type: z.literal("cta"),
    text: z.string().min(1),
    label: z.string().min(1),
    href: z.string().min(1),
  }),
  z.object({
    type: z.literal("note"),
    text: z.string().min(1),
    label: z.string().min(1).optional(),
  }),
  z.object({ type: z.literal("levels"), items: z.array(zLevelStep).min(1) }),
  z.object({ type: z.literal("steps"), items: z.array(zStep).min(1) }),
  z.object({ type: z.literal("sources"), items: z.array(z.string()).min(1) }),
  z.object({
    type: z.literal("image"),
    image: zArticleImage,
    framed: z.boolean().optional(),
    // `.min(1)`: een lege caption is geen caption maar een lege regel onder de
    // afbeelding. Weglaten dus, net als bij `cite` op een citaat.
    caption: z.string().min(1).optional(),
  }),
  zStatFigure.extend({ type: z.literal("stat") }),
  z.object({
    type: z.literal("cards"),
    label: z.string().min(1).optional(),
    items: z.array(zCard).min(1),
  }),
]);

export const zBlocks = z.array(zBlock);

/**
 * Wat de codegen strenger wil dan de voorbeeldweergave.
 *
 * Een tabel waarvan elke rij evenveel cellen heeft als er kolomkoppen zijn.
 * Los van `zBlock` omdat de renderer een rij met te weinig cellen wel overleeft
 * (er ontstaat een gat) maar het altijd een fout van de redacteur is. De codegen
 * gebruikt dit, de voorbeeldweergave niet — daar wil je een half-afgemaakte
 * tabel gewoon kunnen zien.
 *
 * Sinds v1.7.0 ook: een `stat` heeft alle vier de velden en een echte URL, en
 * een kaart in `cards` heeft een titel. Aantallen (3 tot 6 kaarten, hooguit
 * twee getallen per artikel) staan hier bewust níét: die bewaakt de editor.
 * Een build die omvalt op een smaakregel houdt elk ander artikel van die site
 * ook tegen.
 */
export const zStrictBlock = zBlock.superRefine((block, ctx) => {
  if (block.type === "stat") {
    // Een getal zonder bron is een bewering. Dit is de poort naar productie;
    // de editor laat een half ingevuld blok wel toe, de build niet.
    const result = zStatFigureStrict.safeParse(block);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue({ ...issue });
    }
    return;
  }
  if (block.type === "cards") {
    block.items.forEach((card, i) => {
      if (card.title.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", i, "title"],
          message: "kaart zonder titel",
        });
      }
    });
    return;
  }
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
