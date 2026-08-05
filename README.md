# @uluma/content-schema

Het gedeelde artikelmodel van Uluma: de `ContentBlock`-types, de zod-schema's die
ze op runtime bewaken, en de inline-tekstparser.

Twee projecten hangen hiervan af en dat is precies waarom dit pakket bestaat:

- **de marketingsites** (`uitblinkers-ai-web`, straks `revloft`) renderen deze
  blokken naar statische HTML;
- **Uluma Systems** (de CMS) schrijft ze.

Zouden die twee elk hun eigen kopie hebben, dan lopen ze uit elkaar — en dat merk
je niet bij het opslaan maar pas als een gepubliceerd artikel verkeerd rendert.

## Installeren

Beide consumenten installeren hetzelfde artefact op dezelfde manier:

```json
"@uluma/content-schema": "github:UlumaOnline/uluma-content-schema#v1.0.0"
```

Tag-gepind, zodat de site en de CMS onafhankelijk kunnen upgraden. Dat is geen
detail: de site kan een nieuw bloktype pas renderen als de renderer gedeployed
is, dus de CMS mag niet zomaar vooruitlopen.

`zod@^3` is een peer dependency. Níét zod 4 — dat zijn andere importpaden en je
wilt geen twee zods in één bundel.

## Wat erin zit

| Module | Inhoud |
|---|---|
| `blocks.ts` | `ContentBlock` (11 varianten), `ArticleImage`, `LevelStep`, `zBlock`, `zStrictBlock`, `BLOCK_TYPES`, `assertNever` |
| `inline.ts` | `parseInline`, `stripInline`, `inlineHrefs`, `isExternalHref` |
| `walk.ts` | `blockInlineTexts`, `blockPlainTexts`, `blockImages`, `blockHrefs` |
| `article.ts` | `blogPostSchema()`, `newsArticleSchema()`, `strictContent()`, foutrapportage |
| `slug.ts` | `slugify`, `isValidSlug`, `uniqueSlug`, `SLUG_PATTERN` |
| `reading-time.ts` | `estimateReadingMinutes`, `countWords` |

De **types** zijn de bron, de zod-schema's staan ernaast als runtime-poort. Twee
type-niveau-checks onderaan `blocks.ts` falen bij compileren zodra die twee uit
elkaar lopen, dus je kunt er niet één aanpassen zonder de ander.

## Een bloktype toevoegen

De volgorde is opzettelijk lastig te omzeilen:

1. Voeg de variant toe aan `ContentBlock` **en** aan `zBlock` — anders faalt de
   compileercheck in `blocks.ts`.
2. Vul de `switch` in `walk.ts` aan — die is uitputtend.
3. Bump de versie, tag, push.
4. In de site: voeg een `case` toe aan `ArticleBody`. Tot je dat doet, is de
   `assertNever` in het `default`-geval een compileerfout.
5. In de CMS: voeg een entry toe aan `blockRegistry`. Dat is
   `satisfies Record<ContentBlock["type"], BlockDef>`, dus ook dat is een
   compileerfout tot het formulier bestaat.

Stap 4 en 5 kunnen los in de tijd, maar geen van beide kan stilzwijgend
overgeslagen worden. Dat is het hele punt.

## Inline-opmaak

Binnen de tekst van een blok is een piepklein stukje markdown toegestaan:

```
**vet**             → <strong>
[label](/pad)       → interne link
[label](https://…)  → externe link, opent in een nieuw tabblad
```

Meer niet, en dat is een keuze: elke uitbreiding hier moet door élke renderer
gevolgd worden. `parseInline` levert tokens; wat je ermee tekent bepaal je zelf.

## Ontwikkelen

```bash
npm install     # bouwt via `prepare`
npm test        # vergelijkt parseInline met de oorspronkelijke renderInline
npm run typecheck
```

De tests draaien tegen `dist/`, dus bouw voordat je test.
